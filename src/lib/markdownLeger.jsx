/**
 * Rendu d'un markdown minimal dans une bulle de conversation.
 *
 * L'assistant écrit en markdown — **gras**, listes à puces, retours à la
 * ligne — mais le fil affichait la chaîne telle quelle, astérisques compris.
 *
 * Volontairement SANS bibliothèque et SANS dangerouslySetInnerHTML.
 * Le même composant rend aussi les messages écrits par d'autres personnes :
 * injecter du HTML issu d'un champ libre ouvrirait une faille XSS pour
 * économiser une dépendance. Ici tout ressort en éléments React, donc
 * échappé par construction.
 *
 * Portée assumée : gras, italique, puces, numéros. Ni liens, ni titres, ni
 * tableaux — l'assistant n'en produit pas dans une conversation, et chaque
 * règle en plus est une occasion de mal interpréter le texte de quelqu'un.
 */

// Découpe une ligne sur **gras** et *italique*. Le gras est traité d'abord :
// sinon « **texte** » serait vu comme deux marqueurs d'italique accolés.
function rendreInline(texte, cle) {
  const morceaux = [];
  // L'italique exige un caractère NON BLANC juste après l'ouvrant et juste
  // avant le fermant. Sans cette contrainte, « 3 * 4 * 5 » était lu comme un
  // italique autour de « 4 » : une multiplication tapée par quelqu'un se
  // retrouvait déformée. Le gras n'a pas besoin de la même précaution, une
  // paire de doubles astérisques n'arrivant pas par accident.
  const motif = /(\*\*[^*\n]+\*\*|\*[^\s*](?:[^*\n]*[^\s*])?\*)/g;
  let dernier = 0;
  let m;
  let i = 0;

  while ((m = motif.exec(texte)) !== null) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    const brut = m[0];
    if (brut.startsWith("**")) {
      morceaux.push(
        <strong key={`${cle}-g${i}`} className="font-black">
          {brut.slice(2, -2)}
        </strong>
      );
    } else {
      morceaux.push(
        <em key={`${cle}-i${i}`} className="italic">
          {brut.slice(1, -1)}
        </em>
      );
    }
    dernier = m.index + brut.length;
    i += 1;
  }

  if (dernier < texte.length) morceaux.push(texte.slice(dernier));
  return morceaux.length > 0 ? morceaux : texte;
}

export default function MarkdownLeger({ texte, className = "" }) {
  if (typeof texte !== "string" || texte === "") return null;

  const lignes = texte.split("\n");
  const blocs = [];
  let puces = null;

  const viderPuces = () => {
    if (!puces) return;
    const { items, ordonnee, debut } = puces;
    blocs.push(
      ordonnee ? (
        <ol key={`l${blocs.length}`} start={debut} className="list-decimal list-inside space-y-0.5 my-1">
          {items}
        </ol>
      ) : (
        <ul key={`l${blocs.length}`} className="list-disc list-inside space-y-0.5 my-1">
          {items}
        </ul>
      )
    );
    puces = null;
  };

  lignes.forEach((ligne, index) => {
    const nettoyee = ligne.trimStart();
    const puce = nettoyee.match(/^[-*•]\s+(.*)$/);
    const numero = nettoyee.match(/^(\d+)[.)]\s+(.*)$/);

    if (puce) {
      // Une liste à puces qui suivrait une liste numérotée doit ouvrir un
      // nouveau bloc, sinon les deux se mélangeraient dans le même <ol>.
      if (puces && puces.ordonnee) viderPuces();
      if (!puces) puces = { items: [], ordonnee: false, debut: 1 };
      puces.items.push(<li key={`i${index}`}>{rendreInline(puce[1], `i${index}`)}</li>);
      return;
    }

    if (numero) {
      if (puces && !puces.ordonnee) viderPuces();
      if (!puces) puces = { items: [], ordonnee: true, debut: parseInt(numero[1], 10) || 1 };
      puces.items.push(<li key={`i${index}`}>{rendreInline(numero[2], `i${index}`)}</li>);
      return;
    }

    viderPuces();

    if (nettoyee === "") {
      // Ligne vide : un espacement, pas un paragraphe vide qui creuserait un
      // trou dans la bulle.
      blocs.push(<span key={`v${index}`} className="block h-2" aria-hidden="true" />);
      return;
    }

    blocs.push(
      <p key={`p${index}`} className="whitespace-pre-wrap break-words">
        {rendreInline(ligne, `p${index}`)}
      </p>
    );
  });

  viderPuces();

  return <div className={className}>{blocs}</div>;
}
