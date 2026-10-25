// Écrans et pages du site MASQUÉS dans l'application (première version Android) : règles PURES (sans import), testables seules.
//
// Chaque règle associe des chemins à des interrupteurs ; l'écran est atteignable seulement si TOUS ses interrupteurs sont ouverts (voir tousAutorises dans
// featureFlagsLogique.ts : illisible = fermé pour les interrupteurs propres à l'application, un administrateur voit tout). Deux usages :
//  - garde GLOBALE des écrans de l'application (liens profonds, notifications, boutons, raccourcis : tout passe par la navigation) ;
//  - pages du SITE ouvertes dans l'application : un lien suivi dans une page ne peut pas mener à une page masquée.
// Rien n'est supprimé : rouvrir un interrupteur suffit.

type Parametres = Record<string, string | string[] | undefined>;

type RegleEcran = { chemins: string[]; interrupteurs: string[]; quand?: (params: Parametres) => boolean };

// Interrupteurs partagés avec le site (nav_*, feat_diagnostic_cv) + interrupteur propre à l'application : les deux doivent être ouverts.
const EXTRACTEUR = ['nav_extracteur', 'feat_app_extracteur'];
const FONCTIONNALITES = ['nav_plus_fonctionnalites', 'feat_app_fonctionnalites'];
const DIAGNOSTIC = ['feat_diagnostic_cv', 'feat_app_diagnostic_cv'];
const BOITE_IDEES = ['nav_plus_boite_idees', 'feat_app_boite_idees'];
const CREER_CV = ['feat_app_creer_cv'];
const MODELES_CV = ['feat_app_modeles_cv'];

export const REGLES_ECRANS: RegleEcran[] = [
  { chemins: ['/extracteur'], interrupteurs: EXTRACTEUR },
  { chemins: ['/fonctionnalites', '/web/fonctionnalites'], interrupteurs: FONCTIONNALITES },
  { chemins: ['/web/creer-cv'], interrupteurs: CREER_CV },
  { chemins: ['/web/modeles'], interrupteurs: MODELES_CV },
  { chemins: ['/web/boite-a-idees'], interrupteurs: BOITE_IDEES },
  // Le diagnostic est une entrée de la page d'import de CV : seule l'entrée « diagnostic » est masquée (voir outils.ts et menu.tsx).
  { chemins: ['/web/importer-cv'], interrupteurs: DIAGNOSTIC, quand: (p) => String(p.aide ?? '') === 'diagnostic_cv' },
];

const correspond = (chemin: string, prefixes: string[]): boolean => prefixes.some((p) => chemin === p || chemin.startsWith(`${p}/`));

/** Interrupteurs qui doivent TOUS être ouverts pour atteindre cet écran de l'application (liste vide : écran toujours accessible). */
export function interrupteursEcran(pathname: string, params: Parametres = {}): string[] {
  const chemin = (pathname || '/').split(/[?#]/)[0];
  const ids: string[] = [];
  for (const r of REGLES_ECRANS) if (correspond(chemin, r.chemins) && (!r.quand || r.quand(params))) ids.push(...r.interrupteurs);
  return [...new Set(ids)];
}

// Pages du SITE (même origine) qui mènent aux outils masqués : bloquées quand on les suit depuis une page du site ouverte dans l'application.
const REGLES_PAGES_SITE: { chemins: string[]; interrupteurs: string[] }[] = [
  { chemins: ['/creer-cv'], interrupteurs: CREER_CV },
  { chemins: ['/modeles'], interrupteurs: MODELES_CV },
  { chemins: ['/fonctionnalites'], interrupteurs: FONCTIONNALITES },
  { chemins: ['/boite-a-idees'], interrupteurs: BOITE_IDEES },
  { chemins: ['/candidat/extracteur'], interrupteurs: EXTRACTEUR },
];

/** Interrupteurs à tous ouvrir pour suivre ce lien du site (liste vide : lien autorisé). */
export function interrupteursPageSite(url: string): string[] {
  const chemin = (url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  const ids: string[] = [];
  for (const r of REGLES_PAGES_SITE) if (correspond(chemin, r.chemins)) ids.push(...r.interrupteurs);
  return [...new Set(ids)];
}
