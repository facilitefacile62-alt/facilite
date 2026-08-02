/**
 * JSON.stringify n'échappe ni "<" ni "/" : une valeur contenant la séquence
 * littérale "</script>" (ex: la description d'une offre d'emploi saisie par
 * un recruteur) casse hors du bloc <script type="application/ld+json"> et
 * permet d'injecter du HTML/JS arbitraire, exécuté pour tout visiteur de la
 * page (XSS stocké). "<" est remplacé par son échappement unicode, invisible
 * pour un parseur JSON mais qui ne peut plus refermer une balise HTML.
 */
export function safeJsonLdString(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
