const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { runIntrospectionSql } = require("../helpers/privilegedSql");

// Alimente l'encart "Invariants de sécurité" de l'onglet Sécurité admin
// (partie D, 2026-08-07) : après CHAQUE invariant, écrit son résultat réel
// dans public.invariant_status via la même connexion privilégiée que le
// reste de ce fichier (jamais via PostgREST/RPC — cette table n'est pas
// censée être écrivable depuis l'app). "Fail" inclut aussi bien un
// assertion échouée qu'un crash du test lui-même (timeout, erreur CLI) :
// dans les deux cas, l'invariant n'est PAS prouvé tenir, donc rouge.
// Best-effort : un échec d'écriture ici ne doit jamais faire échouer le
// test lui-même (ce serait un invariant qui casse à cause de son propre
// reporting), juste un avertissement console.
function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

test.afterEach(async ({}, testInfo) => {
  const match = testInfo.title.match(/Invariant (\d+)/);
  if (!match) return;

  const key = `invariant_${match[1]}`;
  const status = testInfo.status === "passed" ? "pass" : "fail";
  const errorSummary =
    status === "fail" ? (testInfo.errors[0]?.message || "Échec sans message d'erreur capturé").slice(0, 500) : null;

  const sql = `
    INSERT INTO public.invariant_status (invariant_key, label, status, last_run_at, error_summary)
    VALUES (
      '${escapeSqlLiteral(key)}',
      '${escapeSqlLiteral(testInfo.title)}',
      '${status}',
      now(),
      ${errorSummary ? `'${escapeSqlLiteral(errorSummary)}'` : "NULL"}
    )
    ON CONFLICT (invariant_key) DO UPDATE SET
      label = EXCLUDED.label,
      status = EXCLUDED.status,
      last_run_at = EXCLUDED.last_run_at,
      error_summary = EXCLUDED.error_summary;
  `;

  try {
    await runIntrospectionSql(sql);
  } catch (err) {
    console.warn(`[invariant_status] Échec d'écriture pour ${key} (n'affecte pas le résultat du test) : ${err.message}`);
  }
});

/**
 * Les 6 invariants de sécurité — voir docs/invariants-securite.md pour
 * l'explication en français simple de chacun, et quoi faire quand il
 * échoue. Conçus pour tourner en CI et bloquer le déploiement.
 *
 * Invariants 1-4 interrogent la base réelle (information_schema, pg_catalog,
 * storage.buckets) — non exposés via PostgREST/clé anon, donc impossible à
 * vérifier avec un client supabase-js normal. On passe par la CLI Supabase
 * (connexion privilégiée, hors authenticated/anon), seule façon honnête de
 * les tester : pas une simulation, une vraie requête contre la vraie base.
 * Invariants 5-6 sont de l'analyse statique du dépôt (aucune Server Action
 * dans ce projet — uniquement des Route Handlers, le vrai équivalent
 * "endpoint public" ici, cf. commentaire de l'invariant 5).
 */

