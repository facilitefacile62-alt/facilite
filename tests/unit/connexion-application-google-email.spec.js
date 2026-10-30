const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Connexion dans l'application (Android) : « Continuer avec Google » + e-mail et mot de passe seulement. Pas d'inscription, pas de « mot de passe oublié », pas de
 * connexion par code ou lien magique (interrupteurs fermés par défaut, illisible = fermé). Un seul message de refus, neutre, en français.
 */
const messages = () => import("../../mobile/src/lib/connexionApplicationLogique.ts");
const ecrans = () => import("../../mobile/src/lib/ecransMasquesLogique.ts");
const flags = () => import("../../mobile/src/lib/featureFlagsLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

const FERMES = ["feat_app_inscription", "feat_app_mot_de_passe_oublie", "feat_app_connexion_sans_mot_de_passe"];

test.describe("message de refus : un seul, neutre, en français", () => {
  test("adresse inconnue, mot de passe faux, adresse non confirmée, erreur quelconque : exactement le même message", async () => {
    const { messageRefusConnexion, MESSAGE_CONNEXION_REFUSEE } = await messages();
    for (const erreur of [
      { message: "Invalid login credentials", status: 400 },
      { message: "Email not confirmed", status: 400 },
      { message: "User not found" },
      { message: "Invalid email or password" },
      { message: "Something unexpected happened on the server", status: 500 },
      { message: "" },
      null,
      undefined,
    ]) expect(messageRefusConnexion(erreur), JSON.stringify(erreur)).toBe(MESSAGE_CONNEXION_REFUSEE);
  });
  test("le message ne révèle rien sur le compte et ne contient aucun mot technique ni anglais", async () => {
    const { MESSAGE_CONNEXION_REFUSEE, MESSAGE_RESEAU, MESSAGE_GOOGLE_ECHEC } = await messages();
    for (const m of [MESSAGE_CONNEXION_REFUSEE, MESSAGE_RESEAU, MESSAGE_GOOGLE_ECHEC]) {
      expect(m).not.toMatch(/existe|inconnu|introuvable|confirm|n'a pas de compte|credentials|invalid|error|failed|token|supabase/i);
    }
    expect(MESSAGE_CONNEXION_REFUSEE).toMatch(/^Adresse e-mail ou mot de passe incorrect/);
  });
  test("une panne de réseau a son propre message (elle ne révèle rien du compte)", async () => {
    const { messageRefusConnexion, MESSAGE_RESEAU } = await messages();
    expect(messageRefusConnexion({ name: "AuthRetryableFetchError", message: "Network request failed" })).toBe(MESSAGE_RESEAU);
    expect(messageRefusConnexion({ message: "Failed to fetch" })).toBe(MESSAGE_RESEAU);
  });
  test("Google : nos messages français connus sont affichés, tout autre texte (anglais, technique) devient un message générique", async () => {
    const { messageErreurGoogle, MESSAGE_GOOGLE_ECHEC } = await messages();
    expect(messageErreurGoogle(new Error("Connexion annulée."))).toBe("Connexion annulée.");
    expect(messageErreurGoogle(new Error("Réponse Google incomplète."))).toBe("Réponse Google incomplète.");
    expect(messageErreurGoogle(new Error("OAuth state mismatch"))).toBe(MESSAGE_GOOGLE_ECHEC);
    expect(messageErreurGoogle("boom")).toBe(MESSAGE_GOOGLE_ECHEC);
    expect(messageErreurGoogle(undefined)).toBe(MESSAGE_GOOGLE_ECHEC);
  });
  test("l'écran n'affiche plus jamais le message brut d'une erreur, ni ne propose de renvoyer une confirmation", () => {
    const c = lire("mobile/src/app/(auth)/connexion-email.tsx");
    expect(c).not.toMatch(/setErrorMessage\([^)]*(error|err)\.message/);
    expect(c).not.toContain("setNeedsConfirmation(true)");
    expect(c).not.toContain("n'a pas encore été confirmée");
    expect(c).toContain("setErrorMessage(messageRefusConnexion(error));");
    expect(c).toContain("setErrorMessage(messageErreurGoogle(err));");
  });
});

test.describe("interrupteurs fermés par défaut, illisible = caché", () => {
  test("inscription, mot de passe oublié et connexion par code sont fermés par défaut pour tous les rôles sauf l'administrateur", async () => {
    const { PAR_DEFAUT, fonctionnaliteAutorisee } = await flags();
    for (const id of FERMES) {
      expect(PAR_DEFAUT[id]?.enabled, id).toBe(false);
      for (const role of ["user", "visitor", "recruiter"]) expect(fonctionnaliteAutorisee(id, role, PAR_DEFAUT), `${id}/${role}`).toBe(false);
      expect(fonctionnaliteAutorisee(id, "admin", PAR_DEFAUT), id).toBe(true);
    }
  });
  test("le téléphone reste fermé (feat_connexion_telephone) ; les interrupteurs de l'application ne touchent pas à ceux du site", async () => {
    const { PAR_DEFAUT } = await flags();
    expect(PAR_DEFAUT.feat_connexion_telephone.enabled).toBe(false);
    expect(PAR_DEFAUT.nav_offres.enabled).toBe(true);
  });
});

test.describe("écrans de connexion masqués : non atteignables par lien profond", () => {
  const CIBLES = [
    ["/register", "feat_app_inscription"],
    ["/verifiez-votre-email", "feat_app_inscription"],
    ["/forgot-password", "feat_app_mot_de_passe_oublie"],
    ["/nouveau-mot-de-passe", "feat_app_mot_de_passe_oublie"],
  ];
  test("chaque écran est refusé par défaut (visiteur compris) et accessible à l'administrateur ou une fois l'interrupteur ouvert", async () => {
    const { interrupteursEcran } = await ecrans();
    const { PAR_DEFAUT, tousAutorises } = await flags();
    for (const [chemin, id] of CIBLES) {
      const requis = interrupteursEcran(chemin);
      expect(requis, chemin).toEqual([id]);
      for (const role of ["visitor", "user", "recruiter"]) expect(tousAutorises(requis, role, PAR_DEFAUT), `${chemin}/${role}`).toBe(false);
      expect(tousAutorises(requis, "admin", PAR_DEFAUT), chemin).toBe(true);
      expect(tousAutorises(requis, "visitor", { ...PAR_DEFAUT, [id]: { enabled: true, roles: { visitor: true } } }), chemin).toBe(true);
    }
  });
  test("restent accessibles : /login (Google + e-mail), /connexion-email, /bienvenue, /langue, /nom-prenom", async () => {
    const { interrupteursEcran } = await ecrans();
    for (const chemin of ["/login", "/connexion-email", "/bienvenue", "/langue", "/nom-prenom"]) expect(interrupteursEcran(chemin), chemin).toEqual([]);
  });
});

test.describe("écran de connexion", () => {
  test("/login affiche Google + e-mail et mot de passe tant que la connexion par code est fermée", () => {
    const l = lire("mobile/src/app/(auth)/login.tsx");
    expect(l).toContain("const codeOuvert = useFonctionnalite('feat_app_connexion_sans_mot_de_passe');");
    expect(l).toContain("return codeOuvert ? <LoginParCode /> : <ConnexionEmailScreen racine />;");
  });
  test("« Continuer avec Google » en grand en premier ; inscription, mot de passe oublié et lien magique derrière leurs interrupteurs", () => {
    const c = lire("mobile/src/app/(auth)/connexion-email.tsx");
    expect(c.indexOf("BoutonGoogle libelle=\"Continuer avec Google\"")).toBeGreaterThan(-1);
    expect(c).toContain("const inscriptionOuverte = useFonctionnalite('feat_app_inscription');");
    expect(c).toContain("const motDePasseOublieOuvert = useFonctionnalite('feat_app_mot_de_passe_oublie');");
    expect(c).toContain("const lienMagiqueOuvert = useFonctionnalite('feat_app_connexion_sans_mot_de_passe');");
    // aucun lien vers l'inscription ou « mot de passe oublié » en dehors d'un bloc conditionné par son interrupteur
    for (const [lien, drapeau] of [["router.push('/register')", "inscriptionOuverte ? ("], ["router.push('/forgot-password')", "motDePasseOublieOuvert ? ("]]) {
      let i = c.indexOf(lien);
      expect(i, lien).toBeGreaterThan(-1);
      while (i !== -1) {
        expect(c.lastIndexOf(drapeau, i), `${lien} non protégé`).toBeGreaterThan(-1);
        expect(i - c.lastIndexOf(drapeau, i), `${lien} trop loin de son interrupteur`).toBeLessThan(900);
        i = c.indexOf(lien, i + 1);
      }
    }
    expect(c).toMatch(/\{lienMagiqueOuvert \? \(\s*<Pressable onPress=\{envoyerLienMagique\}/);
  });
  test("aucun autre écran de l'application ne pointe vers l'inscription ou « mot de passe oublié » hors de leurs propres écrans masqués", () => {
    for (const f of ["mobile/src/app/(auth)/bienvenue.tsx", "mobile/src/app/(auth)/login.tsx", "mobile/src/app/menu.tsx", "mobile/src/app/(tabs)/profil.tsx", "mobile/src/app/mon-profil/securite.tsx"]) {
      expect(lire(f), f).not.toMatch(/push\('\/register'\)|replace\('\/register'\)|push\('\/forgot-password'\)/);
    }
  });
  test("la garde globale de la racine couvre ces écrans", () => {
    const e = lire("mobile/src/lib/ecransMasquesLogique.ts");
    expect(e).toContain("chemins: ['/register', '/verifiez-votre-email'], interrupteurs: INSCRIPTION");
    expect(e).toContain("chemins: ['/forgot-password', '/nouveau-mot-de-passe'], interrupteurs: MOT_DE_PASSE_OUBLIE");
  });
});
