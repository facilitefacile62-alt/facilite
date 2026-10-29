import crypto from "node:crypto";
// Référence du projet Supabase (le « ref » : 20 caractères, pas un secret) lue dans une adresse, et comparaison avec le projet de production.
// Sert de garde-fou : l'export ne doit JAMAIS lire un autre projet (par exemple facilite-e2e-test) en croyant lire la production.
export const REF_PRODUCTION = "ocfhzwwjvljintabxxlg";

/** Ref d'une adresse de connexion Postgres : utilisateur « postgres.<ref> » (pooler) ou hôte « db.<ref>.supabase.co » (direct). null si introuvable. */
export function refDepuisAdresseDb(adresse) {
  const s = String(adresse || "");
  const m = /^postgres(?:ql)?:\/\/postgres\.([a-z0-9]{20}):/.exec(s) || /@db\.([a-z0-9]{20})\.supabase\.co[:/]/.exec(s);
  return m ? m[1] : null;
}

/** Ref de l'adresse de l'API (« https://<ref>.supabase.co »). null si introuvable. */
export function refDepuisUrlApi(url) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co(?:[/:]|$)/.exec(String(url || ""));
  return m ? m[1] : null;
}

/** Lève une erreur claire si les deux refs ne désignent pas le même projet (ou si l'un est introuvable). */
export function exigerMemeProjet(refDb, refApi) {
  if (!refDb) throw new Error("Projet de la base introuvable dans l'adresse de connexion : arrêt par prudence.");
  if (!refApi) throw new Error("Projet de l'API introuvable (NEXT_PUBLIC_SUPABASE_URL) : arrêt par prudence.");
  if (refDb !== refApi) throw new Error(`La base (${refDb}) et l'API des fichiers (${refApi}) sont deux projets différents : arrêt avant tout téléchargement.`);
}

/**
 * Empreinte (SHA-256) d'une liste de fichiers « absents à la source » : le choix de la personne (decision-absents.json) n'est valable que pour CETTE liste précise,
 * jamais pour une autre liste de même taille.
 */
export function empreinteAbsents(entrees) {
  const cles = entrees.map((e) => `${e.bucket}\0${e.chemin}`).sort();
  return crypto.createHash("sha256").update(cles.join("\n")).digest("hex");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Chemin de stockage sans donnée personnelle, pour la console et les rapports : identifiants d'utilisateur réduits à leurs 8 premiers caractères, nom du fichier
 * réduit à sa forme (lettres -> a, chiffres -> 9) et à son extension, plus une référence courte (SHA-256 du chemin entier) qui permet de le retrouver dans le
 * manifeste, lui-même chiffré dans l'archive.
 */
export function masquerChemin(chemin) {
  const segments = String(chemin).split("/");
  const nom = segments.pop() ?? "";
  const dossiers = segments.map((s) => (UUID.test(s) ? `${s.slice(0, 8)}...` : s.replace(/[A-Za-z]/g, "a").replace(/[0-9]/g, "9")));
  const point = nom.lastIndexOf(".");
  const extension = point > 0 ? nom.slice(point).replace(/[^A-Za-z0-9.]/g, "").slice(0, 8) : "";
  const forme = (point > 0 ? nom.slice(0, point) : nom).replace(/[A-Za-z]/g, "a").replace(/[0-9]/g, "9");
  const reference = crypto.createHash("sha256").update(String(chemin)).digest("hex").slice(0, 8);
  return `${[...dossiers, ""].join("/")}${forme}${extension} [ref ${reference}]`;
}
