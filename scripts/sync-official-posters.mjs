import fs from "fs";
import path from "path";

const officialPoster = path.resolve("public/affiche_cv_pro.jpg");

if (!fs.existsSync(officialPoster)) {
  console.error("Affiche officielle introuvable :", officialPoster);
  process.exit(1);
}

const targets = [
  "public/affiche2.jpg",
  "public/affiche_boostez_carriere.jpg",
  "public/model1.jpg",
  "public/model1.png",
  "public/model2.png",
  "public/model3.png",
  "public/model4.png",
  "public/model5.png",
  "public/model6.png",
  "public/model7.png",
  "public/model8.png",
  "public/photo1.jpg"
];

for (const target of targets) {
  const targetPath = path.resolve(target);
  fs.copyFileSync(officialPoster, targetPath);
  console.log(`✅ Copié vers ${target}`);
}

console.log("\n🎉 Toutes les images ont été remplacées par l'affiche officielle CV Pro.");
