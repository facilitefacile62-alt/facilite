const fs = require("fs");
const path = require("path");

const PROD_REF = "ocfhzwwjvljintabxxlg";

/**
 * Charge les identifiants du projet Supabase de TEST (.env.test.local),
 * jamais .env.local (production) — remplace loadEnvLocal(), dupliqué dans
 * chaque fichier de test jusqu'ici. Renvoie les mêmes noms de clé
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY) que l'ancien loadEnvLocal() pour que le reste
 * de chaque test n'ait pas besoin de changer, seulement l'import.
 *
 * Garde-fou : refuse de démarrer si TEST_SUPABASE_URL est absente ou
 * pointe vers la production — voir aussi playwright.config.js (même
 * vérification, avant même de lancer un test).
 */
function loadTestEnv() {
  const envPath = path.resolve(__dirname, "../../.env.test.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      "REFUS : .env.test.local introuvable — aucun projet Supabase de test configuré. " +
        "Les tests ne doivent jamais tourner sans lui (voir docs, chantier 'projet Supabase de test séparé')."
    );
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const raw = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) raw[match[1]] = match[2].trim();
  }

  const url = raw.TEST_SUPABASE_URL;
  if (!url) {
    throw new Error("REFUS : TEST_SUPABASE_URL absente de .env.test.local.");
  }
  if (url.includes(PROD_REF)) {
    throw new Error(`REFUS : tentative de connexion à la base de production (${PROD_REF}) depuis les tests.`);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.TEST_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: raw.TEST_SUPABASE_SERVICE_ROLE_KEY,
  };
}

module.exports = { loadTestEnv, PROD_REF };
