/**
 * Minuscules et sans accents : « Crème », « creme » et « CRÈME » deviennent « creme ».
 * À utiliser pour comparer ce que tape l'utilisateur (souvent sans accents sur téléphone) avec les
 * textes affichés. Côté base, l'équivalent est public.sans_accent().
 */
export function sansAccent(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Vrai si `texte` contient `recherche`, sans tenir compte des accents ni des majuscules. */
export function contientSansAccent(texte, recherche) {
  return sansAccent(texte).includes(sansAccent(recherche));
}

/**
 * Mot prêt à être inséré dans un filtre de la base (`ilike`, `or`) : sans accents, en minuscules, et
 * sans les caractères qui ont un sens dans un filtre (virgule, parenthèses, %, *, _, \). Sans cela,
 * une virgule tapée par l'utilisateur (« ingénieur, dakar ») casse la requête. À comparer à une
 * colonne calculée par public.sans_accent() (recherche_norm, nom_norm).
 */
export function motPourFiltre(texte) {
  return sansAccent(texte).replace(/[,()%*_\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Vrai si `texte` contient CHACUN des mots de `recherche` (dans n'importe quel ordre), sans tenir
 * compte des accents ni des majuscules : « visage creme » trouve « Crème hydratante pour le visage ».
 */
export function contientTousLesMots(texte, recherche) {
  const cible = sansAccent(texte);
  return sansAccent(recherche)
    .split(/\s+/)
    .filter(Boolean)
    .every((mot) => cible.includes(mot));
}
