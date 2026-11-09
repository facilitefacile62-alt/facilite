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
// Un « ! » collé devant la marque (« ![cite: 13] », syntaxe d'image Markdown laissée par la copie) en fait partie, sauf s'il termine un mot : « Venez nombreux![cite: 3] »
// garde son point d'exclamation.
const MARQUE = String.raw`(?:(?<![^\s])!)?(?:${MARQUES.join("|")})`;
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

// Préfixes de gabarit laissés en tête d'un titre ou d'une description (« Titre du poste ou de l'offre : Chargé de clientèle »). Seulement tout au début du texte.
const PREFIXE_GABARIT = new RegExp(
  String.raw`^[ \t]*(?:titre|intitul[ée])(?:[ \t]+(?:du[ \t]+poste|de[ \t]+poste|de[ \t]+l['’](?:offre|annonce|emploi)))?(?:[ \t]+ou[ \t]+(?:de[ \t]+l['’](?:offre|annonce|emploi)|du[ \t]+poste))?[ \t]*:[ \t]*`,
  "i"
);

/** Texte d'une offre prêt à l'AFFICHAGE : marques de copie retirées, puis préfixe de gabarit en tête retiré. Un texte sans l'un ni l'autre est renvoyé identique. */
export function nettoyerPourAffichage(texte) {
  if (typeof texte !== "string") return texte;
  return retirerMarquesCopie(texte).replace(PREFIXE_GABARIT, "");
}

/** Copie de l'offre dont le titre et la description sont nettoyés pour l'affichage (les autres champs et l'original ne sont pas touchés). */
export function nettoyerOffreAffichee(offre) {
  if (!offre || typeof offre !== "object") return offre;
  return { ...offre, title: nettoyerPourAffichage(offre.title), description: nettoyerPourAffichage(offre.description) };
}

/** Liste d'offres nettoyée pour l'affichage (même longueur, même ordre : aucune offre n'est retirée). */
export function nettoyerOffresAffichees(offres) {
  return Array.isArray(offres) ? offres.map(nettoyerOffreAffichee) : offres;
}

/** Carte d'offre déjà mise en forme pour l'accueil (titleFR, titleEN, descFR, descEN) : textes nettoyés pour l'affichage, autres champs intacts. */
export function nettoyerCarteOffre(carte) {
  if (!carte || typeof carte !== "object") return carte;
  return {
    ...carte,
    titleFR: nettoyerPourAffichage(carte.titleFR),
    titleEN: nettoyerPourAffichage(carte.titleEN),
    descFR: nettoyerPourAffichage(carte.descFR),
    descEN: nettoyerPourAffichage(carte.descEN),
  };
}
