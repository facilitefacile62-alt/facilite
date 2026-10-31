import Link from "next/link";

const LIEN = /(\[\[[^|\]]+\|[^\]]+\]\])/g;
const LIEN_COMPLET = /^\[\[([^|\]]+)\|([^\]]+)\]\]$/;

// Texte d'une page de conseils : [[/chemin|texte]] devient un lien interne, le reste est du texte simple (React l'échappe).
export default function ConseilTexte({ texte }) {
  return String(texte)
    .split(LIEN)
    .map((morceau, i) => {
      const lien = LIEN_COMPLET.exec(morceau);
      return lien ? (
        <Link key={i} href={lien[1]} className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-300">
          {lien[2]}
        </Link>
      ) : (
        morceau
      );
    });
}
