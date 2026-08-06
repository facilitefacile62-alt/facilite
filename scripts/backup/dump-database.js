/**
 * Sauvegarde chiffrée — 4D du chantier du 2026-08-06 (docs/incident-2026-08-06.md).
 *
 * Ne sauvegarde QUE les données, jamais le schéma : le schéma est déjà
 * intégralement reconstructible depuis supabase/migrations/ (garanti par
 * l'Invariant 10 — tout objet en base doit apparaître dans une migration).
 * Dupliquer le schéma ici serait une deuxième source de vérité à maintenir
 * en plus des migrations, exactement ce que ce projet a appris à éviter.
 *
 * Chiffrement hybride RSA-4096 + AES-256-GCM (équivalent à ce que fait
 * `age` sous le capot, réimplémenté avec le module `crypto` natif de Node
 * pour éviter une dépendance à un binaire externe absent de l'environnement
 * d'exécution GitHub Actions par défaut) :
 *   1. Une clé AES-256 aléatoire est générée pour CETTE sauvegarde précise.
 *   2. Les données sont chiffrées avec cette clé AES (rapide, gère de gros volumes).
 *   3. La clé AES elle-même est chiffrée avec la clé PUBLIQUE RSA (lente,
 *      mais seulement 256 bytes à chiffrer).
 *   4. Le fichier final ne contient que : IV, tag d'authentification, clé
 *      AES chiffrée, données chiffrées — rien n'est déchiffrable sans la
 *      clé PRIVÉE RSA, qui ne touche jamais cet environnement.
 *
 * BACKUP_PUBLIC_KEY_PEM (variable d'environnement) : la clé publique RSA au
 * format PEM. Sûre à stocker comme secret GitHub Actions — elle ne permet
 * que de chiffrer, jamais de déchiffrer.
 */

const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STORAGE_BUCKETS = ["resumes", "badge-documents", "completed_cvs", "invoices"];
// "job-offers" volontairement exclu : bucket public, visuels marketing
// recréables, pas des données que la perte rendrait irrécupérable.

const TABLES_TO_BACKUP = [
  "profiles",
  "user_roles",
  "job_offers",
  "candidatures",
  "resumes",
  "conversations",
  "messages",
  "recruiter_profiles",
  "badge_requests",
  "orders",
  "transactions",
  "subscriptions",
  "interviews",
  "agent_assignments",
  "security_logs",
  "cv_consultations",
  "contact_messages",
  "support_threads",
  "establishments",
];

async function dumpTable(client, tableName) {
  const exists = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  if (exists.rowCount === 0) {
    return { table: tableName, skipped: true, reason: "table absente" };
  }
  const result = await client.query(`SELECT * FROM public.${tableName}`);
  return { table: tableName, rowCount: result.rowCount, rows: result.rows };
}

function encryptHybrid(plaintextBuffer, publicKeyPem) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encryptedAesKey = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    aesKey
  );

  // Format : [4 bytes longueur clé AES chiffrée][clé AES chiffrée][12 bytes IV][16 bytes tag][données chiffrées]
  const header = Buffer.alloc(4);
  header.writeUInt32BE(encryptedAesKey.length, 0);
  return Buffer.concat([header, encryptedAesKey, iv, authTag, encrypted]);
}

async function dumpStorage(supabaseUrl, serviceRoleKey) {
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const files = [];

  for (const bucket of STORAGE_BUCKETS) {
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const { data: entries, error } = await admin.storage.from(bucket).list("", { limit: pageSize, offset, sortBy: { column: "name" } });
      if (error) {
        console.log(`  - bucket ${bucket} : erreur de listage (${error.message}), ignoré`);
        break;
      }
      if (!entries || entries.length === 0) break;

      // list() ne descend pas récursivement dans les sous-dossiers (chemins
      // {user_id}/cvs/...) — chaque "entrée" à la racine sans metadata.size
      // est un dossier, à explorer un niveau plus bas.
      for (const entry of entries) {
        const objectPaths = entry.id ? [entry.name] : await listRecursive(admin, bucket, entry.name);
        for (const objectPath of objectPaths) {
          const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(objectPath);
          if (downloadError) {
            console.log(`  - ${bucket}/${objectPath} : échec téléchargement (${downloadError.message}), ignoré`);
            continue;
          }
          const buffer = Buffer.from(await blob.arrayBuffer());
          files.push({ bucket, path: objectPath, content_base64: buffer.toString("base64") });
        }
      }
      if (entries.length < pageSize) break;
      offset += pageSize;
    }
  }
  return files;
}

async function listRecursive(admin, bucket, prefix) {
  const { data: entries, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !entries) return [];
  const paths = [];
  for (const entry of entries) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id) {
      paths.push(fullPath);
    } else {
      paths.push(...(await listRecursive(admin, bucket, fullPath)));
    }
  }
  return paths;
}

async function main() {
  const dbUrl = process.env.SUPABASE_DATABASE_URL;
  const publicKeyPem = process.env.BACKUP_PUBLIC_KEY_PEM;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const outputPath = process.argv[2] || path.join(process.cwd(), `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.enc`);

  if (!dbUrl) throw new Error("SUPABASE_DATABASE_URL manquant.");
  if (!publicKeyPem) throw new Error("BACKUP_PUBLIC_KEY_PEM manquant.");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquant (nécessaires pour sauvegarder Storage).");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log(`Sauvegarde de ${TABLES_TO_BACKUP.length} tables...`);
  const dump = {
    version: 1,
    created_at: new Date().toISOString(),
    tables: {},
    storage_files: [],
  };

  let totalRows = 0;
  for (const table of TABLES_TO_BACKUP) {
    const result = await dumpTable(client, table);
    if (result.skipped) {
      console.log(`  - ${table} : ignorée (${result.reason})`);
      continue;
    }
    dump.tables[table] = result.rows;
    totalRows += result.rowCount;
    console.log(`  - ${table} : ${result.rowCount} ligne(s)`);
  }

  await client.end();

  console.log(`Sauvegarde des fichiers Storage (${STORAGE_BUCKETS.join(", ")})...`);
  dump.storage_files = await dumpStorage(supabaseUrl, serviceRoleKey);
  console.log(`  - ${dump.storage_files.length} fichier(s) téléchargé(s)`);

  const plaintext = Buffer.from(JSON.stringify(dump), "utf-8");
  const encrypted = encryptHybrid(plaintext, publicKeyPem);
  fs.writeFileSync(outputPath, encrypted);

  console.log(
    `\n✅ ${totalRows} lignes + ${dump.storage_files.length} fichier(s), chiffrés dans ${outputPath} (${encrypted.length} bytes).`
  );
  return outputPath;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Échec de la sauvegarde :", err.message);
    process.exit(1);
  });
}

module.exports = { main, encryptHybrid, TABLES_TO_BACKUP };
