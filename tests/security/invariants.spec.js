const { test, expect } = require("@playwright/test");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

function runIntrospectionSql(sql) {
  const tmpFile = path.join(os.tmpdir(), `invariant-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    const output = execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const parsed = JSON.parse(output.slice(output.indexOf("{")));
    return parsed.rows || [];
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

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

    const rows = runIntrospectionSql(`
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
  });

  test("Invariant 2 — aucune table sans protection (RLS désactivé, ou RLS activé + 0 policy non justifié)", async () => {
    const JUSTIFIED_ZERO_POLICY = new Set([
      "ai_usage_daily", // service_role uniquement par design, aucune policy authenticated n'a jamais existé
    ]);

    const rows = runIntrospectionSql(`
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
    const rows = runIntrospectionSql(`
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
    // job-offers : visuels marketing d'offres, intentionnellement publics.
    // chat-attachments : PAS dans cette liste — risque déjà documenté
    // (docs/audit-securite-2026-08.md, point 113, ÉLEVÉ), volontairement
    // non ajouté ici pour que l'invariant continue de le signaler tant
    // qu'il n'est pas corrigé.
    const JUSTIFIED_PUBLIC_BUCKETS = new Set(["job-offers"]);

    const rows = runIntrospectionSql(`SELECT id, public FROM storage.buckets ORDER BY id;`);
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

    const AUTH_MARKERS = ["requireUser", "CRON_SECRET", "signature", "Signature", "isCallerAdmin"];

    const unprotected = [...serverActionFiles, ...routeHandlerFiles].filter((f) => {
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

    const unscoped = files.filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return !SCOPE_MARKERS.some((marker) => content.includes(marker));
    });

    if (unscoped.length > 0) {
      console.log(`\n[INVARIANT 6] ${unscoped.length} fichier(s) service_role sans marqueur de scoping détecté :`);
      for (const f of unscoped) console.log(`  - ${path.relative(path.resolve(__dirname, "../.."), f)}`);
    }

    expect(unscoped, "Usage service_role sans filtrage manuel apparent — voir la liste ci-dessus (console)").toEqual([]);
  });
});
