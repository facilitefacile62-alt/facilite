// Résidus de copie dans le texte d'une offre : marques de citation laissées par un assistant IA ou un outil de recherche quand l'annonce a été copiée-collée
// (« [cite: 13] », « [cite_start] », « 【4†source】 », « :contentReference[oaicite:0]{index=0} »…). Ils n'ont rien à faire dans une annonce : ils s'affichaient
// tels quels aux candidats et se retrouvaient dans les données structurées envoyées à Google.
//
// Logique pure, sans dépendance. Utilisée à l'affichage de la fiche, dans le JobPosting, dans les métadonnées et AU MOMENT DE LA PUBLICATION (le texte enregistré
// est déjà propre). Elle n'écrit rien en base : les offres déjà enregistrées sont nettoyées à l'affichage seulement.

const MARQUES = [
  // [cite: 13], [cite:13], [cite: 1, 2], [cite_start], [cite_end], [cite] — la parenthèse fermante peut manquer (marque tronquée dans un lien).
  String.raw`\[\s*cite(?:_start|_end)?\b\s*(?::\s*[\d\s,;\-–]*)?\]?`,
  // 【4†source】, 【4:0†source】
  String.raw`【[^】]{0,40}†[^】]{0,80}】`,
  // [4†source]
  String.raw`\[\s*\d+(?::\d+)?\s*†[^\]]{0,80}\]`,
  // :contentReference[oaicite:0]{index=0} et [oaicite:0]
  String.raw`:?contentReference\[oaicite:\d+\](?:\{index=\d+\})?`,
  String.raw`\[oaicite:\d+\]`,
];
const MARQUE = `(?:${MARQUES.join("|")})`;
const CONTIENT_MARQUE = new RegExp(MARQUE, "i");
// Marque(s) en début de ligne : on retire aussi l'espace qui les suit.
const DEBUT_DE_LIGNE = new RegExp(`(^|\\n)[ \\t]*(?:${MARQUE}[ \\t]*)+`, "gi");
// Marque au milieu d'une ligne : on retire aussi l'espace qui la précède.
const MILIEU_DE_LIGNE = new RegExp(`[ \\t]*${MARQUE}`, "gi");

/** Texte sans les marques de copie. Un texte sans marque est renvoyé IDENTIQUE ; une valeur qui n'est pas du texte est renvoyée telle quelle. */
export function retirerMarquesCopie(texte) {
  if (typeof texte !== "string" || !CONTIENT_MARQUE.test(texte)) return texte;
  const sansDebut = texte.replace(DEBUT_DE_LIGNE, "$1");
  return sansDebut.replace(MILIEU_DE_LIGNE, (marque, position, entier) => {
    const apres = entier[position + marque.length];
    // Suivie d'une espace, d'une fin de ligne, d'une fin de texte ou d'une ponctuation : rien à laisser (« phrase [cite: 3]. » devient « phrase. »).
    // Collée à un mot : une espace, pour ne pas souder les deux mots.
    return apres === undefined || /[\s.,;:!?)\]]/.test(apres) ? "" : " ";
  });
}

/** Copie de l'offre dont le titre et la description sont nettoyés (les autres champs ne sont pas touchés). */
export function nettoyerOffreAffichee(offre) {
  if (!offre || typeof offre !== "object") return offre;
  return { ...offre, title: retirerMarquesCopie(offre.title), description: retirerMarquesCopie(offre.description) };
}
