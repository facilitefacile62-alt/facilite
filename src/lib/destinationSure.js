/**
 * Destination de redirection fournie par l'extérieur (paramètre ?next=) : uniquement un chemin interne du site.
 * Refuse tout ce qui pourrait mener hors du site : « //hote » (URL sans schéma), « /\hote » (certains navigateurs
 * traitent \ comme /), les adresses absolues, les caractères de contrôle.
 */
export function destinationSure(valeur, parDefaut = "/") {
  if (typeof valeur !== "string" || valeur.length === 0 || valeur.length > 2000) return parDefaut;
  if (!valeur.startsWith("/")) return parDefaut;
  if (valeur.startsWith("//") || valeur.startsWith("/\\")) return parDefaut;
  if (/[\u0000-\u001f\u007f]/.test(valeur)) return parDefaut;
  return valeur;
}
