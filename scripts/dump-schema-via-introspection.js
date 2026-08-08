#!/usr/bin/env node
/**
 * Remplace `pg_dump --schema-only` (indisponible ici : ni Docker ni binaire
 * pg_dump local) par une reconstitution du schéma via introspection SQL
 * pure contre la production, en lecture seule, via le même mécanisme
 * `supabase db query --linked` utilisé partout ailleurs dans ce dépôt.
 *
 * Ne dump QUE le schéma (aucune donnée). Portée : schéma public + les
 * extensions dont dépendent ses objets + le trigger auth.users ->
 * handle_new_user() (hors public au sens strict, mais indispensable au
 * fonctionnement réel de l'app — sans lui, aucun profil ne se crée à
 * l'inscription sur le projet de test) + les policies storage.objects +
 * les GRANTs (schéma/table/colonne/fonction) + l'appartenance à la
 * publication supabase_realtime — ces 3 dernières catégories manquaient
 * jusqu'au 2026-08-08, cause de 4 vagues de correctifs manuels distinctes
 * sur chaque projet de test recréé depuis ce dump.
 *
 * Ordre généré (comme pg_dump) : extensions -> enums -> tables (colonnes
 * seules) -> contraintes PK/UNIQUE/CHECK -> contraintes FK (différées,
 * pour ignorer l'ordre des dépendances entre tables) -> index autonomes ->
 * RLS (activation + policies public+storage.objects) -> GRANTs (schéma,
 * table, colonne, fonction) -> vues -> fonctions -> triggers -> publication
 * supabase_realtime.
 */

