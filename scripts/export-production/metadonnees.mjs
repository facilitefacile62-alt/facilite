// Relève ce que pg_dump ne couvre pas avec les schémas public / auth / storage : version, extensions, tâches planifiées (pg_cron), réglages des buckets. Lecture seule.
//   EXPORT_DB_URL=… node scripts/export-production/metadonnees.mjs <fichier-sortie.json>
// Le fichier peut contenir des commandes planifiées : il ne quitte jamais l'archive chiffrée.
import fs from "node:fs";
import pg from "pg";

const sortie = process.argv[2];
if (!sortie || !process.env.EXPORT_DB_URL) {
  console.error("Usage : EXPORT_DB_URL=… node metadonnees.mjs <fichier-sortie.json>");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.EXPORT_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const requete = async (sql) => {
  try {
    return (await client.query(sql)).rows;
  } catch (e) {
    return { indisponible: String(e.message).slice(0, 120) };
  }
};
const meta = {
  date: new Date().toISOString(),
  version: (await requete("SELECT version()"))[0]?.version,
  extensions: await requete("SELECT extname, extversion, extnamespace::regnamespace::text AS schema FROM pg_extension ORDER BY extname"),
  taches_planifiees: await requete("SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobid"),
  buckets: await requete("SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id"),
  realtime_publication: await requete("SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1, 2"),
};
await client.end();
fs.writeFileSync(sortie, JSON.stringify(meta, null, 1));
console.log(`Métadonnées : ${Array.isArray(meta.extensions) ? meta.extensions.length : 0} extension(s), ${Array.isArray(meta.taches_planifiees) ? meta.taches_planifiees.length : "?"} tâche(s) planifiée(s), ${Array.isArray(meta.buckets) ? meta.buckets.length : 0} bucket(s).`);
