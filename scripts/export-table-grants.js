#!/usr/bin/env node
/**
 * Exporte les GRANTs de table réels de la production (anon/authenticated
 * uniquement, schéma public) et génère le SQL équivalent — comble le même
 * trou que GRANT USAGE ON SCHEMA : dump-schema-via-introspection.js ne
 * capture ni les grants de schéma, ni les grants de table.
 *
 * Distingue explicitement UPDATE table-entière (role_table_grants) de
 * UPDATE restreint à des colonnes précises (role_column_grants seul, sans
 * entrée table-entière) — plusieurs tables ont été volontairement
 * restreintes colonne par colonne pendant ce chantier (orders.payment_reference,
 * job_offers sans embedding/archived_at, etc., voir
 * 20260802250000_wave3_update_columns.sql) : régénérer un GRANT UPDATE
 * table-entière ici réouvrirait exactement ce qui a été fermé.
 *
 * Lecture seule contre la production (runIntrospectionSql) — n'écrit rien
 * nulle part, se contente d'imprimer le SQL généré pour relecture avant
 * application manuelle.
 */
const path = require("path");
const { runIntrospectionSql } = require(path.resolve(__dirname, "../tests/helpers/privilegedSql"));

async function main() {
  const tableGrants = await runIntrospectionSql(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee, privilege_type;
  `);

  const columnGrants = await runIntrospectionSql(`
    SELECT table_name, grantee, column_name
    FROM information_schema.role_column_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated') AND privilege_type = 'UPDATE'
    ORDER BY table_name, grantee, column_name;
  `);

  // Whole-table UPDATE déjà présent dans role_table_grants -> pas besoin de
  // regarder les colonnes pour cette (table, grantee) : c'est déjà table-entière.
  const wholeTableUpdate = new Set(
    tableGrants.filter((r) => r.privilege_type === "UPDATE").map((r) => `${r.table_name}:${r.grantee}`)
  );

  const statements = [];

  // 1. Toutes les whole-table grants sauf UPDATE (traité séparément juste
  // après, pour regrouper proprement le cas restreint-par-colonne).
  const nonUpdateByTableGrantee = new Map();
  for (const r of tableGrants) {
    if (r.privilege_type === "UPDATE") continue;
    const key = `${r.table_name}:${r.grantee}`;
    if (!nonUpdateByTableGrantee.has(key)) nonUpdateByTableGrantee.set(key, []);
    nonUpdateByTableGrantee.get(key).push(r.privilege_type);
  }
  for (const [key, privileges] of nonUpdateByTableGrantee) {
    const [table, grantee] = key.split(":");
    statements.push(`GRANT ${privileges.join(", ")} ON TABLE public."${table}" TO ${grantee};`);
  }

  // 2. UPDATE table-entière (déjà dans role_table_grants).
  for (const key of wholeTableUpdate) {
    const [table, grantee] = key.split(":");
    statements.push(`GRANT UPDATE ON TABLE public."${table}" TO ${grantee};`);
  }

  // 3. UPDATE restreint à des colonnes précises (jamais dans role_table_grants).
  const colsByTableGrantee = new Map();
  for (const r of columnGrants) {
    const key = `${r.table_name}:${r.grantee}`;
    if (wholeTableUpdate.has(key)) continue; // déjà couvert par le cas 2
    if (!colsByTableGrantee.has(key)) colsByTableGrantee.set(key, []);
    colsByTableGrantee.get(key).push(r.column_name);
  }
  for (const [key, cols] of colsByTableGrantee) {
    const [table, grantee] = key.split(":");
    statements.push(`GRANT UPDATE (${cols.map((c) => `"${c}"`).join(", ")}) ON TABLE public."${table}" TO ${grantee};`);
  }

  statements.sort();
  console.log(statements.join("\n"));
  console.error(`\n[stderr] ${statements.length} instruction(s) générée(s).`);
}

main().catch((err) => {
  console.error("ERREUR :", err.message);
  process.exit(1);
});