function listFilesRecursive(dir, extensions) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      results = results.concat(listFilesRecursive(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const SRC_DIR = path.resolve(__dirname, "../../src");

test.describe("Invariants de sécurité", () => {
  test("Invariant 1 — aucun GRANT de table UPDATE/DELETE non justifié sur authenticated/anon", async () => {
    // Liste blanche VOLONTAIREMENT vide pour ce premier passage (Arrêt 1,
    // demande explicite : voir l'ampleur exacte sans filtrage). À peupler
    // table par table dans docs/grants-matrix.md une fois chaque cas
    // examiné, jamais en bloc.
    const JUSTIFIED = new Set([
      // format : "table_name:grantee:privilege_type"
    ]);

    const rows = await runIntrospectionSql(`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema='public' AND grantee IN ('authenticated','anon')
      AND privilege_type IN ('UPDATE','DELETE')
      ORDER BY table_name, grantee, privilege_type;
    `);

    const unjustified = rows.filter((r) => !JUSTIFIED.has(`${r.table_name}:${r.grantee}:${r.privilege_type}`));

    if (unjustified.length > 0) {
      console.log(`\n[INVARIANT 1] ${unjustified.length} GRANT(s) non justifié(s) :`);
      for (const r of unjustified) console.log(`  - ${r.table_name} : ${r.privilege_type} accordé à ${r.grantee}`);
    }

    expect(unjustified, "GRANT de table UPDATE/DELETE non justifié — voir la liste ci-dessus (console)").toEqual([]);

    // Volet DEFAULT PRIVILEGES (2026-08-07) : la faille structurelle qui a
    // rendu ce genre de GRANT possible SANS qu'aucune ligne n'apparaisse
    // dans une migration — chaque nouvelle table/fonction/séquence créée
    // par le rôle postgres héritait silencieusement de droits complets
    // pour anon/authenticated (corrigé par
    // 20260807130000_fix_default_privileges_public_schema.sql). Vérifié
    // ici pour que toute régression future (quelqu'un qui re-largit ces
    // défauts) fasse échouer CE test, pas seulement les tables déjà
    // créées.
    //
    // Scope volontairement limité au rôle `postgres` : c'est le seul par
    // lequel ce projet crée des objets (règle "jamais db push, toujours
    // via migration CLI", docs/regle-migrations.md — la connexion CLI
    // authentifie toujours en tant que postgres). `supabase_admin` a le
    // même défaut trop large mais reste hors de portée : la connexion
    // postgres n'a pas la permission de modifier les default privileges
    // d'un autre rôle (testé, "permission denied to change default
    // privileges") — seul un accès Supabase Dashboard/support pourrait le
    // faire, et le Dashboard n'est de toute façon jamais utilisé pour créer
    // du schéma dans ce projet. Documenté, pas ignoré : si ça change un
    // jour, il faudra revisiter ce scope.
    const defaultAclRows = await runIntrospectionSql(`
      SELECT
        pg_get_userbyid(d.defaclrole) AS owner_role,
        CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'S' THEN 'SEQUENCES' ELSE d.defaclobjtype::text END AS object_type,
        d.defaclacl::text AS raw_acl
      FROM pg_default_acl d
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
      WHERE n.nspname = 'public' AND pg_get_userbyid(d.defaclrole) = 'postgres';
    `);

    const defaultAclViolations = defaultAclRows.filter((r) => {
      // FUNCTIONS : authenticated=X est volontairement préservé (voir la
      // migration de correction) — seul anon=X (ou plus) est une violation.
      if (r.object_type === "FUNCTIONS") return /anon=/.test(r.raw_acl);
      // TABLES / SEQUENCES : ni anon ni authenticated ne doivent apparaître.
      return /anon=/.test(r.raw_acl) || /authenticated=/.test(r.raw_acl);
    });

    if (defaultAclViolations.length > 0) {
      console.log(`\n[INVARIANT 1] ${defaultAclViolations.length} DEFAULT PRIVILEGES trop large(s) sur le schéma public (rôle postgres) :`);
      for (const r of defaultAclViolations) console.log(`  - ${r.object_type} : ${r.raw_acl}`);
    }

    expect(
      defaultAclViolations,
      "ALTER DEFAULT PRIVILEGES trop permissif détecté sur public (rôle postgres) — voir la liste ci-dessus (console)"
    ).toEqual([]);
  });

  test("Correctif DEFAULT PRIVILEGES (2026-08-07) — une table nouvellement créée n'hérite plus de droits anon/authenticated", async () => {
    // Preuve empirique, pas juste une lecture de config : crée une VRAIE
    // table via la même connexion privilégiée (rôle postgres) que toute
    // migration de ce projet, puis vérifie ses grants réels — c'est ce qui
    // aurait échoué avant 20260807130000_fix_default_privileges_public_schema.sql
    // (la table aurait hérité de arwdDxtm pour anon ET authenticated sans
    // aucun GRANT explicite).
    const tableName = `_test_default_privileges_probe_${Date.now()}`;

    try {
      await runIntrospectionSql(`CREATE TABLE public.${tableName} (id UUID PRIMARY KEY DEFAULT gen_random_uuid());`);

      const rows = await runIntrospectionSql(`
        SELECT grantee, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = '${tableName}' AND grantee IN ('anon', 'authenticated')
        ORDER BY grantee, privilege_type;
      `);

      if (rows.length > 0) {
        console.log(`\n[DEFAULT PRIVILEGES] Table de test ${tableName} a hérité de droits non voulus :`);
        for (const r of rows) console.log(`  - ${r.grantee} : ${r.privilege_type}`);
      }

      expect(
        rows,
        "Une table nouvellement créée hérite encore de droits anon/authenticated — le correctif DEFAULT PRIVILEGES n'est pas (ou plus) actif."
      ).toEqual([]);
    } finally {
      await runIntrospectionSql(`DROP TABLE IF EXISTS public.${tableName};`);
    }
  });

  test("Invariant 2 — aucune table sans protection (RLS désactivé, ou RLS activé + 0 policy non justifié)", async () => {
    const JUSTIFIED_ZERO_POLICY = new Set([
      "ai_usage_daily", // service_role uniquement par design, aucune policy authenticated n'a jamais existé
      // Lecture ET écriture exclusivement via record_cv_consultations()/
      // get_cv_quota_today() (SECURITY DEFINER) — jamais un SELECT/INSERT
      // direct, même pour un admin. Voir 20260806150000_cv_consultations_quota.sql.
      "cv_consultations",
      // Base de connaissances FAQ de l'assistant vocal : lecture ET écriture
      // exclusivement via service_role (route API admin avec isCallerAdmin,
      // et /api/voice-assistant pour l'injection dans le SYSTEM_PROMPT) —
      // jamais de RLS/GRANT authenticated, même pour l'admin. Voir
      // 20260821100000_assistant_faq.sql.
      "assistant_faq",
      // Config + catalogue de l'onglet admin "Entraînement IA" (Agent IA
      // Facilité) : même principe que assistant_faq, lecture/écriture
      // exclusivement via service_role et une route API admin dédiée. Voir
      // 20260821130000_assistant_ai_studio.sql.
      "assistant_ai_config",
      "assistant_ai_products",
      // État de la machine à états du tunnel CV (étape en cours par
      // candidat) : bookkeeping interne au pipeline /api/ai-chat,
      // lu/écrit exclusivement via service_role, jamais par le client. Voir
      // 20260822180000_assistant_conversation_state.sql.
      "assistant_conversation_state",
    ]);

    const rows = await runIntrospectionSql(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, count(p.polname) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policy p ON p.polrelid = c.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      GROUP BY c.relname, c.relrowsecurity
      ORDER BY c.relname;
    `);

    const violations = rows.filter((r) => {
      if (r.rls_enabled !== true) return true;
      if (Number(r.policy_count) === 0 && !JUSTIFIED_ZERO_POLICY.has(r.table_name)) return true;
      return false;
    });

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 2] ${violations.length} table(s) non protégée(s) :`);
      for (const r of violations) {
        console.log(`  - ${r.table_name} : rls_enabled=${r.rls_enabled}, policy_count=${r.policy_count}`);
      }
    }

    expect(violations, "Table sans RLS ou RLS+0 policy non justifié — voir la liste ci-dessus (console)").toEqual([]);
  });

  test("Invariant 3 — aucune fonction SECURITY DEFINER sans search_path figé", async () => {
    const rows = await runIntrospectionSql(`
      SELECT p.proname,
        (SELECT count(*) FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%') AS has_search_path
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true
      ORDER BY p.proname;
    `);

    const violations = rows.filter((r) => Number(r.has_search_path) === 0);

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 3] ${violations.length} fonction(s) SECURITY DEFINER sans search_path :`);
      for (const r of violations) console.log(`  - ${r.proname}`);
    }

    expect(violations, "Fonction SECURITY DEFINER sans search_path — voir la liste ci-dessus (console)").toEqual([]);
  });

  test("Invariant 4 — aucun bucket Storage public non justifié", async () => {
    // RÈGLE, pas une suggestion (incident 2026-08-06,
    // docs/incident-2026-08-06.md) : un bucket qui contient — ou pourrait un
    // jour contenir — une donnée personnelle (CV, pièce jointe de
    // messagerie, document de badge, facture, photo de profil non publique
    // par choix de l'utilisateur...) NE PEUT JAMAIS figurer dans cette
    // liste blanche, quelle que soit la justification invoquée. `public`
    // rend l'objet accessible par URL directe SANS PASSER PAR LA RLS, même
    // si des policies "own-only" existent sur storage.objects — ces
    // policies deviennent alors décoratives, exactement le piège qui a
    // laissé 45 CV réels exposés une semaine (`resumes`, public depuis sa
    // création le 2026-07-27, jamais ajouté ici, jamais corrigé). Seuls des
    // buckets dont le contenu est déjà et délibérément public par nature
    // (visuel marketing, logo, image de listing) peuvent y figurer.
    //
    // Liste blanche actuelle, ligne par ligne :
    //   - "job-offers" : visuels/bannières d'offres d'emploi. Uploadés par
    //     un recruteur badgé (policy INSERT dédiée), affichés publiquement
    //     sur les pages d'offres pour tout visiteur anonyme — c'est leur
    //     fonction. Aucune donnée personnelle de candidat n'y transite.
    //
    // "resumes" n'a PLUS vocation à jamais y figurer, même temporairement :
    // s'il redevient public un jour, ce test doit rester rouge.
    const JUSTIFIED_PUBLIC_BUCKETS = new Set(["job-offers"]);

    const rows = await runIntrospectionSql(`SELECT id, public FROM storage.buckets ORDER BY id;`);
    const violations = rows.filter((r) => r.public === true && !JUSTIFIED_PUBLIC_BUCKETS.has(r.id));

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 4] ${violations.length} bucket(s) public(s) non justifié(s) :`);
      for (const r of violations) console.log(`  - ${r.id}`);
    }

    expect(violations, "Bucket Storage public non justifié — voir la liste ci-dessus (console)").toEqual([]);
  });

  test("Invariant 5 — aucun endpoint public (Route Handler / Server Action) sans contrôle d'autorisation", () => {
    // Ce dépôt n'utilise aucune Server Action ("use server") — uniquement
    // des Route Handlers (src/app/api/**/route.js), le vrai équivalent
    // "endpoint public" ici : appelables directement par quiconque connaît
    // l'URL, exactement comme une Server Action. On les analyse toutes les
    // deux au cas où une Server Action apparaîtrait dans une future PR.
    const serverActionFiles = listFilesRecursive(SRC_DIR, [".js", ".jsx"]).filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return content.includes('"use server"') || content.includes("'use server'");
    });

    const routeHandlerFiles = listFilesRecursive(SRC_DIR, [".js"]).filter((f) => f.endsWith("route.js"));

    const AUTH_MARKERS = ["requireUser", "getUserFromCookies", "CRON_SECRET", "signature", "Signature", "isCallerAdmin"];

    // Liste blanche pour les endpoints délibérément publics par nature (pas
    // un oubli) — décision écrite, jamais un faux marqueur d'autorisation
    // ajouté juste pour faire taire ce test. Format : chemin relatif depuis
    // la racine du dépôt.
    const JUSTIFIED = new Set([
      // Point d'échange du code OAuth PKCE (Google, via signInWithOAuth) —
      // atteint AVANT qu'une session existe, par construction : c'est cette
      // route qui CRÉE la session (exchangeCodeForSession), elle ne peut
      // donc pas exiger un utilisateur déjà authentifié. Le "code" fourni
      // en query string, vérifié côté serveur par Supabase lui-même
      // (auth.exchangeCodeForSession), est le contrôle réel ici — pas un
      // cookie de session préexistant. Décision écrite le 2026-08-17.
      "src/app/auth/callback/route.js",
    ]);

    const unprotected = [...serverActionFiles, ...routeHandlerFiles].filter((f) => {
      const relPath = path.relative(path.resolve(__dirname, "../.."), f).replace(/\\/g, "/");
      if (JUSTIFIED.has(relPath)) return false;
      const content = fs.readFileSync(f, "utf-8");
      return !AUTH_MARKERS.some((marker) => content.includes(marker));
    });

    if (unprotected.length > 0) {
      console.log(`\n[INVARIANT 5] ${unprotected.length} endpoint(s) sans marqueur d'autorisation détecté :`);
      for (const f of unprotected) console.log(`  - ${path.relative(path.resolve(__dirname, "../.."), f)}`);
    }

    expect(unprotected, "Endpoint public sans contrôle d'autorisation détecté — voir la liste ci-dessus (console)").toEqual([]);
  });

  test("Invariant 6 — aucun usage de service_role sans filtrage manuel apparent", () => {
    const files = listFilesRecursive(SRC_DIR, [".js"]).filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return content.includes("getSupabaseAdmin") && !f.endsWith("supabaseAdmin.js"); // exclut le fichier qui définit la fonction elle-même
    });

    // Heuristique, pas une preuve sémantique complète : vérifie la présence
    // d'un marqueur de scoping par utilisateur à proximité de l'usage
    // service_role. Un fichier qui échoue ici doit être relu à la main, pas
    // automatiquement corrigé.
    const SCOPE_MARKERS = ["user.id", "user_id", "userId", "auth.uid", "target_user_id", "actor_id"];

    // Liste blanche pour les opérations SYSTÈME légitimement non scopées à
    // un utilisateur (purge en masse, maintenance planifiée) — pas une
    // lecture/écriture ciblée qui aurait dû être filtrée. Format : chemin
    // relatif depuis la racine du dépôt.
    const JUSTIFIED = new Set([
      // Purge quotidienne (cron, CRON_SECRET) de l'IP de TOUTES les entrées
      // security_logs de plus de 30 jours — 4B du chantier du 2026-08-06,
      // docs/incident-2026-08-06.md. Opération système par nature, jamais
      // ciblée sur un utilisateur précis ; ajouter un faux marqueur
      // user_id juste pour passer ce test serait malhonnête.
      "src/app/api/cron/purge-access-log-ips/route.js",
    ]);

    const unscoped = files.filter((f) => {
      const relPath = path.relative(path.resolve(__dirname, "../.."), f).replace(/\\/g, "/");
      if (JUSTIFIED.has(relPath)) return false;
      const content = fs.readFileSync(f, "utf-8");
      return !SCOPE_MARKERS.some((marker) => content.includes(marker));
    });

    if (unscoped.length > 0) {
      console.log(`\n[INVARIANT 6] ${unscoped.length} fichier(s) service_role sans marqueur de scoping détecté :`);
      for (const f of unscoped) console.log(`  - ${path.relative(path.resolve(__dirname, "../.."), f)}`);
    }

    expect(unscoped, "Usage service_role sans filtrage manuel apparent — voir la liste ci-dessus (console)").toEqual([]);
  });

  test("Invariant 7 — aucune policy RLS permissive tautologique (public + storage), ni référence à un rôle obsolète", async () => {
    // Liste blanche VOLONTAIREMENT vide pour le premier passage — demande
    // explicite : voir l'ampleur exacte avant toute décision. Format :
    // "schema.table:policyname". Une lecture réellement publique peut être
    // légitime, mais ça doit être un choix écrit ici, pas un accident.
    const JUSTIFIED = new Set([
      // Page vitrine entreprise (/recruteurs/[id]), publique par nature :
      // company_name/sector/location/logo_url/banner_url/description/website,
      // aucune colonne personnelle ou sensible. Décision écrite le 2026-08-03.
      "public.recruiter_profiles:Lecture publique des profils recruteurs",
      // Annuaire public (pharmacies/hôpitaux/hôtels) : name/address/phone/
      // email d'ÉTABLISSEMENTS (entreprises), aucune donnée personnelle
      // d'individu — comparable à recruiter_profiles ci-dessus. GRANT
      // UPDATE/DELETE anon/authenticated retiré séparément (incident
      // 2026-08-06, docs/incident-2026-08-06.md) : seule la LECTURE reste
      // ouverte, ce qui est le but d'un annuaire.
      "public.establishments:Lecture publique de l'annuaire",
      // Indicateurs de fonctionnalités (panneau admin /admin) : enabled/roles
      // par route, lus par le middleware (src/proxy.js) et Header.jsx pour
      // décider si une fonctionnalité est disponible — doit être lisible par
      // TOUT visiteur (authentifié ou non) pour que le contrôle d'accès
      // fonctionne avant même la connexion. Aucune donnée personnelle
      // (id/path/enabled/roles sont des métadonnées de configuration, pas des
      // données utilisateur). Écriture verrouillée à l'admin via
      // current_user_role() (policy UPDATE séparée). Décision écrite le
      // 2026-08-17, migration 20260817000000_feature_flags_table.sql.
      "public.feature_flags:Lecture publique des indicateurs de fonctionnalites",
    ]);

    const rows = await runIntrospectionSql(`
      SELECT schemaname, tablename, policyname, permissive, roles::text[] AS roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname IN ('public','storage')
      ORDER BY schemaname, tablename, policyname;
    `);

    // Tautologie stricte : USING ou WITH CHECK vaut littéralement true (ou un
    // équivalent trivial). Les policies pour service_role seul sont ignorées
    // — ce rôle bypass la RLS de toute façon, une policy dessus ne change
    // rien à la surface d'exposition réelle.
    const isTautological = (expr) => {
      if (!expr) return false;
      const normalized = expr.trim().toLowerCase();
      return normalized === "true" || normalized === "(true)" || /^\(?\s*1\s*=\s*1\s*\)?$/.test(normalized);
    };

    // Motif exact du bug trouvé deux fois (job_offers, chat-attachments) :
    // un bucket_id vérifié seul, sans restriction de dossier/propriétaire —
    // n'importe quel authenticated écrit/lit n'importe où dans le bucket.
    const isBucketOnly = (expr) => {
      if (!expr) return false;
      return /^\(bucket_id = '[^']+'::text\)$/.test(expr.trim());
    };

    const violations = rows.filter((r) => {
      const roles = r.roles || [];
      const onlyServiceRole = roles.length === 1 && roles[0] === "service_role";
      if (onlyServiceRole) return false;
      if (r.permissive !== "PERMISSIVE") return false; // RESTRICTIVE se combine en ET, pas en OU : pas le même risque

      const flagged =
        isTautological(r.qual) || isTautological(r.with_check) || isBucketOnly(r.qual) || isBucketOnly(r.with_check);
      if (!flagged) return false;

      return !JUSTIFIED.has(`${r.schemaname}.${r.tablename}:${r.policyname}`);
    });

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 7] ${violations.length} policy(ies) permissive(s) tautologique(s) :`);
      for (const r of violations) {
        console.log(`  - ${r.schemaname}.${r.tablename} : "${r.policyname}" (${r.cmd}, roles=${(r.roles || []).join(",")})`);
        console.log(`      USING: ${r.qual}`);
        console.log(`      CHECK: ${r.with_check}`);
      }
    }

    expect(
      violations,
      "Policy RLS permissive tautologique — voir la liste ci-dessus (console)"
    ).toEqual([]);

    // Étape A du chantier (2026-08-03) : le modèle de rôle pré-RBAC
    // (candidat/recruteur/agent/entreprise) a été remplacé par
    // user/publisher/admin + badges (20260802050000_rbac_user_roles.sql).
    // Deux policies Storage référençant encore 'recruteur' sont restées
    // invisibles jusqu'à un scan manuel dédié — trouvées deux fois dans ce
    // chantier (docs/diagnostic-2026-08.md, puis ici) : c'est la classe de
    // bug que cette section détecte automatiquement désormais, sur toute
    // policy ET toute fonction, pas seulement celles déjà connues.
    const OBSOLETE_ROLE_LITERAL = /'(candidat|recruteur|agent|entreprise)'/;
    const JUSTIFIED_ROLE_LITERAL = new Set([
      // format : "policy:schema.table:policyname" ou "function:proname"
    ]);

    const policyRoleViolations = rows.filter((r) => {
      const text = `${r.qual || ""} ${r.with_check || ""}`;
      return OBSOLETE_ROLE_LITERAL.test(text) && !JUSTIFIED_ROLE_LITERAL.has(`policy:${r.schemaname}.${r.tablename}:${r.policyname}`);
    });

    const functionRows = await runIntrospectionSql(`
      SELECT p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f','p');
    `);
    const functionRoleViolations = functionRows.filter(
      (r) => OBSOLETE_ROLE_LITERAL.test(r.def || "") && !JUSTIFIED_ROLE_LITERAL.has(`function:${r.proname}`)
    );

    const roleLiteralViolations = [
      ...policyRoleViolations.map((r) => `policy ${r.schemaname}.${r.tablename}:"${r.policyname}"`),
      ...functionRoleViolations.map((r) => `fonction public.${r.proname}()`),
    ];

    if (roleLiteralViolations.length > 0) {
      console.log(`\n[INVARIANT 7] ${roleLiteralViolations.length} référence(s) à un rôle obsolète (candidat/recruteur/agent/entreprise) :`);
      for (const v of roleLiteralViolations) console.log(`  - ${v}`);
    }

    expect(
      roleLiteralViolations,
      "Policy ou fonction référençant un rôle du modèle pré-RBAC, qui n'existe plus — voir la liste ci-dessus (console)"
    ).toEqual([]);
  });

  test("Invariant 8 — aucune garde de rôle/statut fragile face à NULL (SQL <>/!= au lieu de IS DISTINCT FROM)", async () => {
    // NULL <> 'admin' vaut NULL (ni vrai ni faux) en SQL — un `IF` sur ce
    // résultat ne se déclenche JAMAIS, laissant passer silencieusement
    // l'action censée être bloquée. Bug trouvé et corrigé sur 4 fonctions
    // (approve_badge_request, reject_badge_request, revoke_badge,
    // moderate_job_offer — 20260803050000_fix_null_unsafe_admin_checks.sql)
    // dès que current_user_role() a pu renvoyer NULL (compte suspendu). Ce
    // volet scanne TOUTE fonction SECURITY DEFINER pour la même classe de
    // comparaison, pas seulement les 4 cas déjà connus.
    const JUSTIFIED_SQL_GUARD = new Set([
      // auth.role() et current_user sont des GUC de session PostgreSQL —
      // toujours peuplés par PostgREST pour un appel API réel (jamais NULL
      // sous le modèle de menace "appel direct à la clé anon"), contrairement
      // à current_user_role() qui dépend d'une jointure user_roles pouvant
      // légitimement ne renvoyer aucune ligne pour un compte suspendu. Pas la
      // même classe de risque. Décision écrite le 2026-08-03.
      "function:prevent_order_status_spoofing",
      "function:protect_cosmetic_columns",
    ]);

    const secdefRows = await runIntrospectionSql(`
      SELECT n.nspname AS schema, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true AND p.prokind IN ('f','p')
      ORDER BY p.proname;
    `);

    const unsafeComparison = /(<>|!=)\s*'[^']*'|'[^']*'\s*(<>|!=)/;
    const sqlGuardViolations = secdefRows.filter(
      (r) => unsafeComparison.test(r.def) && !JUSTIFIED_SQL_GUARD.has(`function:${r.proname}`)
    );

    if (sqlGuardViolations.length > 0) {
      console.log(`\n[INVARIANT 8] ${sqlGuardViolations.length} fonction(s) SECURITY DEFINER avec une comparaison <>/!= fragile face à NULL :`);
      for (const r of sqlGuardViolations) console.log(`  - public.${r.proname}() — remplacer par IS DISTINCT FROM`);
    }

    expect(
      sqlGuardViolations,
      "Fonction SECURITY DEFINER utilisant <>/!= au lieu de IS DISTINCT FROM pour une comparaison de rôle/statut — voir la liste ci-dessus (console)"
    ).toEqual([]);

    // Volet JS : contrairement à SQL, `===`/`!==` traitent null/undefined
    // sans ambiguïté (pas de logique ternaire) — un scan mot-à-mot de tout
    // `.role`/`.status` dans src/ produirait surtout du bruit (statut d'un
    // message de chat, d'une pièce jointe OCR, etc., aucun rapport avec
    // l'autorisation). Le vrai bug JS trouvé (isCallerAdmin, src/lib/rbac.js)
    // n'était pas une comparaison NULL-fragile mais un contrôle OMIS (role
    // vérifié, status oublié) — sur les routes admin qui écrivent en
    // service_role, donc HORS RLS : ce fichier est la seule barrière réelle.
    // On pin donc précisément sa complétude plutôt que de scanner un pattern
    // qui n'est pas dangereux en JS.
    const rbacSource = fs.readFileSync(path.resolve(__dirname, "../../src/lib/rbac.js"), "utf-8");
    const checksRole = /role\s*===\s*['"]admin['"]/.test(rbacSource);
    const checksStatus = /status\s*===\s*['"]active['"]/.test(rbacSource);
    const guardsNullRow = /if\s*\(\s*error\s*\|\|\s*!data\s*\)/.test(rbacSource);

    if (!checksRole || !checksStatus || !guardsNullRow) {
      console.log(
        `\n[INVARIANT 8] src/lib/rbac.js isCallerAdmin() incomplet : checksRole=${checksRole}, checksStatus=${checksStatus}, guardsNullRow=${guardsNullRow}`
      );
    }

    expect(
      checksRole && checksStatus && guardsNullRow,
      "isCallerAdmin() (src/lib/rbac.js) doit vérifier role ET status, et se refermer sur une ligne absente/en erreur — c'est la seule barrière des routes admin qui écrivent en service_role, hors RLS."
    ).toBe(true);
  });

  test("Invariant 10 — aucune fonction ni déclencheur (public, ou auth.users) absent de toute migration", async () => {
    // Générique, pas une liste de 4 noms en dur : c'est exactement la classe
    // de bug qui a laissé auto_confirm_user() invisible pendant des jours
    // (créée directement dans l'éditeur SQL du Dashboard, jamais dans une
    // migration — voir docs/diagnostic-2026-08.md). Toute fonction public.*
    // ou déclencheur sur public.*/auth.users dont le nom n'apparaît dans
    // AUCUN fichier de supabase/migrations est suspect : soit créé hors
    // migration (à rapatrier), soit mort et jamais nettoyé.
    const JUSTIFIED = new Set([
      // format : "function:proname" ou "trigger:schema.table:tgname"
    ]);

    const functions = await runIntrospectionSql(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
      ORDER BY p.proname;
    `);

    const triggers = await runIntrospectionSql(`
      SELECT t.tgname, c.relnamespace::regnamespace::text AS schema_name, c.relname AS table_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal
        AND (c.relnamespace::regnamespace::text = 'public'
          OR (c.relnamespace::regnamespace::text = 'auth' AND c.relname = 'users'))
      ORDER BY t.tgname;
    `);

    const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const allMigrationsText = migrationFiles.map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf-8")).join("\n");

    const orphanFunctions = functions.filter(
      (f) => !allMigrationsText.includes(f.proname) && !JUSTIFIED.has(`function:${f.proname}`)
    );
    const orphanTriggers = triggers.filter(
      (t) => !allMigrationsText.includes(t.tgname) && !JUSTIFIED.has(`trigger:${t.schema_name}.${t.table_name}:${t.tgname}`)
    );

    const violations = [
      ...orphanFunctions.map((f) => `fonction public.${f.proname}()`),
      ...orphanTriggers.map((t) => `trigger ${t.schema_name}.${t.table_name}:${t.tgname}`),
    ];

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 10] ${violations.length} objet(s) en base absent(s) de toute migration :`);
      for (const v of violations) console.log(`  - ${v}`);
    }

    expect(
      violations,
      "Fonction/déclencheur en base introuvable dans les migrations — probablement créé via le Dashboard, jamais tracé. Voir console."
    ).toEqual([]);
  });

  test("Invariant 11 — aucun lien de navigation ni gate conditionné à un rôle obsolète dans le frontend", async () => {
    // Trois fois la même classe de bug a cassé le projet :
    // 1) le lien Admin conditionné à profiles.role='admin' (corrigé étape A)
    // 2) les policies Storage conditionnées à role='recruteur' (corrigé étape A)
    // 3) le lien Recruteur conditionné à profileRole==='recruteur' (corrigé ici)
    //
    // Ce test scanne tous les fichiers .js/.jsx de src/ pour les littéraux
    // de rôle obsolètes utilisés dans des CONDITIONS (=== / !==), en excluant
    // les usages légitimes :
    // - RoleBadge role="candidat" (composant décoratif, pas un gate)
    // - Commentaires (// ou /* */)
    // - Le toggle candidat/recruteur de register/page.js (état local UI,
    //   jamais envoyé au serveur — voir lignes 52-58 du fichier)
    // - Filtres admin qui utilisent le badge pour classifier (effectiveRole)
    // - Littéraux dans des chaînes de texte UI (labels, placeholders)

    // "entreprise" ajouté ici (Partie 9 du chantier du 2026-08-06,
    // docs/incident-2026-08-06.md) : 4e littéral du modèle pré-RBAC (avec
    // candidat/recruteur/agent, cf. Invariant 7 volet 2), absent de cette
    // liste jusqu'ici — aucune violation active trouvée en le cherchant,
    // mais un futur `=== "entreprise"` doit être détecté comme les 3 autres.
    const OBSOLETE_ROLE_LITERALS = ["recruteur", "candidat", "agent", "entreprise"];

    // Deux formes de gate à détecter, pas une seule (élargi le 2026-08-06
    // après avoir constaté qu'aucune des deux formes suivantes n'était
    // couverte alors qu'elles auraient laissé passer exactement la même
    // classe de bug sous une syntaxe différente) :
    //   1) comparaison directe : quelque chose ==/===/!=/!== "recruteur"
    //   2) test d'appartenance : [...].includes("recruteur") ou
    //      "recruteur" === (quelque chose).find(...) — en pratique on ne
    //      cherche que .includes(...) ici, la forme réellement utilisée
    //      dans ce dépôt pour les tableaux de badges/rôles.
    const GATE_PATTERNS = OBSOLETE_ROLE_LITERALS.flatMap((role) => [
      new RegExp(`(?:===|!==|==|!=)\\s*["']${role}["']|["']${role}["']\\s*(?:===|!==|==|!=)`, "g"),
      new RegExp(`\\.includes\\(\\s*["']${role}["']\\s*\\)`, "g"),
    ]);

    // Fichiers/lignes explicitement justifiés (faux positifs connus)
    const JUSTIFIED = new Set([
      // register/page.js : le toggle candidat/recruteur est un état local
      // purement UI, jamais transmis au backend (voir commentaire lignes 52-58)
      "app/register/page.js",
      // admin/messages/page.js : filterRole est un état local UI pour
      // classifier l'affichage par badge, pas un gate d'autorisation.
      "app/admin/messages/page.js",
      // RoleBadge.jsx : composant décoratif, pas un gate
      "RoleBadge.jsx",
    ]);

    const srcDir = path.resolve(__dirname, "../../src");
    const files = listFilesRecursive(srcDir, [".js", ".jsx"]);

    const violations = [];

    for (const filePath of files) {
      const basename = path.basename(filePath);
      const relPath = path.relative(srcDir, filePath).replace(/\\/g, "/");

      // Skip justified files entirely
      if (JUSTIFIED.has(basename) || JUSTIFIED.has(relPath)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comment lines
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

        for (const pattern of GATE_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            // Check it's not inside a comment on the same line
            const commentIdx = line.indexOf("//");
            const matchIdx = line.search(pattern);
            if (commentIdx >= 0 && matchIdx > commentIdx) continue;

            violations.push(`${relPath}:${i + 1} → ${trimmed.substring(0, 120)}`);
          }
        }
      }
    }

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 11] ${violations.length} gate(s) conditionné(s) à un rôle obsolète :`);
      for (const v of violations) console.log(`  - ${v}`);
    }

    expect(
      violations,
      "Gate conditionné à un rôle obsolète ('recruteur'/'candidat'/'agent'/'entreprise') trouvé dans le frontend. " +
        "Depuis le chantier RBAC, ces littéraux n'existent plus dans user_roles — utiliser " +
        "has_badge() ou profileBadges.includes('verified_recruiter'/'official_staff') à la place. Voir console."
    ).toEqual([]);
  });

  test("Invariant 12 — aucun compte de test avec role='admin' en base, hors liste blanche explicite", async () => {
    // Trouvé le 2026-08-06/07 (docs/etat-du-projet.md) : les 24 comptes
    // is_test_account=true en base étaient TOUS role='admin', y compris des
    // comptes explicitement nommés "candidat" (demo-candidat-1..10) sans
    // aucune raison d'avoir un accès administrateur complet. Origine
    // probable : supabase/seed.sql exécuté au moins une fois contre
    // production malgré son propre avertissement contraire. Corrigé par
    // 20260807090000_fix_test_account_roles.sql — cet invariant empêche que
    // ça se reproduise silencieusement.
    const JUSTIFIED = new Set([
      // Seul compte réellement utilisé comme persona admin dans tests/
      // (grep exhaustif sur ADMIN_EMAIL) — voir la migration ci-dessus pour
      // le détail de la vérification.
      "e2e-test-admin@facilite-demo.local",
    ]);

    const rows = await runIntrospectionSql(`
      SELECT u.email
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      JOIN public.user_roles ur ON ur.user_id = u.id
      WHERE (u.email ILIKE '%test%' OR p.is_test_account = true)
        AND ur.role = 'admin';
    `);

    const violations = rows.filter((r) => !JUSTIFIED.has(r.email));

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 12] ${violations.length} compte(s) de test avec role='admin' non justifié :`);
      for (const r of violations) console.log(`  - ${r.email}`);
    }

    expect(
      violations,
      "Compte de test avec role='admin' non justifié — voir la liste ci-dessus (console). " +
        "Un compte de test doit avoir le rôle minimal nécessaire à ce qu'il teste ; si un test a " +
        "réellement besoin d'un persona admin, ajouter l'email à JUSTIFIED avec la justification écrite."
    ).toEqual([]);
  });

  test("Invariant 13 — toute fonction SECURITY DEFINER critique (badges/modération/rôles) a un GRANT EXECUTE actif", async () => {
    // Trouvé le 2026-08-07 : approve_badge_request() avait perdu son GRANT
    // EXECUTE vers authenticated (ses fonctions sœurs reject_badge_request/
    // revoke_badge l'avaient conservé) — plus aucun admin ne pouvait
    // approuver de demande de badge en production, sans qu'aucune alarme ne
    // se déclenche avant qu'un admin l'essaie réellement. Une fonction
    // SECURITY DEFINER sans aucun GRANT vers authenticated/anon est
    // totalement inappelable via PostgREST, quel que soit son code interne.
    //
    // Deux façons d'être couvert par ce test : le nom figure dans
    // CRITICAL_FUNCTIONS (liste vérifiée à la main le 2026-08-07 — badges,
    // modération, rôles/statut), ou il matche un des mots-clés ci-dessous
    // (filet pour une future fonction de même nature jamais ajoutée à la
    // liste). Les deux excluent les fonctions déclencheurs (trigger) — un
    // trigger PostgreSQL invoque sa fonction directement, sans jamais
    // passer par un GRANT authenticated/anon ; en exiger un pour elles
    // serait une exigence qui ne correspond à rien de réel.
    const CRITICAL_FUNCTIONS = new Set([
      "approve_badge_request",
      "reject_badge_request",
      "revoke_badge",
      "moderate_job_offer",
      "current_user_role",
      "current_user_status",
      "is_admin",
      "has_badge",
      "is_authorized_recruiter",
    ]);
    const CRITICAL_NAME_PATTERNS = [/badge/i, /moderat/i, /suspend/i, /\brole\b/i, /revoke/i, /approve/i, /reject/i];

    const TRIGGER_FUNCTIONS = new Set(
      (
        await runIntrospectionSql(`
          SELECT DISTINCT p.proname
          FROM pg_trigger t
          JOIN pg_proc p ON p.oid = t.tgfoid
          WHERE NOT t.tgisinternal;
        `)
      ).map((r) => r.proname)
    );

    const rows = await runIntrospectionSql(`
      SELECT p.proname,
        COALESCE(
          (SELECT jsonb_agg(DISTINCT grantee) FROM information_schema.role_routine_grants g
           WHERE g.routine_schema = 'public' AND g.routine_name = p.proname
             AND g.grantee IN ('authenticated', 'anon')),
          '[]'::jsonb
        ) AS app_grantees
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true;
    `);

    const violations = rows.filter((r) => {
      if (TRIGGER_FUNCTIONS.has(r.proname)) return false;
      const isCritical = CRITICAL_FUNCTIONS.has(r.proname) || CRITICAL_NAME_PATTERNS.some((p) => p.test(r.proname));
      if (!isCritical) return false;
      return (r.app_grantees || []).length === 0;
    });

    if (violations.length > 0) {
      console.log(`\n[INVARIANT 13] ${violations.length} fonction(s) critique(s) sans GRANT EXECUTE actif :`);
      for (const v of violations) console.log(`  - ${v.proname}`);
    }

    expect(
      violations,
      "Fonction SECURITY DEFINER critique sans aucun GRANT EXECUTE vers authenticated/anon — inappelable via " +
        "PostgREST malgré un code interne correct. Voir console."
    ).toEqual([]);
  });
});

