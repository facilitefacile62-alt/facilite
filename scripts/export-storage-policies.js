#!/usr/bin/env node
/**
 * Exporte les policies RLS de storage.objects depuis la production —
 * même trou que les GRANTs (schema/table) déjà corrigés :
 * dump-schema-via-introspection.js scope tout à `nspname = 'public'`,
 * jamais `storage`. Lecture seule contre la production, imprime le SQL
 * généré pour relecture avant application manuelle.
 */
const path = require("path");
const { runIntrospectionSql } = require(path.resolve(__dirname, "../tests/helpers/privilegedSql"));

async function main() {
  const rows = await runIntrospectionSql(`
    SELECT 'CREATE POLICY "' || polname || '" ON storage.objects AS ' ||
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
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
    ORDER BY polname;
  `);

  const nullCount = rows.filter((r) => !r.ddl).length;
  if (nullCount > 0) {
    console.error(`\n[ATTENTION] ${nullCount}/${rows.length} policy(ies) avec ddl NULL/vide — ne pas appliquer sans investiguer.`);
  }

  console.log(rows.map((r) => r.ddl).join("\n"));
  console.error(`\n[stderr] ${rows.length} policy(ies) exportée(s).`);
}

main().catch((err) => {
  console.error("ERREUR :", err.message);
  process.exit(1);
});
