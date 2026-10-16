// Comparaisons de texte pour les barres de recherche : minuscules et SANS accents, comme sur le site
// (src/lib/texte.js). « creme », « Crème » et « CRÈME » sont équivalents ; côté base, l'équivalent est
// la fonction public.sans_accent() et les colonnes recherche_norm / nom_norm.

export function sansAccent(texte: string | null | undefined): string {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Vrai si `texte` contient `recherche`, sans tenir compte des accents ni des majuscules. */
export function contientSansAccent(texte: string | null | undefined, recherche: string): boolean {
  return sansAccent(texte).includes(sansAccent(recherche));
}

/** Vrai si `texte` contient CHACUN des mots de `recherche`, dans n'importe quel ordre. */
export function contientTousLesMots(texte: string | null | undefined, recherche: string): boolean {
  const cible = sansAccent(texte);
  return sansAccent(recherche)
    .split(/\s+/)
    .filter(Boolean)
    .every((mot) => cible.includes(mot));
}

/** Mot prêt pour un filtre de la base (`ilike`) : sans accents, sans les caractères qui ont un sens dans un filtre. */
export function motPourFiltre(texte: string | null | undefined): string {
  return sansAccent(texte)
    .replace(/[,()%*_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
