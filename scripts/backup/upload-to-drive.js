/**
 * Upload vers Google Drive via un compte de service — 4D du chantier du
 * 2026-08-06 (docs/incident-2026-08-06.md).
 *
 * Un compte de service Google Cloud n'a pas de quota Drive personnel sur un
 * compte Gmail gratuit (pas de Google Workspace) : le fichier est donc
 * téléversé dans un DOSSIER appartenant au compte personnel de
 * l'utilisateur, partagé au préalable avec l'email du compte de service en
 * "Éditeur" — le stockage compte alors contre les 15 Go gratuits du compte
 * personnel, pas contre un quota de service account qui n'existe pas ici.
 * Voir la procédure donnée séparément pour créer ce partage.
 *
 * GOOGLE_SERVICE_ACCOUNT_JSON : le contenu JSON complet de la clé de compte
 * de service (secret GitHub Actions), pas un chemin de fichier — évite
 * d'avoir à gérer un fichier temporaire en CI.
 * GOOGLE_DRIVE_FOLDER_ID : l'identifiant du dossier partagé (visible dans
 * l'URL du dossier Drive : drive.google.com/drive/folders/<CET_ID>).
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

// Conserve au plus N sauvegardes dans le dossier Drive — au-delà, la plus
// ancienne est supprimée après un upload réussi. Évite une croissance non
// bornée du quota gratuit ; 30 couvre un mois de sauvegardes quotidiennes ou
// ~7 mois d'hebdomadaires, largement assez pour détecter un problème et
// remonter dans l'historique.
const MAX_BACKUPS_KEPT = 30;

async function getDriveClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON manquant.");

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

async function uploadBackup(filePath) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquant.");

  const drive = await getDriveClient();
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  console.log(`Envoi de ${fileName} (${fileBuffer.length} bytes) vers le dossier Drive ${folderId}...`);

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "application/octet-stream", body: Readable.from(fileBuffer) },
    fields: "id, name, size, createdTime",
  });

  console.log(`✅ Envoyé : ${data.name} (id=${data.id}, ${data.size} bytes)`);

  await pruneOldBackups(drive, folderId);

  return data;
}

async function pruneOldBackups(drive, folderId) {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 1000,
  });

  const files = data.files || [];
  if (files.length <= MAX_BACKUPS_KEPT) return;

  const toDelete = files.slice(MAX_BACKUPS_KEPT);
  for (const file of toDelete) {
    await drive.files.delete({ fileId: file.id });
    console.log(`  - Ancienne sauvegarde supprimée : ${file.name}`);
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node upload-to-drive.js <fichier.enc>");
    process.exit(1);
  }
  await uploadBackup(filePath);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Échec de l'envoi vers Drive :", err.message);
    process.exit(1);
  });
}

module.exports = { uploadBackup, getDriveClient };
