const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Interrupteur feat_connexion_telephone : fermé par défaut et en cas de doute ; fermé, le site et l'application ne proposent que Google et l'e-mail.
 */
const interrupteur = () => import("../../src/lib/connexionTelephoneRegle.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test.describe("lecture de l'interrupteur (site)", () => {
  test("ouvert seulement si la ligne est lue, ouverte et autorisée aux visiteurs ; tout le reste = fermé", async () => {
    const { telephoneOuvert } = await interrupteur();
    expect(telephoneOuvert({ enabled: true, roles: { visitor: true, user: true } })).toBe(true);
    expect(telephoneOuvert({ enabled: true, roles: null })).toBe(true);
    expect(telephoneOuvert({ enabled: false, roles: { visitor: true } })).toBe(false);
    expect(telephoneOuvert({ enabled: true, roles: { visitor: false } })).toBe(false); // un visiteur ne peut pas se connecter par téléphone s'il ne voit pas l'interrupteur
    expect(telephoneOuvert(null)).toBe(false); // ligne absente
    expect(telephoneOuvert(undefined)).toBe(false);
    expect(telephoneOuvert({})).toBe(false);
    expect(telephoneOuvert({ enabled: "true" })).toBe(false); // jamais une valeur « presque vraie »
    expect(telephoneOuvert({ enabled: 1 })).toBe(false);
  });
  test("le hook démarre fermé, et reste fermé si la lecture échoue (erreur ou exception)", () => {
    const h = lire("src/lib/connexionTelephoneInterrupteur.js");
    expect(h).toContain("useState(false)");
    expect(h).toContain("setOuvert(!error && telephoneOuvert(data))");
    expect(h).toMatch(/\.catch\(\(\) => \{\s*if \(actif\) setOuvert\(false\);/);
  });
});

test.describe("site : connexion et inscription", () => {
  for (const [fichier, nom] of [["src/app/login/page.js", "PHONE_LOGIN_ENABLED"], ["src/app/register/page.js", "PHONE_SIGNUP_ENABLED"]]) {
    test(`${fichier} : plus de constante écrite dans le code, l'onglet Téléphone suit l'interrupteur`, () => {
      const p = lire(fichier);
      expect(p).not.toMatch(new RegExp(`^const ${nom} = (true|false);`, "m"));
      expect(p).toContain(`const ${nom} = useConnexionTelephoneOuverte();`);
      expect(p).toContain(`{${nom} && (`); // l'onglet n'existe que si ouvert
      expect(p).toContain(`${nom} && authMethod === "phone"`); // le formulaire téléphone aussi
      expect(p).toMatch(/useState\("email"\)/); // l'onglet par défaut est l'e-mail
    });
  }
});

test.describe("application", () => {
  test("interrupteur fermé par défaut dans l'application (aussi tant que la table est illisible)", () => {
    expect(lire("mobile/src/lib/featureFlags.ts")).toContain("feat_connexion_telephone: coupe(),");
  });
  test("connexion : onglet Téléphone masqué et jamais utilisé quand c'est fermé", () => {
    const l = lire("mobile/src/app/(auth)/login.tsx");
    expect(l).toContain("const telephoneOuvert = useFonctionnalite('feat_connexion_telephone');");
    expect(l).toContain("const parTelephone = telephoneOuvert && onglet === 'telephone';");
    expect(l).toMatch(/\{telephoneOuvert \? \(\s*<View className="flex-row mt-4"/);
    expect(l).toContain("\n      ) : null}\n"); // la barre d'onglets est refermée par la condition
  });
  test("inscription : sélecteur Téléphone masqué et méthode forcée sur l'e-mail quand c'est fermé", () => {
    const r = lire("mobile/src/app/(auth)/register.tsx");
    expect(r).toContain("const methode: Methode = telephoneOuvert ? methodeChoisie : 'email';");
    expect(r).toMatch(/\{telephoneOuvert \? \(\s*<View className="flex-row rounded-\[14px\] p-1 mt-4"/);
  });
});

test.describe("migration", () => {
  test("une seule ligne, FERMÉE, visiteurs autorisés, retour arrière présent, rien de plus", () => {
    const m = lire("supabase/migrations/20261025220000_interrupteur_connexion_telephone.sql");
    expect(m).toMatch(/VALUES \('feat_connexion_telephone', 'branch_candidat', '[^']+', NULL, FALSE, '\{"user": true, "visitor": true, "recruiter": true\}'::jsonb\)/);
    expect(m).toContain("ON CONFLICT (id) DO NOTHING");
    expect(m).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER|CREATE|GRANT|REVOKE)\b\s/);
    expect(lire("docs/rollbacks/20261025220000_interrupteur_connexion_telephone.down.sql")).toContain("DELETE FROM public.feature_flags WHERE id = 'feat_connexion_telephone'");
  });
});
