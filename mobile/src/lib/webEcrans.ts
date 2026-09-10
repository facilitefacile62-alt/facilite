// Table de config pour mobile/src/app/web/[cle].tsx — chaque entrée
// décrit une page du site web (ffacilite.com) embarquée dans une WebView
// native plutôt que reconstruite en écran natif (pages lourdes, peu
// utilisées sur mobile, ou déjà bien faites côté web). `authRequise`
// détermine si l'écran doit d'abord passer par le pont de session
// (/auth/mobile-bridge, voir Point 2) avant de charger `chemin`.
//
// `cle` sert aussi de valeur au champ `cible` envoyé au pont de session —
// le serveur tient sa PROPRE liste blanche (ALLOWED_MOBILE_BRIDGE_TARGETS,
// src/app/auth/mobile-bridge/route.js), volontairement pas partagée avec
// ce fichier : aucun chemin arbitraire n'est jamais accepté côté serveur,
// seulement une clé qu'il connaît déjà lui-même.
export type CleEcranWeb = 'marketplace';

export type EcranWebConfig = {
  titre: string;
  chemin: string;
  authRequise: boolean;
};

export const WEB_ECRANS: Record<CleEcranWeb, EcranWebConfig> = {
  marketplace: {
    titre: 'Marketplace',
    chemin: '/marketplace',
    authRequise: false,
  },
};

export const SITE_URL = 'https://ffacilite.com';
