#!/usr/bin/env node
/**
 * Rejoue toutes les migrations de supabase/migrations/ contre le projet
 * Supabase de TEST, via le module `pg` en protocole simple query (pas de
 * prepared statement) — contourne "cannot insert multiple commands into a
 * prepared statement" rencontré avec `supabase db query --db-url` (qui
 * passe par le protocole étendu). Node-postgres bascule automatiquement en
 * simple query quand `client.query(sql)` est appelé avec une chaîne seule,
 * sans tableau de valeurs — c'est tout ce qu'il faut pour supporter le
 * multi-statement, aucune option "simple: true" à passer explicitement.
 *
 * Jamais `supabase link`/`db push` : lecture directe des fichiers +
 * exécution SQL brute, comme le reste de ce dépôt depuis le début du
 * chantier.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const REPO_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const PROD_REF = "ocfhzwwjvljintabxxlg";

function loadTestEnv() {
  const envPath = path.join(REPO_ROOT, ".env.test.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

async function main() {
  const env = loadTestEnv();
  const dbUrl = process.env.TEST_SUPABASE_DB_URL || env.TEST_SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error("ERREUR : TEST_SUPABASE_DB_URL absente (ni variable d'environnement, ni .env.test.local).");
    process.exit(1);
  }
  if (dbUrl.includes(PROD_REF)) {
    console.error(`REFUS : l'URL de connexion pointe vers le projet de production (${PROD_REF}). Arrêt immédiat.`);
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let applied = 0;
  let alreadyPresent = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const { rows } = await client.query(
      "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1",
      [version]
    );

    if (rows.length > 0) {
      console.log(`[déjà appliquée] ${file}`);
      alreadyPresent++;
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    // Une seule chaîne simple-query : la migration ET l'enregistrement de
    // son passage sont dans la même transaction implicite (protocole
    // simple, plusieurs commandes = un seul bloc atomique tant qu'aucune
    // n'est elle-même BEGIN/COMMIT — vérifié qu'aucune migration de ce
    // dépôt ne l'est).
    const versionLiteral = version.replace(/'/g, "''");
    const nameLiteral = file.replace(/'/g, "''");
    const wrapped = `BEGIN;\n${sql}\nINSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${versionLiteral}', '${nameLiteral}');\nCOMMIT;`;

    try {
      await client.query(wrapped);
      console.log(`[appliquée]      ${file}`);
      applied++;
    } catch (err) {
      console.error(`\nÉCHEC sur la migration : ${file}`);
      console.error(err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("");
  console.log(
    `Résumé : ${applied} migration(s) appliquée(s), ${alreadyPresent} déjà présente(s), ${files.length} fichier(s) au total.`
  );
}

main().catch((err) => {
  console.error("ERREUR INATTENDUE :", err.message);
  process.exit(1);
});
