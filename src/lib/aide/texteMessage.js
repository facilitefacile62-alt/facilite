// Mise en forme du TEXTE d'un message (assistant, historique, équipe) pour l'affichage dans une bulle.
// Pure et sans HTML : le résultat est une liste de blocs { type: "p" | "ul", lignes | items } que le composant
// affiche avec des éléments React ordinaires (le texte reste échappé : jamais de dangerouslySetInnerHTML).
//  - les sauts de ligne sont respectés (un « \n » littéral, comme en écrit certains éditeurs, est converti en vrai saut) ;
//  - les lignes qui commencent par « - », « • », « – » ou « * » suivi d'une espace forment une vraie liste ;
//  - une ligne vide sépare deux blocs.

const PUCE = /^\s*[-•–*]\s+(.*)$/;

/** Retire les retours chariot et convertit les « \n » écrits en toutes lettres quand le texte n'a aucun vrai saut de ligne. */
export function normaliserSauts(texte) {
  let t = String(texte ?? "").replace(/\r\n?/g, "\n");
  if (!t.includes("\n") && t.includes("\\n")) t = t.replace(/\\n/g, "\n");
  return t.trim();
}

/** @returns {Array<{type: "p", lignes: string[]} | {type: "ul", items: string[]}>} */
export function decouperTexte(texte) {
  const blocs = [];
  let courant = null; // bloc en cours (paragraphe ou liste)
  const fermer = () => {
    if (courant) blocs.push(courant);
    courant = null;
  };
  for (const brute of normaliserSauts(texte).split("\n")) {
    if (!brute.trim()) {
      fermer();
      continue;
    }
    const puce = PUCE.exec(brute);
    if (puce) {
      if (courant?.type !== "ul") {
        fermer();
        courant = { type: "ul", items: [] };
      }
      // « • A • B » sur une seule ligne : la puce • est sans ambiguïté, on sépare. (Le tiret, lui, peut être un simple trait d'union.)
      const morceaux = brute.trim().startsWith("•") ? puce[1].split(/\s+•\s+/) : [puce[1]];
      for (const m of morceaux) if (m.trim()) courant.items.push(m.trim());
    } else {
      if (courant?.type !== "p") {
        fermer();
        courant = { type: "p", lignes: [] };
      }
      courant.lignes.push(brute.trim());
    }
  }
  fermer();
  return blocs;
}
