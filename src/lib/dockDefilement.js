/**
 * Centre `element` dans le défileur horizontal `defileur` en ne faisant
 * défiler QUE ce défileur.
 *
 * Remplace element.scrollIntoView() : celui-ci fait aussi défiler tous les
 * ancêtres défilables, la PAGE comprise (mesuré : window.scrollY passait de 0
 * à 712 px quand on cliquait les flèches du dock dans une fenêtre basse).
 */
export function centrerDansDefileur(defileur, element) {
  if (!defileur || !element) return;
  const d = defileur.getBoundingClientRect();
  const e = element.getBoundingClientRect();
  const gauche = defileur.scrollLeft + (e.left - d.left) - (d.width - e.width) / 2;
  // L'aimant CSS (scroll-snap) se bat avec un défilement lissé lancé en JS :
  // il rattrape la position à chaque changement de mise en page et le dock
  // fait des va-et-vient. On le suspend le temps du défilement.
  defileur.style.scrollSnapType = "none";
  defileur.scrollTo({ left: Math.max(0, gauche), behavior: "smooth" });
  clearTimeout(defileur.__minuterieAimant);
  defileur.__minuterieAimant = setTimeout(() => {
    defileur.style.scrollSnapType = "";
  }, 700);
}
