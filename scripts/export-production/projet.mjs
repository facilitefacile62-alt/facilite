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
