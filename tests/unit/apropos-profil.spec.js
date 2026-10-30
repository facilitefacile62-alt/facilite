const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Profil — À propos (demande du 25/10/2026) : Intro (accroche, bio, nom, titre, ville, pays, téléphone — plus d'e-mail), Informations personnelles
 * (lieu, quartier, ville d'origine, membre de, niveau d'études, genre — plus de date de naissance ni de lien d'invitation), « Modifier » qui ouvre
 * la bonne page, et glissement gauche-droite entre À propos et Paramètres.
 */
const glisser = () => import("../../mobile/src/lib/glisserOngletsLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("glissement entre onglets", () => {
  test("seul un geste franchement horizontal et assez long change d'onglet ; le défilement vertical n'est jamais gêné", async () => {
    const { geste } = await glisser();
    expect(geste(-120, 10, true)).toBe("gauche"); // doigt vers la gauche
    expect(geste(120, -10, true)).toBe("droite");
    expect(geste(-40, 0, true)).toBeNull(); // trop court
    expect(geste(-120, 90, true)).toBeNull(); // plutôt diagonal
    expect(geste(5, 200, true)).toBeNull(); // défilement vertical
    expect(geste(-10, 0, false)).toBeNull(); // le geste ne prend pas la main trop tôt
    expect(geste(-30, 5, false)).toBe("gauche");
    expect(geste(-30, 40, false)).toBeNull();
  });

  test("À propos et Paramètres sont deux pages d'UN glisseur qui suit le doigt, comme Facilité | Locaux du menu ☰", () => {
    expect(lire("mobile/src/app/mon-profil/a-propos.tsx")).toContain("<ModifierInfosPager depart={0} />");
    expect(lire("mobile/src/app/mon-profil/parametres.tsx")).toContain("<ModifierInfosPager depart={1} />");
    const p = lire("mobile/src/components/ModifierInfosPager.tsx");
    expect(p).toContain("Animated.spring(position, { toValue: index, useNativeDriver: true, bounciness: 0, speed: 16 })");
    expect(p).toContain("position.setValue(");
    expect(p).toContain("<ContenuAPropos />");
    expect(p).toContain("<ContenuParametres />");
    expect(p).toContain("surChoix={aller}");
    expect(lire("mobile/src/components/EnteteModifierInfos.tsx")).toContain("surChoix ? surChoix(1)");
  });
});

test.describe("Intro", () => {
  const intro = lire("mobile/src/app/mon-profil/intro.tsx");
  test("phrase d'accroche (accroche) puis bio (bio), puis nom, titre, ville, pays, téléphone ; plus d'e-mail", () => {
    expect(intro).toContain("texte(profile?.accroche)");
    expect(intro).toContain("texte(profile?.bio)");
    expect(intro.indexOf("Phrase d'accroche")).toBeLessThan(intro.indexOf('titre="Bio"'));
    for (const t of ["Nom complet", "Titre professionnel", "Ville actuelle", "'Pays'", "Téléphone"]) expect(intro).toContain(t);
    expect(intro).not.toMatch(/E-mail|contact_email|user\?\.email/);
  });
  test("« Modifier mon profil Intro » ouvre la modification de l'intro, pas Informations personnelles", () => {
    expect(intro).toContain("router.push('/mon-profil/intro-modifier')");
    expect(intro).not.toContain("infos-perso");
  });
  test("la modification couvre exactement : accroche (160 max), bio, prénom et nom, titre, ville, pays (liste), téléphone", () => {
    const m = lire("mobile/src/app/mon-profil/intro-modifier.tsx").replace(/\/\/.*$/gm, "");
    for (const champ of ["accroche:", "bio:", "full_name:", "headline:", "city:", "country:", "phone:"]) expect(m).toContain(champ);
    expect(m).toContain("maxLength={160}");
    expect(m).toContain("<SelecteurPays");
    expect(m).not.toMatch(/quartier|ville_origine|education_level|gender|date_naissance|contact_email/);
  });
});

test.describe("Informations personnelles", () => {
  const infos = lire("mobile/src/app/mon-profil/infos-perso.tsx");
  test("lieu, quartier, ville d'origine, membre de, niveau d'études, genre — dans cet ordre", () => {
    const ordre = ["nom: 'Lieu'", "nom: 'Quartier'", "nom: \"Ville d'origine\"", "nom: 'Membre de'", "nom: \"Niveau d'études\"", "nom: 'Genre'"].map((t) => infos.indexOf(t));
    expect(ordre.every((i) => i > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(infos).toContain("cle: 'ville_origine'");
  });
  test("plus de date de naissance, de lien d'invitation, de bouton Copier ni de « Pays / origine »", () => {
    expect(infos).not.toMatch(/date_naissance'|SelecteurDateNaissance|Lien d.invitation|Clipboard|copierLien|Pays \/ origine/);
  });
});

test.describe("base de données : migration additive", () => {
  const sql = lire("supabase/migrations/20261025120000_profil_accroche_ville_origine.sql").replace(/--.*$/gm, "");
  test("deux colonnes ajoutées, droits par colonne, rien de supprimé ni de modifié", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS accroche TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS ville_origine TEXT");
    expect(sql).toContain("GRANT SELECT (accroche, ville_origine), UPDATE (accroche, ville_origine) ON public.profiles TO authenticated;");
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE\s+public)/i);
    expect(fs.existsSync(path.join(__dirname, "../../docs/rollbacks/20261025120000_profil_accroche_ville_origine.down.sql"))).toBe(true);
  });
});
