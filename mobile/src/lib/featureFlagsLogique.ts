// Règles PURES des interrupteurs de l'application (sans aucun import : testables seules). La lecture de la table feature_flags, l'abonnement en direct et les hooks
// sont dans featureFlags.ts.
//
// Interrupteurs de l'APPLICATION : un identifiant listé ci-dessous prend sa valeur par défaut tant que la table n'est pas lue et si elle est illisible. Les
// interrupteurs ajoutés pour la première version Android (feat_paiements_application, feat_scanner_document, feat_app_*) sont déclarés FERMÉS : s'ils sont
// illisibles, la fonction reste cachée. Un identifiant NON listé est autorisé (comme sur le site). Un administrateur voit toujours tout.

export type Roles = { user?: boolean; recruiter?: boolean; visitor?: boolean };
export type Interrupteur = { enabled: boolean; roles: Roles };

const TOUS: Roles = { user: true, recruiter: true, visitor: true };
const CONNECTES: Roles = { user: true, recruiter: true, visitor: false };
const actif = (roles: Roles = TOUS): Interrupteur => ({ enabled: true, roles });
const coupe = (roles: Roles = TOUS): Interrupteur => ({ enabled: false, roles });

// Seuls les interrupteurs qui ont un équivalent dans l'application sont listés. Un identifiant
// inconnu est AUTORISÉ (comme sur le site).
export const PAR_DEFAUT: Record<string, Interrupteur> = {
  nav_offres: actif(),
  nav_extracteur: actif(),
  nav_messagerie: actif(),
  nav_marketplace: actif(),
  // En pause pour le public (18/10/2026) : livraison et commandes sont gardées pour la mise à jour suivante.
  nav_marketplace_livreur: coupe(),
  feat_marketplace_commandes: coupe(),
  nav_marketplace_voyages: coupe(CONNECTES),
  nav_plus_fonctionnalites: actif(),
  nav_plus_recrutement_spontane: actif(),
  feat_diagnostic_cv: actif(),
  feat_voice_assistant: coupe({ user: false, recruiter: false, visitor: false }),
  feat_marketplace_ia: coupe(),
  // Connexion et inscription par téléphone (SMS) : FERMÉES par défaut et tant que la table est illisible — seuls « Continuer avec Google » et l'e-mail sont proposés.
  feat_connexion_telephone: coupe(),
  // Paiements dans l'application (jetons, Premium de Locaux, formation, achat de CV, facturation) : FERMÉS par défaut, sur Android comme sur iPhone (où ils restent
  // de toute façon masqués) ; interrupteur illisible = fermés.
  feat_paiements_application: coupe(),
};

export type Role = 'admin' | 'recruiter' | 'user' | 'visitor';

/** Vrai si la fonctionnalité est ouverte pour ce rôle (l'administrateur a toujours accès à tout). */
export function fonctionnaliteAutorisee(id: string, role: Role, instantane: Record<string, Interrupteur>): boolean {
  if (role === 'admin') return true;
  const f = instantane[id];
  if (!f) return true;
  if (!f.enabled) return false;
  return f.roles?.[role] !== false;
}

/** Vrai si TOUS les interrupteurs sont ouverts pour ce rôle (une fonction qui dépend de plusieurs interrupteurs, dont certains partagés avec le site). */
export function tousAutorises(ids: string | string[] | undefined, role: Role, instantane: Record<string, Interrupteur>): boolean {
  if (!ids) return true;
  return (Array.isArray(ids) ? ids : [ids]).every((id) => fonctionnaliteAutorisee(id, role, instantane));
}
