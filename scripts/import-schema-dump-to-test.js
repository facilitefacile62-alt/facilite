#!/usr/bin/env node
/**
 * Importe scripts/prod-schema-dump.sql (généré par
 * dump-schema-via-introspection.js) dans le projet Supabase de TEST.
 *
 * La section "Fonctions" du fichier n'est PAS exécutée telle quelle : les
 * fonctions LANGUAGE SQL sont résolues contre le catalogue à la création
 * (contrairement à plpgsql, dont le corps n'est qu'une chaîne jusqu'à la
 * première exécution) — l'ordre alphabétique du dump ne respecte donc pas
 * les dépendances mutuelles entre fonctions (ex. une fonction appelant
 * has_badge() avant que has_badge() n'existe). Cette section est rejouée
 * séparément, individuellement, en boucle jusqu'à point fixe (chaque passe
 * retente les échecs de la précédente ; arrêt quand plus aucune ne
 * progresse).
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const REPO_ROOT = path.resolve(__dirname, "..");
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

async function applyFunctionsUntilFixpoint(client, functions) {
  let remaining = [...functions];
  let applied = 0;
  let pass = 1;

  const searchPathRe = /\n SET search_path TO ('[^']*'(?:, ?'[^']*')*)\n/;

  while (remaining.length > 0) {
    const stillFailing = [];
    let progressThisPass = false;

    for (const fn of remaining) {
      try {
        await client.query(fn.ddl);
        applied++;
        progressThisPass = true;
        continue;
      } catch (err) {
        // Repli : une fonction créée à l'origine avec un search_path plus
        // large puis restreint après coup via ALTER FUNCTION (jamais
        // re-validé rétroactivement par Postgres) échoue si on rejoue le
        // CREATE final tel quel — les objets qu'elle référence (opérateurs
        // d'extension, ex. <=> de pgvector) ne sont pas visibles sous le
        // search_path restreint AU MOMENT DE LA CRÉATION. On crée sans la
        // clause SET, puis on la réapplique via ALTER FUNCTION pour
        // retrouver l'état final identique à la production.
        const match = fn.ddl.match(searchPathRe);
        if (match) {
          try {
            const withoutSetClause = fn.ddl.replace(searchPathRe, "\n");
            await client.query(withoutSetClause);
            const signatureMatch = fn.ddl.match(/CREATE OR REPLACE FUNCTION (public\.[a-zA-Z0-9_]+\([^)]*\))/);
            if (signatureMatch) {
              await client.query(`ALTER FUNCTION ${signatureMatch[1]} SET search_path TO ${match[1]};`);
            }
            applied++;
            progressThisPass = true;
            continue;
          } catch (fallbackErr) {
            stillFailing.push({ ...fn, lastError: `${err.message} | repli sans search_path: ${fallbackErr.message}` });
            continue;
          }
        }
        stillFailing.push({ ...fn, lastError: err.message });
      }
    }

    console.log(`  Passe ${pass} : ${remaining.length - stillFailing.length} appliquée(s), ${stillFailing.length} reportée(s)`);

    if (!progressThisPass) {
      console.error("\nAucune progression sur cette passe — dépendance non résolue ou erreur réelle :");
      for (const f of stillFailing) {
        console.error(`  - ${(f.ddl.match(/FUNCTION (\S+)/) || [])[1] || "?"}: ${f.lastError}`);
      }
      throw new Error(`${stillFailing.length} fonction(s) n'ont jamais pu être créées.`);
    }

    remaining = stillFailing;
    pass++;
  }

  return applied;
}

async function main() {
  const env = loadTestEnv();
  const dbUrl = process.env.TEST_SUPABASE_DB_URL || env.TEST_SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error("ERREUR : TEST_SUPABASE_DB_URL absente.");
    process.exit(1);
  }
  if (dbUrl.includes(PROD_REF)) {
    console.error(`REFUS : l'URL pointe vers la production (${PROD_REF}). Arrêt immédiat.`);
    process.exit(1);
  }

  const fullSql = fs.readFileSync(path.join(REPO_ROOT, "scripts", "prod-schema-dump.sql"), "utf-8");
  const functions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "scripts", "prod-schema-dump.functions.json"), "utf-8"));

  const fnMarker = "-- Fonctions";
  const rlsMarker = "-- RLS activé";
  const fnIdx = fullSql.indexOf(fnMarker);
  const rlsIdx = fullSql.indexOf(rlsMarker);
  if (fnIdx === -1 || rlsIdx === -1 || rlsIdx < fnIdx) {
    console.error("ERREUR : marqueurs de section introuvables ou dans le désordre dans prod-schema-dump.sql.");
    process.exit(1);
  }
  const partBeforeFunctions = fullSql.slice(0, fnIdx);
  const partFromRls = fullSql.slice(rlsIdx);

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Étape 1/3 : extensions, séquences, tables, contraintes, index...");
  await client.query(partBeforeFunctions);
  console.log("  OK");

  console.log(`Étape 2/3 : ${functions.length} fonction(s), en boucle jusqu'à point fixe...`);
  const applied = await applyFunctionsUntilFixpoint(client, functions);
  console.log(`  OK — ${applied} fonction(s) appliquée(s) au total.`);

  console.log("Étape 3/3 : RLS, policies, vues, triggers...");
  await client.query(partFromRls);
  console.log("  OK");

  await client.end();
  console.log("\nIMPORT TERMINÉ.");
}

main().catch((err) => {
  console.error("\nÉCHEC IMPORT :", err.message);
  process.exit(1);
});
