// Liens ENTRANTS de l'application : logique PURE (aucun import), testable seule. Elle traduit l'adresse reçue du système (facilite://…, https://ffacilite.com/…)
// en un chemin qui EXISTE dans l'application, pour qu'aucun lien n'aboutisse à « Unmatched Route ».
//
// Cas relevé en production (2.0.1) : le retour de connexion Google arrive par facilite://auth/callback ; les jetons sont déjà lus par la fenêtre de connexion, mais
// le routeur tentait aussi d'ouvrir une page « auth/callback » qui n'existe pas. Ici ce lien mène simplement à l'accueil (sans conserver les jetons de l'adresse).

/** Premiers segments de chemin qui existent dans l'application. */
export const ECRANS_CONNUS = [
  'marketplace', 'offre', 'entreprise', 'chat', 'menu', 'recherche', 'mon-profil', 'nouveau-mot-de-passe', 'confirmer-compte', 'onboarding', 'aide-video',
  'fonctionnalites', 'candidature-spontanee', 'document', 'ecrire-email', 'web', 'offres', 'autour', 'messages', 'profil', 'extracteur',
] as const;

/** Écrans dont l'adresse garde ses paramètres (retour d'un lien de sécurité). Pour tous les autres, les paramètres sont retirés. */
const AVEC_PARAMETRES = ['nouveau-mot-de-passe', 'confirmer-compte'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITES = ['ffacilite.com', 'www.ffacilite.com'];

export function cheminInterne(entree: string | null | undefined): string {
  const s = String(entree ?? '').trim();
  if (!s) return '/';
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(s);
  let chemin: string;
  let requete = '';
  if (!m) {
    const [sans] = s.split('#');
    const [c, q] = sans.split('?');
    chemin = c.startsWith('/') ? c : `/${c}`;
    requete = q ? `?${q}` : '';
  } else {
    const schema = m[1].toLowerCase();
    const hote = m[2].toLowerCase();
    requete = m[4] ?? '';
    if (schema === 'https' || schema === 'http') {
      if (!SITES.includes(hote)) return '/';
      chemin = m[3] || '/';
    } else if (schema === 'facilite') {
      chemin = `/${hote}${m[3] ?? ''}`; // dans facilite://auth/callback, « auth » est l'hôte
    } else {
      chemin = (m[3] ?? '').replace(/^\/--/, '') || '/'; // exp://…/--/chemin (développement)
    }
  }
  chemin = chemin.replace(/\/+$/, '') || '/';
  if (/^\/auth(\/|$)/.test(chemin)) return '/';
  const segments = chemin.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  // Lien d'article partagé : https://ffacilite.com/marketplace?article=<id> -> la fiche de l'article.
  if (segments[0] === 'marketplace' && segments.length === 1) {
    const id = new URLSearchParams(requete).get('article');
    return id && UUID.test(id) ? `/marketplace/${id}` : '/marketplace';
  }
  // Offre du site : /offres/<id> -> /offre/<id> de l'application.
  if (segments[0] === 'offres' && segments.length >= 2 && UUID.test(segments[1])) return `/offre/${segments[1]}`;
  if (!(ECRANS_CONNUS as readonly string[]).includes(segments[0])) return '/';
  // Les écrans « onglets » sont à la racine de l'application.
  const garde = AVEC_PARAMETRES.includes(segments[0]) ? requete : '';
  return `${chemin}${garde}`;
}
