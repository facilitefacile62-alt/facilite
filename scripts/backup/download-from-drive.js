/**
 * Téléchargement depuis Google Drive — moitié "restauration" du 4D du
 * chantier du 2026-08-06. Toujours exécuté localement par l'utilisateur,
 * jamais en CI (mêmes clés service account que l'upload, mais utilisées ici
 * pour lister/lire, pas pour chiffrer quoi que ce soit).
 *
 * Usage :
 *   node scripts/backup/download-from-drive.js --list
 *   node scripts/backup/download-from-drive.js --latest --out=./backup.enc
 *   node scripts/backup/download-from-drive.js --id=<fileId> --out=./backup.enc
 */

const fs = require("fs");
const { getDriveClient } = require("./upload-to-drive");

async function listBackups(drive, folderId) {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, size, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });
  return data.files || [];
}

async function downloadFile(drive, fileId, outPath) {
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outPath);
    res.data.pipe(dest);
    res.data.on("end", resolve);
    res.data.on("error", reject);
    dest.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquant.");

  const drive = await getDriveClient();

  if (args.includes("--list")) {
    const files = await listBackups(drive, folderId);
    for (const f of files) console.log(`${f.id}  ${f.createdTime}  ${f.name}  (${f.size} bytes)`);
    return;
  }

  const outPath = args.find((a) => a.startsWith("--out="))?.split("=")[1] || "./backup.enc";
  let fileId = args.find((a) => a.startsWith("--id="))?.split("=")[1];

  if (args.includes("--latest")) {
    const files = await listBackups(drive, folderId);
    if (files.length === 0) throw new Error("Aucune sauvegarde trouvée dans le dossier Drive.");
    fileId = files[0].id;
    console.log(`Dernière sauvegarde : ${files[0].name} (${files[0].createdTime})`);
  }

  if (!fileId) {
    console.error("Usage: --list | --latest --out=<chemin> | --id=<fileId> --out=<chemin>");
    process.exit(1);
  }

  console.log(`Téléchargement vers ${outPath}...`);
  await downloadFile(drive, fileId, outPath);
  console.log("✅ Téléchargé.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Échec du téléchargement :", err.message);
    process.exit(1);
  });
}

module.exports = { listBackups, downloadFile };
