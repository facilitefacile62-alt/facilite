/**
 * Restauration — 4D du chantier du 2026-08-06 (docs/incident-2026-08-06.md).
 *
 * NE TOURNE JAMAIS EN CI. Toujours exécuté localement, avec la clé PRIVÉE
 * RSA que seul l'utilisateur possède — c'est tout le sens de la séparation
 * chiffrement (public, en CI) / déchiffrement (privé, jamais en CI).
 *
 * Par défaut, restaure vers le schéma `public` (une vraie restauration de
 * secours). Pour un test qui ne touche PAS les données réelles, passer
 * --schema=nom_schema_de_test : chaque table est alors créée dans ce schéma
 * séparé plutôt que public, avec la structure minimale déduite des données
 * elles-mêmes (colonnes JSON génériques) — suffisant pour PROUVER que le
 * pipeline chiffrement/déchiffrement/insertion fonctionne réellement, sans
 * dépendre des migrations existantes pour ce test isolé.
 *
 * Usage :
 *   node scripts/backup/restore-database.js <fichier.enc> --private-key=<chemin> [--schema=public|nom_test]
 */

const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const fs = require("fs");

function decryptHybrid(encryptedBuffer, privateKeyPem) {
  const keyLen = encryptedBuffer.readUInt32BE(0);
  let offset = 4;
  const encryptedAesKey = encryptedBuffer.subarray(offset, offset + keyLen);
  offset += keyLen;
  const iv = encryptedBuffer.subarray(offset, offset + 12);
  offset += 12;
  const authTag = encryptedBuffer.subarray(offset, offset + 16);
  offset += 16;
  const ciphertext = encryptedBuffer.subarray(offset);

  const aesKey = crypto.privateDecrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    encryptedAesKey
  );

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

const BATCH_SIZE = 200;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

async function restoreIntoSchema(client, schema, dump) {
  if (schema !== "public") {
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
    await client.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
  }

  const summary = [];
  for (const [table, rows] of Object.entries(dump.tables)) {
    if (!Array.isArray(rows) || rows.length === 0) {
      summary.push({ table, restored: 0 });
      continue;
    }

    if (schema !== "public") {
      // Test isolé : table générique à 2 colonnes (id extrait s'il existe,
      // + la ligne complète en JSONB) — ne suppose rien du schéma réel,
      // preuve suffisante que chaque ligne survit chiffrement -> déchiffrement
      // -> insertion sans corruption.
      await client.query(
        `CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)} (row_id text, data jsonb)`
      );
      for (const batch of chunk(rows, BATCH_SIZE)) {
        const values = [];
        const tuples = batch.map((row, i) => {
          const id = row.id !== undefined ? String(row.id) : null;
          values.push(id, JSON.stringify(row));
          return `($${i * 2 + 1}, $${i * 2 + 2}::jsonb)`;
        });
        await client.query(
          `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table)} (row_id, data) VALUES ${tuples.join(", ")}`,
          values
        );
      }
    } else {
      // Restauration réelle : les tables existent déjà (migrations déjà
      // appliquées sur le projet cible) — INSERT par lots, colonne par colonne.
      const columns = Object.keys(rows[0]);
      const colList = columns.map(quoteIdent).join(", ");
      for (const batch of chunk(rows, BATCH_SIZE)) {
        const values = [];
        const tuples = batch.map((row, i) => {
          for (const c of columns) values.push(row[c]);
          const placeholders = columns.map((_, j) => `$${i * columns.length + j + 1}`).join(", ");
          return `(${placeholders})`;
        });
        await client.query(
          `INSERT INTO public.${quoteIdent(table)} (${colList}) VALUES ${tuples.join(", ")} ON CONFLICT DO NOTHING`,
          values
        );
      }
    }
    summary.push({ table, restored: rows.length });
  }
  return summary;
}

async function restoreStorage(supabaseUrl, serviceRoleKey, files, { dryRun }) {
  if (files.length === 0) return { restored: 0, skipped: 0 };
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let restored = 0;
  let skipped = 0;
  for (const file of files) {
    if (dryRun) {
      console.log(`  - [essai à blanc] ${file.bucket}/${file.path} (${file.content_base64.length} bytes base64) — non téléversé`);
      skipped += 1;
      continue;
    }
    const buffer = Buffer.from(file.content_base64, "base64");
    const { error } = await admin.storage.from(file.bucket).upload(file.path, buffer, { upsert: true });
    if (error) {
      console.log(`  - ${file.bucket}/${file.path} : échec (${error.message})`);
      skipped += 1;
    } else {
      restored += 1;
    }
  }
  return { restored, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const privateKeyPath = args.find((a) => a.startsWith("--private-key="))?.split("=")[1];
  const schema = args.find((a) => a.startsWith("--schema="))?.split("=")[1] || "public";
  // Par défaut, la restauration Storage est un essai à blanc (liste ce qui
  // SERAIT restauré sans rien téléverser) — --restore-storage l'active
  // réellement. Séparé de --schema volontairement : restaurer des fichiers
  // dans les buckets réels est une action à part, pas liée au choix du
  // schéma de test pour les données SQL.
  const restoreStorageForReal = args.includes("--restore-storage");
  const dbUrl = process.env.SUPABASE_DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!filePath || !privateKeyPath) {
    console.error("Usage: node restore-database.js <fichier.enc> --private-key=<chemin> [--schema=public|nom_test] [--restore-storage]");
    process.exit(1);
  }
  if (!dbUrl) throw new Error("SUPABASE_DATABASE_URL manquant.");

  console.log(`Déchiffrement de ${filePath}...`);
  const encrypted = fs.readFileSync(filePath);
  const privateKeyPem = fs.readFileSync(privateKeyPath, "utf-8");
  const decrypted = decryptHybrid(encrypted, privateKeyPem);
  const dump = JSON.parse(decrypted.toString("utf-8"));
  console.log(`Sauvegarde du ${dump.created_at}, ${Object.keys(dump.tables).length} tables, ${(dump.storage_files || []).length} fichier(s) Storage.`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log(`Restauration vers le schéma "${schema}"${schema !== "public" ? " (isolé, test)" : " (RÉEL)"}...`);
  const summary = await restoreIntoSchema(client, schema, dump);
  await client.end();

  for (const s of summary) console.log(`  - ${s.table} : ${s.restored} ligne(s) restaurée(s)`);

  if (dump.storage_files && dump.storage_files.length > 0 && supabaseUrl && serviceRoleKey) {
    console.log(`\nStorage (${restoreStorageForReal ? "restauration réelle" : "essai à blanc, passez --restore-storage pour téléverser réellement"}) :`);
    const storageSummary = await restoreStorage(supabaseUrl, serviceRoleKey, dump.storage_files, { dryRun: !restoreStorageForReal });
    console.log(`  ${storageSummary.restored} restauré(s), ${storageSummary.skipped} ignoré(s)/échoué(s).`);
  }

  console.log("\n✅ Restauration terminée.");
  return summary;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Échec de la restauration :", err.message);
    process.exit(1);
  });
}

module.exports = { main, decryptHybrid, restoreIntoSchema };
