const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Récupération du mot de passe dans l'app mobile : lecture du lien reçu par e-mail, validation du nouveau mot de passe,
 * traduction des erreurs. Le module testé est de la logique pure (aucun import) : on le transpile à la volée, sans lancer l'app.
 */
function charger() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../mobile/src/lib/recuperationMotDePasse.ts"), "utf-8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } });
  const module_ = { exports: {} };
  new Function("module", "exports", outputText)(module_, module_.exports);
  return module_.exports;
}

const { lireLienRecuperation, lienExploitable, verifierNouveauMotDePasse, verifierChangementMotDePasse, messageErreurMiseAJour, LONGUEUR_MIN_MDP } = charger();

test.describe("lien de récupération", () => {
  test("jetons dans le fragment (#) : session exploitable", () => {
    const lien = lireLienRecuperation("facilite://nouveau-mot-de-passe#access_token=aaa.bbb.ccc&refresh_token=rrr&expires_in=3600&type=recovery");
    expect(lien).toMatchObject({ accessToken: "aaa.bbb.ccc", refreshToken: "rrr", code: null, erreur: null });
    expect(lienExploitable(lien)).toBe(true);
  });

  test("code PKCE dans la requête (?) : exploitable", () => {
    const lien = lireLienRecuperation("exp://192.168.1.5:8081/--/nouveau-mot-de-passe?code=abc123");
    expect(lien.code).toBe("abc123");
    expect(lienExploitable(lien)).toBe(true);
  });

  test("lien expiré ou refusé : erreur reconnue, jamais exploitable", () => {
    const expire = lireLienRecuperation("facilite://nouveau-mot-de-passe#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(expire.erreur).toBe("expire");
    expect(lienExploitable(expire)).toBe(false);
    const autre = lireLienRecuperation("facilite://nouveau-mot-de-passe?error=server_error&error_description=boom");
    expect(autre.erreur).toBe("invalide");
  });

  test("lien vide, sans jeton, ou avec un seul jeton : non exploitable", () => {
    expect(lienExploitable(lireLienRecuperation(null))).toBe(false);
    expect(lienExploitable(lireLienRecuperation("facilite://nouveau-mot-de-passe"))).toBe(false);
    expect(lienExploitable(lireLienRecuperation("facilite://nouveau-mot-de-passe#access_token=seul"))).toBe(false);
    expect(lienExploitable(lireLienRecuperation("facilite://nouveau-mot-de-passe#access_token=%E0%A4%A"))).toBe(false);
  });
});

test.describe("nouveau mot de passe", () => {
  test("trop court, différent de la confirmation, ou valide", () => {
    expect(verifierNouveauMotDePasse("court", "court")).toMatch(new RegExp(`${LONGUEUR_MIN_MDP} caractères`));
    expect(verifierNouveauMotDePasse("motdepasse123", "motdepasse124")).toMatch(/ne correspondent pas/);
    expect(verifierNouveauMotDePasse("motdepasse123", "motdepasse123")).toBeNull();
  });

  test("erreurs de Supabase traduites en français, sans texte brut", () => {
    expect(messageErreurMiseAJour("New password should be different from the old password.")).toMatch(/différent de l'ancien/);
    expect(messageErreurMiseAJour("Password is known to be weak")).toMatch(/trop simple/);
    expect(messageErreurMiseAJour("Auth session missing!")).toMatch(/expiré/);
    expect(messageErreurMiseAJour("boom")).toMatch(/Impossible d'enregistrer/);
    expect(messageErreurMiseAJour(null)).toMatch(/Impossible d'enregistrer/);
  });
});

test.describe("changement d'un mot de passe existant (l'ancien est exigé)", () => {
  test("ancien absent, nouveau trop court, confirmation différente, identique à l'ancien : refusés", () => {
    expect(verifierChangementMotDePasse("", "nouveau-mdp-123", "nouveau-mdp-123")).toMatch(/mot de passe actuel/);
    expect(verifierChangementMotDePasse("ancien-mdp-123", "court", "court")).toMatch(/caractères/);
    expect(verifierChangementMotDePasse("ancien-mdp-123", "nouveau-mdp-123", "nouveau-mdp-124")).toMatch(/ne correspondent pas/);
    expect(verifierChangementMotDePasse("meme-mdp-1234", "meme-mdp-1234", "meme-mdp-1234")).toMatch(/différent de l'ancien/);
  });

  test("tout est correct : accepté", () => {
    expect(verifierChangementMotDePasse("ancien-mdp-123", "nouveau-mdp-123", "nouveau-mdp-123")).toBeNull();
  });
});
