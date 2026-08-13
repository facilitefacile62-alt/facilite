import fs from "fs";
import path from "path";

const artifactsDir = "C:/Users/gta/.gemini/antigravity-ide/brain/be41750d-6623-410f-9e8b-06ed6145ea94";
const officialGreenPoster = path.join(artifactsDir, "media__1786653869380.jpg");

if (!fs.existsSync(officialGreenPoster)) {
  console.error("Image source introuvable:", officialGreenPoster);
  process.exit(1);
}

console.log("Source image size:", fs.statSync(officialGreenPoster).size);

const targets = [
  "public/affiche_cv_pro.jpg",
  "public/affiche_boostez_carriere.jpg",
  "public/affiche2.jpg",
  "public/affiche_professionnel.jpeg",
  "public/affiche_une_.jpg",
  "public/affiche_une_.jpg.png",
  "public/affiche_facile_vraie.png",
  "public/affiche_vrae.png",
  "public/affiche_publicitaire_de_collagen.png",
  "public/model1.jpg",
  "public/photo1.jpg",
  "public/gpt-image-2_1._Style_Visuel_et_Ambiance_Type_d_image_Affiche_publicitaire_éducative_profess-0.jpg",
  "public/gpt-image-2_Prompt_Détaillé_pour_Recréer_l_Affiche_Publicitaire_1._Style_Visuel_et_Ambian-0.jpg",
  "public/gpt-image-2_Prompt_Détaillé_pour_Recréer_l_Affiche_Publicitaire_1._Style_Visuel_et_Ambian-0_(1).jpg"
];

for (let i = 1; i <= 8; i++) {
  targets.push(`public/model${i}.png`);
}

targets.forEach((t) => {
  const targetPath = path.resolve(t);
  fs.copyFileSync(officialGreenPoster, targetPath);
  console.log(`✅ ${t} écrasé avec succès (${fs.statSync(targetPath).size} octets)`);
});

console.log("\n🚀 SUCCÈS TOTAL : Toutes les affiches du site ont été définitivement écrasées par l'affiche officielle verte (BOOSTEZ VOTRE CARRIÈRE AVEC UN CV PRO !).");
