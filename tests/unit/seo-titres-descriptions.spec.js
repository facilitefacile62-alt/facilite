const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Titres et descriptions des pages publiques : court (49 caractères + la marque ajoutée par le modèle du site = 60), marque une seule fois, description sans émoji
 * ni symbole au début, titres propres pour /offres, /etablissements, /autour, /recherche et le Marketplace.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/titresReferencement.js");

test("titre d'offre : entreprise ajoutée seulement si l'intitulé ne la nomme pas, coupé à 49 caractères sur une fin de mot, jamais sur un petit mot", async () => {
  const { titreOffre, tronquer } = await mod();
  expect(titreOffre({ title: "Comptable confirmé", company: "Alpha Digital" })).toBe("Comptable confirmé – Alpha Digital");
  expect(titreOffre({ title: "Pyxis Logistics recrute un Chauffeur", company: "Pyxis Logistics" })).toBe("Pyxis Logistics recrute un Chauffeur");
  expect(titreOffre({ title: "Auchan recrute des caissiers", company: "Auchan Sénégal" })).toBe("Auchan recrute des caissiers");
  const long = titreOffre({ title: "NVI Facility recrute 50 Agents de Sécurité à Dakar et dans les régions", company: "NVI Facility" });
  expect(long.length).toBeLessThanOrEqual(49);
  expect(long.endsWith("…")).toBe(true);
  expect(long).not.toMatch(/\s(à|de|du|des|et|en|au)…$/i);
  expect(titreOffre({ title: "", company: "" })).toBe("Offre d'emploi");
  expect(tronquer("court", 49)).toBe("court");
  expect(tronquer("x".repeat(80), 49).length).toBe(49);
});

test("le titre complet reste à 60 caractères au plus avec la marque du modèle (« | Facilite »), et ne la répète pas", async () => {
  const { titreOffre } = await mod();
  const t = titreOffre({ title: "Auchan Sénégal recrute — Renforts Ramadan 2027 (Caissiers, Rayonnistes, Porteurs)", company: "Auchan Sénégal" });
  expect(`${t} | Facilite`.length).toBeLessThanOrEqual(60);
  expect(t).not.toMatch(/facilit/i);
  expect(lire("src/app/layout.js")).toContain('template: "%s | Facilite"');
});

test("description d'offre : sans émoji ni symbole, commence par une lettre ou un chiffre, 155 caractères au plus, phrase de secours si le texte est trop court", async () => {
  const { descriptionOffre } = await mod();
  const d = descriptionOffre({ title: "Agent", company: "X", description: "🛒 📌 • APPEL À CANDIDATURES 🚀 — recrutement de 50 agents dans le cadre de l'extension des activités de la société sur tout le territoire national, avec des postes à pourvoir immédiatement." });
  expect(d).toMatch(/^APPEL/);
  expect(d).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(d.length).toBeLessThanOrEqual(155);
  expect(descriptionOffre({ title: "Comptable", company: "Alpha", location: "Dakar", description: "" })).toBe("Offre d'emploi Comptable chez Alpha à Dakar. Postulez en ligne sur Facilité.");
  expect(descriptionOffre({ title: "Comptable", description: "🧾 Court." })).toContain("Court. Offre d'emploi Comptable");
});

test("fiche offre : titre et description viennent de ces générateurs, plus de marque dans le titre, titres d'erreur sans marque", () => {
  const p = lire("src/app/offres/[id]/page.js");
  expect(p).toContain("const title = titreOffre(offer);");
  expect(p).toContain("const description = descriptionOffre(offer);");
  expect(p).not.toContain("| Offre d'emploi Facilit");
  expect(p).toContain('return { title: "Offre d\'emploi introuvable" };');
  expect(p).toContain("title: `${title} | Facilite`,");
});

test("pages /offres, /etablissements, /autour, /recherche et Marketplace : titre et description propres, sans marque dans le titre", () => {
  const cas = [
    ["src/app/offres/page.js", "Offres d'emploi au Sénégal : CDI, CDD et stages"],
    ["src/app/etablissements/layout.js", "Établissements ouverts près de moi"],
    ["src/app/autour/page.js", "Autour de moi : où recrutent les entreprises"],
    ["src/app/recherche/layout.js", "Rechercher sur le site"],
    ["src/app/marketplace/page.js", "Marketplace : annonces à Dakar et au Sénégal"],
  ];
  for (const [fichier, titre] of cas) {
    const s = lire(fichier);
    expect(s).toContain(`title: "${titre}"`);
    expect(titre.length).toBeLessThanOrEqual(49);
    expect(s).toMatch(/description: "/);
  }
  expect(lire("src/app/marketplace/page.js")).toContain("title: titreOnglet,");
  expect(lire("src/app/marketplace/page.js")).not.toContain("| Facilité`");
});
