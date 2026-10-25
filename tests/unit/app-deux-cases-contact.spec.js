const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Application : deux cases séparées, remplies par la personne SANS confirmation — numéro d'appel (profiles.phone) et WhatsApp (marketplace_stores.telephone_whatsapp) —
 * comme sur le site. Aucun nouveau chemin d'écriture : mêmes écritures que le site (mise à jour directe de profiles par le client ; fonction SQL modifier_ma_boutique).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("Coordonnées de Locaux", () => {
  const coord = lire("mobile/src/components/EcranCoordonnees.tsx");
  test("numéro d'appel et WhatsApp modifiables, chacun par le même chemin que le site", () => {
    expect(coord).toContain('titre="Numéro d\'appel"');
    expect(coord).toContain("enregistrerChampsProfil(user.id, { phone: numero || null })"); // profiles.phone : écriture directe du client, comme le site
    expect(coord).toContain("changerWhatsappBoutique(boutique, numero)"); // WhatsApp : fonction SQL modifier_ma_boutique, comme le formulaire de la boutique
    expect(coord).toContain("supabase.rpc('numero_deja_utilise'"); // même contrôle que « Modifier la boutique »
  });
  test("le numéro d'appel de Locaux est profiles.phone (le contact), pas le numéro de connexion ; Facilité garde l'affichage du compte", () => {
    expect(coord).toContain("const telephone = complet ? texte('phone') : user?.phone || texte('phone');");
  });
  test("aucune confirmation demandée, aucune écriture directe ailleurs que par les fonctions existantes", () => {
    expect(coord).not.toMatch(/whatsapp-code|confirmer_whatsapp_boutique|Recevoir un code/);
    const modal = lire("mobile/src/components/ModifierNumeroModal.tsx");
    expect(modal).not.toMatch(/supabase|\.from\(|\.rpc\(/);
  });
});

test.describe("fonctions de vendeur.ts", () => {
  const v = lire("mobile/src/lib/vendeur.ts");
  test("identité vendeur : numéro d'appel facultatif, jamais effacé quand on ne le remplit pas, numéro déjà pris signalé sans dire à qui", () => {
    expect(v).toContain("telephone?: string; email: string");
    expect(v).toContain("...(numeroAppel ? { phone: numeroAppel } : {})");
    expect(v).toContain("error.code === '23505'");
    expect(v).toContain("Ce numéro est déjà utilisé par un autre compte.");
  });
  test("changer le seul WhatsApp renvoie toutes les valeurs actuelles de la boutique (modifier_ma_boutique remplace tout)", () => {
    const corps = v.slice(v.indexOf("export async function changerWhatsappBoutique"));
    for (const champ of ["boutique.nom", "boutique.quartier", "boutique.ville", "boutique.metier", "boutique.description_prestation", "boutique.categorie_etablissement"]) {
      expect(corps.slice(0, 700)).toContain(champ);
    }
    expect(corps.slice(0, 700)).toContain("telephoneWhatsapp: numero");
  });
});

test.describe("inscription vendeur", () => {
  const i = lire("mobile/src/app/marketplace/vendre/index.tsx");
  test("deux champs distincts : numéro d'appel (facultatif) et WhatsApp (obligatoire, pour joindre les acheteurs), sans confirmation", () => {
    expect(i).toContain("Numéro d'appel (facultatif)");
    expect(i).toContain("Numéro WhatsApp*");
    expect(i).toContain("enregistrerIdentiteVendeur(userId, { prenom, nom: nomFamille, telephone, email })");
    expect(i).toContain("telephoneWhatsapp: whatsapp");
    expect(i).toMatch(/if \(!whatsapp\.trim\(\)\) \{\s*Alert\.alert\('WhatsApp manquant'/);
  });
});
