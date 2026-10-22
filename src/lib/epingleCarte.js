// Épingles des cartes de boutiques, façon Google Maps (choix du 22/10/2026) :
//  - pin en forme de goutte, de taille FIXE en pixels à tous les zooms (28 × 36 px ; 36 × 46 px sélectionné, rouge) ;
//  - la POINTE du pin est exactement sur les coordonnées de la boutique (ancre [70, 85] d'une icône de 140 × 90 px) ;
//  - dans la tête du pin : la photo / le logo / l'avatar de la boutique quand il y en a une, sinon un pictogramme blanc selon
//    le type (sac = produits, outil = services, bâtiment = établissements, couverts = restauration) ;
//  - le nom, à droite du pin, dans la couleur du pin avec un contour blanc (halo), tronqué s'il est long ;
//  - rien n'est posé en `transform` sur l'élément racine : Leaflet y place le marqueur avec translate3d.
//
// Le nom reçu doit déjà être ÉCHAPPÉ (echapperHtml) : cette fonction ne l'échappe pas une seconde fois et ne le « dés-échappe »
// jamais (protection XSS des cartes, à ne pas régresser).

export const EPINGLE = {
  normal: { l: 28, h: 36 },
  selectionne: { l: 36, h: 46 },
  couleurSelection: "#EF4444",
  boite: { l: 140, h: 90 },
  ancre: [70, 85],
};

const GLYPHES = {
  produit: '<path d="M6 8h12l-1 11H7L6 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  service: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.2-.6-.6-2.2 2.3-2.2z"/>',
  etablissement: '<path d="M5 20V5h9v15M14 10h5v10M3 20h18"/><path d="M8 8.5h3M8 12h3M8 15.5h3"/>',
  restauration: '<path d="M7 4v6a2 2 0 0 0 2 2v8M7 4v6M11 4v6a2 2 0 0 1-2 2M16 20V4c-2 1.5-3 4-3 7h3"/>',
};

const RESTAURATION = /restau|resto|cafe|café|boulang|patisserie|pâtisserie|fast|traiteur|snack/i;

/** Type d'affichage d'une boutique : produit, service, etablissement ou restauration. */
export function typeEpingle(b) {
  if (b?.type_boutique === "service") return "service";
  if (b?.type_boutique === "etablissement") {
    return RESTAURATION.test(String(b.categorie_etablissement || "")) ? "restauration" : "etablissement";
  }
  return "produit";
}

/**
 * HTML d'une épingle, à placer dans une icône Leaflet de 140 × 90 px dont l'ancre est [70, 85].
 * @param {{ couleur: string, type?: string, nom?: string, selectionne?: boolean, contenuHtml?: string|null }} p
 */
export function htmlEpingle({ couleur, type = "produit", nom = "", selectionne = false, contenuHtml = null }) {
  const d = selectionne ? EPINGLE.selectionne : EPINGLE.normal;
  const couleurPin = selectionne ? EPINGLE.couleurSelection : couleur;
  const gauche = EPINGLE.ancre[0] - d.l / 2;
  const haut = EPINGLE.ancre[1] - d.h;
  const tete = Math.round(d.l * 0.78);
  const margeTete = Math.round((d.l - tete) / 2);
  const aImage = typeof contenuHtml === "string" && /^\s*<(img|svg)/i.test(contenuHtml);
  const interieur = aImage
    ? `<div style="width:100%;height:100%;border-radius:9999px;overflow:hidden;display:flex;align-items:center;justify-content:center;">${contenuHtml}</div>`
    : `<svg width="${Math.round(tete * 0.62)}" height="${Math.round(tete * 0.62)}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHES[type] || GLYPHES.produit}</svg>`;
  const fond = aImage ? "#fff" : couleurPin;
  const etiquette = nom
    ? `<div class="epingle-nom" style="position:absolute;left:${gauche + d.l + 3}px;top:${haut + Math.round(d.h * 0.16)}px;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;font:800 11px/14px system-ui,sans-serif;color:${couleurPin};text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff;">${nom}</div>`
    : "";
  return `<div class="epingle-boite" style="position:relative;width:${EPINGLE.boite.l}px;height:${EPINGLE.boite.h}px;pointer-events:none;">
    <div class="epingle-pin" data-selectionne="${selectionne ? "1" : "0"}" style="position:absolute;left:${gauche}px;top:${haut}px;width:${d.l}px;height:${d.h}px;pointer-events:auto;cursor:pointer;z-index:${selectionne ? 5 : 1};">
      <svg width="${d.l}" height="${d.h}" viewBox="0 0 28 36" style="position:absolute;left:0;top:0;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));" aria-hidden="true"><path d="M14 0.75C6.7 0.75 0.75 6.7 0.75 14c0 9.4 13.25 21.25 13.25 21.25S27.25 23.4 27.25 14C27.25 6.7 21.3 0.75 14 0.75z" fill="${couleurPin}" stroke="#fff" stroke-width="1.5"/></svg>
      <div style="position:absolute;left:${margeTete}px;top:${margeTete}px;width:${tete}px;height:${tete}px;border-radius:9999px;background:${fond};display:flex;align-items:center;justify-content:center;overflow:hidden;">${interieur}</div>
    </div>
    ${etiquette}
  </div>`;
}

/**
 * Densité des noms selon le zoom, sans jamais toucher aux pins :
 *  - vue éloignée (zoom < zoomNoms) : pins seuls, sans texte ;
 *  - vue rapprochée : tous les pins avec leur nom, mais un nom qui en chevaucherait un autre (ou un pin) est masqué ;
 *    le pin de la boutique sélectionnée passe en premier.
 * Renvoie une fonction de nettoyage.
 */
export function brancherDensiteNoms(carte, { zoomNoms = 13 } = {}) {
  let rafId = null;
  const croise = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const appliquer = () => {
    rafId = null;
    const conteneur = carte.getContainer();
    const noms = Array.from(conteneur.querySelectorAll(".epingle-nom"));
    noms.forEach((n) => n.classList.remove("epingle-nom-masque"));
    conteneur.classList.toggle("carte-noms-visibles", carte.getZoom() >= zoomNoms);
    if (carte.getZoom() < zoomNoms) return;
    const pins = Array.from(conteneur.querySelectorAll(".epingle-pin")).map((p) => p.getBoundingClientRect());
    const places = [];
    const ordre = noms.sort((a, b) => {
      const sa = a.parentElement?.querySelector(".epingle-pin")?.dataset.selectionne === "1" ? 0 : 1;
      const sb = b.parentElement?.querySelector(".epingle-pin")?.dataset.selectionne === "1" ? 0 : 1;
      return sa - sb;
    });
    ordre.forEach((n) => {
      const r = n.getBoundingClientRect();
      if (!r.width) return;
      const propre = n.parentElement?.querySelector(".epingle-pin")?.getBoundingClientRect();
      const gene = places.some((p) => croise(r, p)) || pins.some((p) => p !== propre && croise(r, p) && !(propre && p.left === propre.left && p.top === propre.top));
      if (gene) n.classList.add("epingle-nom-masque");
      else places.push(r);
    });
  };
  const planifier = () => {
    if (rafId === null) rafId = requestAnimationFrame(appliquer);
  };
  carte.on("zoomend moveend layeradd layerremove", planifier);
  planifier();
  return () => {
    carte.off("zoomend moveend layeradd layerremove", planifier);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