const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function runIntrospectionSql(sql) {
  const tmpFile = path.join(os.tmpdir(), `schema-dump-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  return new Promise((resolve, reject) => {
    exec(
      `npx supabase db query --linked --yes -f "${tmpFile}"`,
      { cwd: REPO_ROOT, encoding: "utf-8", timeout: 60_000, windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
        if (error) return reject(new Error(`échec CLI : ${stderr || error.message}`));
        try {
          resolve(JSON.parse(stdout.slice(stdout.indexOf("{"))).rows || []);
        } catch {
          reject(new Error(`réponse CLI non-JSON : ${stdout.slice(0, 300)}`));
        }
      }
    );
  });
}

// Filet de sécurité générique : une ligne dont ddl est NULL (ex. une
// sous-requête SQL qui échoue silencieusement à résoudre quelque chose,
// comme le bug polroles='{0}' découvert ici) disparaîtrait sans bruit dans
// un simple .join("\n") — un tableau contenant un NULL se joint comme une
// chaîne vide. Ici, on la signale bruyamment au lieu de la laisser filer.
function joinDdl(label, rows) {
  const nullCount = rows.filter((r) => r.ddl == null || r.ddl === "").length;
  if (nullCount > 0) {
    console.warn(`\n⚠️  ${label} : ${nullCount}/${rows.length} ligne(s) avec ddl NULL/vide — investiguer avant de continuer.`);
  }
  return rows.map((r) => r.ddl).filter(Boolean).join("\n");
}

async function main() {
  const sections = [];

  sections.push([
    "-- Extensions",
    `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;`,
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;`,
    `CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;`,
    `CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;`,
  ].join("\n"));

  // Enums
  const enums = await runIntrospectionSql(`
    SELECT t.typname AS name,
      'CREATE TYPE public."' || t.typname || '" AS ENUM (' ||
      string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' AS ddl
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname;
  `);
  if (enums.length) sections.push("-- Enums\n" + joinDdl("Enums", enums));

  // Sequences (avant les tables : une colonne peut avoir DEFAULT
  // nextval('...') qui échoue si la séquence n'existe pas encore)
  const sequences = await runIntrospectionSql(`
    SELECT 'CREATE SEQUENCE IF NOT EXISTS public."' || sequencename || '" START WITH ' || start_value || ' INCREMENT BY ' || increment_by || ';' AS ddl
    FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename;
  `);
  if (sequences.length) sections.push("-- Séquences\n" + joinDdl("Séquences", sequences));

  // Tables (columns only, no constraints)
  const tables = await runIntrospectionSql(`
    SELECT c.relname AS name,
      'CREATE TABLE IF NOT EXISTS public."' || c.relname || '" (' || chr(10) ||
      string_agg(
        '  "' || a.attname || '" ' || format_type(a.atttypid, a.atttypmod) ||
        CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END ||
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        ',' || chr(10) ORDER BY a.attnum
      ) || chr(10) || ');' AS ddl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    GROUP BY c.relname
    ORDER BY c.relname;
  `);
  sections.push("-- Tables (colonnes)\n" + joinDdl("Tables", tables));

  // Non-FK constraints (PK/UNIQUE/CHECK) - safe to apply immediately, no cross-table ordering issue
  const nonFkConstraints = await runIntrospectionSql(`
    SELECT
      'ALTER TABLE public."' || rel.relname || '" ADD CONSTRAINT "' || con.conname || '" ' || pg_get_constraintdef(con.oid) || ';' AS ddl
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p','u','c')
    ORDER BY rel.relname, con.conname;
  `);
  sections.push("-- Contraintes PK / UNIQUE / CHECK\n" + joinDdl("Contraintes PK/UNIQUE/CHECK", nonFkConstraints));

  // FK constraints - deferred until all tables exist
  const fkConstraints = await runIntrospectionSql(`
    SELECT
      'ALTER TABLE public."' || rel.relname || '" ADD CONSTRAINT "' || con.conname || '" ' || pg_get_constraintdef(con.oid) || ';' AS ddl
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public' AND con.contype = 'f'
    ORDER BY rel.relname, con.conname;
  `);
  sections.push("-- Contraintes FOREIGN KEY (différées)\n" + joinDdl("Contraintes FK", fkConstraints));

  // Standalone indexes (not already created by a constraint)
  const indexes = await runIntrospectionSql(`
    SELECT indexdef || ';' AS ddl
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace)
    ORDER BY tablename, indexname;
  `);
  sections.push("-- Index autonomes\n" + joinDdl("Index", indexes));

  // Functions AVANT policies/vues : CREATE POLICY analyse et résout les
  // appels de fonction dans USING/WITH CHECK au moment de la création (pas
  // une simple chaîne opaque comme un corps de fonction plpgsql) — une
  // policy utilisant current_user_role() échouerait si la fonction n'existe
  // pas encore. Les fonctions elles-mêmes n'ont pas ce problème (corps
  // plpgsql non résolu contre le catalogue à la création), donc leur
  // position par rapport aux tables n'a pas d'importance.
  const functions = await runIntrospectionSql(`
    SELECT pg_get_functiondef(p.oid) || ';' AS ddl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);
  sections.push("-- Fonctions\n" + joinDdl("Fonctions", functions));

  // RLS enable
  const rlsEnable = await runIntrospectionSql(`
    SELECT 'ALTER TABLE public."' || c.relname || '" ENABLE ROW LEVEL SECURITY;' AS ddl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    ORDER BY c.relname;
  `);
  sections.push("-- RLS activé\n" + joinDdl("RLS activé", rlsEnable));

  // Policies — public ET storage.objects (schéma qualifié dynamiquement :
  // trouvé le 2026-08-08 que cette section, historiquement scopée à
  // nspname='public', laissait storage.objects entièrement hors du dump,
  // cause de 2 vagues de correctifs manuels sur le projet de test).
  const policies = await runIntrospectionSql(`
    SELECT 'CREATE POLICY "' || polname || '" ON ' || n.nspname || '."' || c.relname || '" AS ' ||
      CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END ||
      ' FOR ' || CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END ||
      ' TO ' || (
        CASE WHEN pol.polroles = '{0}' THEN 'PUBLIC'
        ELSE (SELECT string_agg(rolname, ', ') FROM unnest(pol.polroles) r(oid) JOIN pg_roles ON pg_roles.oid = r.oid) END
      ) ||
      CASE WHEN pol.polqual IS NOT NULL THEN ' USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END ||
      CASE WHEN pol.polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END ||
      ';' AS ddl
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' OR (n.nspname = 'storage' AND c.relname = 'objects')
    ORDER BY n.nspname, c.relname, polname;
  `);
  sections.push("-- Policies RLS (public + storage.objects)\n" + joinDdl("Policies RLS", policies));

  // GRANTs — schéma, table, colonne, fonction : aucune de ces 4 catégories
  // n'était capturée avant le 2026-08-08, cause de 4 vagues de correctifs
  // manuels distinctes sur le projet de test (GRANT USAGE sur schéma,
  // GRANTs de table, GRANTs de colonne, GRANT EXECUTE sur fonction).
  //
  // 1. GRANT USAGE ON SCHEMA — fixe, non introspecté (stable, jamais
  // changé dans ce projet).
  sections.push("-- GRANT USAGE ON SCHEMA\nGRANT USAGE ON SCHEMA public TO anon, authenticated;");

  // 2. GRANTs de table (privilèges non column-scopés — UPDATE traité à
  // part au point 3 pour distinguer whole-table de column-scoped, même
  // logique que scripts/export-table-grants.js).
  const tableGrantsRaw = await runIntrospectionSql(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type;
  `);
  const columnGrantsRaw = await runIntrospectionSql(`
    SELECT table_name, grantee, column_name, privilege_type
    FROM information_schema.role_column_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('UPDATE', 'INSERT')
    ORDER BY table_name, grantee, privilege_type, column_name;
  `);
  const wholeTableUpdate = new Set(
    tableGrantsRaw.filter((r) => r.privilege_type === "UPDATE").map((r) => `${r.table_name}:${r.grantee}`)
  );
  const wholeTableInsert = new Set(
    tableGrantsRaw.filter((r) => r.privilege_type === "INSERT").map((r) => `${r.table_name}:${r.grantee}`)
  );
  const tableGrantStatements = [];
  const nonUpdateByTableGrantee = new Map();
  for (const r of tableGrantsRaw) {
    if (r.privilege_type === "UPDATE") continue;
    const key = `${r.table_name}:${r.grantee}`;
    if (!nonUpdateByTableGrantee.has(key)) nonUpdateByTableGrantee.set(key, []);
    nonUpdateByTableGrantee.get(key).push(r.privilege_type);
  }
  for (const [key, privileges] of nonUpdateByTableGrantee) {
    const [table, grantee] = key.split(":");
    tableGrantStatements.push(`GRANT ${privileges.join(", ")} ON TABLE public."${table}" TO ${grantee};`);
  }
  for (const key of wholeTableUpdate) {
    const [table, grantee] = key.split(":");
    tableGrantStatements.push(`GRANT UPDATE ON TABLE public."${table}" TO ${grantee};`);
  }
  sections.push("-- GRANTs de table\n" + tableGrantStatements.sort().join("\n"));

  // 3. GRANTs de colonne (UPDATE et INSERT restreints à des colonnes
  // précises — jamais dans role_table_grants pour ces cas, seul
  // role_column_grants les révèle). Ignore les couples (table, grantee)
  // déjà couverts par un GRANT whole-table équivalent au point 2, pour ne
  // pas générer une restriction de colonne redondante après un GRANT déjà
  // total sur la même table.
  const colsByTableGranteePriv = new Map();
  for (const r of columnGrantsRaw) {
    const wholeSet = r.privilege_type === "UPDATE" ? wholeTableUpdate : wholeTableInsert;
    const key = `${r.table_name}:${r.grantee}:${r.privilege_type}`;
    if (wholeSet.has(`${r.table_name}:${r.grantee}`)) continue;
    if (!colsByTableGranteePriv.has(key)) colsByTableGranteePriv.set(key, []);
    colsByTableGranteePriv.get(key).push(r.column_name);
  }
  const columnGrantStatements = [];
  for (const [key, cols] of colsByTableGranteePriv) {
    const [table, grantee, privilege] = key.split(":");
    columnGrantStatements.push(`GRANT ${privilege} (${cols.map((c) => `"${c}"`).join(", ")}) ON TABLE public."${table}" TO ${grantee};`);
  }
  sections.push("-- GRANTs de colonne\n" + columnGrantStatements.sort().join("\n"));

  // 4. GRANT EXECUTE sur fonctions — jointure par oid (via specific_name)
  // plutôt que par nom seul : indispensable pour les fonctions surchargées
  // (ex. is_admin() vs is_admin(uuid), qui n'ont pas les mêmes GRANTs —
  // anon a EXECUTE sur la première, pas la seconde). Interroge pg_proc en
  // direct plutôt que de faire confiance à information_schema seul, pour
  // la même raison : disposer de la signature exacte
  // (pg_get_function_identity_arguments) sans ambiguïté entre surcharges.
  // Reflète l'état RÉEL et ACTUEL des GRANTs — une fonction dont le GRANT
  // a été explicitement révoqué (ex. log_security_event() le 2026-08-08)
  // n'a alors plus de ligne dans role_routine_grants et n'apparaît donc
  // jamais ici, sans filtrage supplémentaire nécessaire.
  const functionGrants = await runIntrospectionSql(`
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, g.grantee
    FROM information_schema.routine_privileges g
    JOIN pg_proc p ON g.specific_name = p.proname || '_' || p.oid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND g.routine_schema = 'public'
      AND g.grantee IN ('anon', 'authenticated') AND g.privilege_type = 'EXECUTE'
    ORDER BY p.proname, args, g.grantee;
  `);
  const functionGrantStatements = functionGrants.map(
    (r) => `GRANT EXECUTE ON FUNCTION public."${r.proname}"(${r.args}) TO ${r.grantee};`
  );
  sections.push("-- GRANTs EXECUTE sur fonctions\n" + functionGrantStatements.join("\n"));

  // Views
  const views = await runIntrospectionSql(`
    SELECT 'CREATE OR REPLACE VIEW public."' || c.relname || '" AS ' || pg_get_viewdef(c.oid, true) AS ddl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
    ORDER BY c.relname;
  `);
  sections.push("-- Vues\n" + joinDdl("Vues", views));

  // Triggers on public tables
  const triggersPublic = await runIntrospectionSql(`
    SELECT pg_get_triggerdef(t.oid) || ';' AS ddl
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname;
  `);
  sections.push("-- Triggers (tables public)\n" + joinDdl("Triggers (public)", triggersPublic));

  // Trigger(s) on auth.users calling public functions — hors périmètre strict
  // "public uniquement" mais indispensable (ex. création automatique de
  // profil à l'inscription) : signalé séparément, pas caché dans le reste.
  const triggersAuth = await runIntrospectionSql(`
    SELECT pg_get_triggerdef(t.oid) || ';' AS ddl
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND NOT t.tgisinternal AND pn.nspname = 'public';
  `);
  if (triggersAuth.length) {
    sections.push(
      "-- Triggers sur auth.users appelant une fonction public (hors perimetre strict, ajoute car necessaire au fonctionnement reel)\n" +
        joinDdl("Triggers auth.users", triggersAuth)
    );
  }

  // Publication supabase_realtime — jamais interrogée avant le
  // 2026-08-08, cause d'un projet de test avec une publication vide (0
  // table temps réel) tant que ce n'est pas rejoué manuellement.
  const realtimeTables = await runIntrospectionSql(`
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    ORDER BY tablename;
  `);
  const realtimeStatements = realtimeTables.map(
    (r) => `ALTER PUBLICATION supabase_realtime ADD TABLE public."${r.tablename}";`
  );
  sections.push("-- Publication supabase_realtime\n" + realtimeStatements.join("\n"));

  const output = sections.join("\n\n");
  const outPath = path.join(REPO_ROOT, "scripts", "prod-schema-dump.sql");
  fs.writeFileSync(outPath, output);

  // Sidecar JSON pour l'import : les fonctions LANGUAGE SQL sont résolues
  // contre le catalogue à la création (contrairement à plpgsql, lazy) —
  // l'ordre alphabétique ne respecte pas leurs dépendances mutuelles
  // (ex. une vue-fonction qui appelle has_badge()). L'import les rejoue
  // individuellement en boucle jusqu'à point fixe plutôt qu'en un seul bloc.
  fs.writeFileSync(
    path.join(REPO_ROOT, "scripts", "prod-schema-dump.functions.json"),
    JSON.stringify(functions, null, 2)
  );

  console.log(`Écrit : ${outPath} (${output.split("\n").length} lignes)`);
  console.log(
    `Sections : ${enums.length} enum(s), ${sequences.length} sequence(s), ${tables.length} table(s), ${nonFkConstraints.length} contrainte(s) non-FK, ${fkConstraints.length} FK, ${indexes.length} index, ${rlsEnable.length} table(s) RLS, ${policies.length} policy(ies) (public+storage), ${views.length} vue(s), ${functions.length} fonction(s), ${triggersPublic.length} trigger(s) public, ${triggersAuth.length} trigger(s) auth.users, ${tableGrantStatements.length} GRANT(s) de table, ${columnGrantStatements.length} GRANT(s) de colonne, ${functionGrantStatements.length} GRANT(s) EXECUTE, ${realtimeStatements.length} table(s) Realtime.`
  );
}

main().catch((err) => {
  console.error("ERREUR :", err.message);
  process.exit(1);
});
