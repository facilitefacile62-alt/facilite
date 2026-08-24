/**
 * Rendu des liens contenus dans un texte libre (description d'offre,
 * informations complémentaires).
 *
 * Diagnostic à l'origine (2026-08-24) : `offer.description` était rendue en
 * TEXTE NU dans un `whitespace-pre-line` (OffreDetailClient.js), sans
 * aucune conversion URL → <a>, et la fiche d'offre ne contenait pas une
 * seule classe `break-words` / `break-all` / `truncate`. Une URL longue est
 * un token insécable : elle débordait horizontalement de la carte, et
 * n'était même pas cliquable.
 *
 * Deux exigences tenues ensemble ici :
 *   - le `href` porte TOUJOURS l'URL complète, jamais la version raccourcie ;
 *   - le TEXTE affiché est raccourci au-delà de LONGUEUR_MAX_AFFICHEE, et
 *     `break-all` garantit qu'un mot long restant se coupe au lieu de
 *     pousser la carte.
 */

// Capture les URL http(s), les www. sans protocole et les adresses e-mail.
// Les parenthèses/ponctuation finales sont volontairement exclues du motif
// pour ne pas avaler le point d'une fin de phrase.
const MOTIF_LIENS = /((?:https?:\/\/|www\.)[^\s<>"')\]]+[^\s<>"')\].,;:!?]|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;

const LONGUEUR_MAX_AFFICHEE = 48;

/** Raccourcit l'AFFICHAGE d'une URL sans jamais toucher au href. */
export function raccourcirPourAffichage(url) {
  if (typeof url !== "string" || url.length <= LONGUEUR_MAX_AFFICHEE) return url;
  try {
    const u = new URL(url.startsWith("www.") ? `https://${url}` : url);
    let dernierSegment = "";
    if (u.searchParams.has("id")) {
      const idParam = decodeURIComponent(u.searchParams.get("id") || "");
      dernierSegment = idParam.split("/").filter(Boolean).pop() || "";
    } else if (u.searchParams.has("file") || u.searchParams.has("filename") || u.searchParams.has("doc")) {
      const fileParam = decodeURIComponent(u.searchParams.get("file") || u.searchParams.get("filename") || u.searchParams.get("doc") || "");
      dernierSegment = fileParam.split("/").filter(Boolean).pop() || "";
    } else {
      dernierSegment = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    }
    const court = dernierSegment ? `${u.host}/…/${dernierSegment}` : u.host;
    return court.length < url.length ? court : `${url.slice(0, LONGUEUR_MAX_AFFICHEE - 1)}…`;
  } catch {
    return `${url.slice(0, LONGUEUR_MAX_AFFICHEE - 1)}…`;
  }
}

function hrefDe(fragment) {
  if (fragment.includes("@") && !fragment.startsWith("http")) return `mailto:${fragment}`;
  if (fragment.startsWith("www.")) return `https://${fragment}`;
  return fragment;
}

/**
 * Rend un texte en conservant ses sauts de ligne, chaque URL/e-mail devenant
 * un vrai lien cliquable. `rel="noopener noreferrer"` sur tous les liens
 * externes.
 */
export function TexteAvecLiens({ texte, className = "" }) {
  if (!texte || typeof texte !== "string") return null;

  const fragments = texte.split(MOTIF_LIENS);

  return (
    <span className={`whitespace-pre-line break-words max-w-full overflow-hidden ${className}`}>
      {fragments.map((fragment, i) => {
        if (!fragment) return null;
        if (i % 2 === 1) {
          const href = hrefDe(fragment);
          return (
            <a
              key={i}
              href={href}
              target={href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              title={fragment}
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2 font-semibold break-all max-w-full inline cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {raccourcirPourAffichage(fragment)}
            </a>
          );
        }
        return <span key={i} className="break-words">{fragment}</span>;
      })}
    </span>
  );
}
