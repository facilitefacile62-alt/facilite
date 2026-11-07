"use client";

import { decouperTexte } from "@/lib/aide/texteMessage";

// Texte d'une bulle : sauts de ligne respectés, lignes « - » / « • » affichées en vraie liste.
// Aucun HTML brut : React échappe le texte, rien venant du message n'est interprété comme balise.
export default function TexteMessage({ texte }) {
  const blocs = decouperTexte(texte);
  return (
    <>
      {blocs.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className={`list-disc pl-5 space-y-0.5 ${i > 0 ? "mt-1.5" : ""}`}>
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {b.lignes.map((ligne, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {ligne}
              </span>
            ))}
          </p>
        )
      )}
    </>
  );
}
