// Table de config pour mobile/src/app/web/[cle].tsx — chaque entrée
// décrit une page du site web (ffacilite.com) embarquée dans une WebView
// native plutôt que reconstruite en écran natif (pages lourdes, peu
// utilisées sur mobile, ou déjà bien faites côté web). `authRequise`
// détermine si l'écran doit d'abord passer par le pont de session
// (/auth/mobile-bridge) avant de charger `chemin`.
//
// `cle` sert aussi de valeur au champ `cible` envoyé au pont de session —
// le serveur tient sa PROPRE liste blanche (ALLOWED_MOBILE_BRIDGE_TARGETS,
// src/app/auth/mobile-bridge/route.js), volontairement pas partagée avec
// ce fichier : aucun chemin arbitraire n'est jamais accepté, seulement une
// clé que le serveur connaît déjà lui-même. Toute clé ajoutée ici doit
// l'être aussi côté serveur.
//
// Une fois la page ouverte, la navigation reste possible partout sur le
// site (même origine, session posée) : ces clés ne sont que des POINTS
// D'ENTRÉE.
export type CleEcranWeb =
  | 'marketplace'
  | 'creer-cv'
  | 'modeles'
  | 'importer-cv'
  | 'aide-candidature'
  | 'mes-cvs'
  | 'candidatures'
  | 'candidat'
  | 'mon-activite'
  | 'profil'
  | 'securite'
  | 'facturation'
  | 'premium'
  | 'suppression-compte'
  | 'fonctionnalites'
  | 'etablissements'
  | 'concours'
  | 'formations'
  | 'recrutement-journalier'
  | 'boite-a-idees'
  | 'faq'
  | 'service'
  | 'conditions-utilisation'
  | 'confidentialite'
  | 'recruteur'
  | 'admin'
  | 'offre';

export type EcranWebConfig = {
  titre: string;
  chemin: string;
  authRequise: boolean;
};

const protege = (titre: string, chemin: string): EcranWebConfig => ({ titre, chemin, authRequise: true });

export const WEB_ECRANS: Record<CleEcranWeb, EcranWebConfig> = {
  marketplace: { titre: 'Marketplace', chemin: '/marketplace', authRequise: false },
  'creer-cv': protege('Créer mon CV', '/creer-cv'),
  modeles: protege('Modèles de CV', '/modeles'),
  'importer-cv': protege('Importer mon CV', '/importer-cv'),
  'aide-candidature': protege('Aide à la candidature', '/aide-candidature'),
  'mes-cvs': protege('Mes CV et documents', '/candidat/mes-cvs'),
  candidatures: protege('Mes candidatures', '/candidat/candidatures'),
  candidat: protege('Espace candidat', '/candidat'),
  'mon-activite': protege('Mon activité', '/mon-activite'),
  profil: protege('Mon profil complet', '/profil'),
  securite: protege('Sécurité du compte', '/candidat/securite'),
  facturation: protege('Facturation', '/candidat/facturation'),
  premium: protege('Premium', '/premium'),
  'suppression-compte': protege('Suppression du compte', '/suppression-compte'),
  fonctionnalites: protege('Outils PDF et documents', '/fonctionnalites'),
  etablissements: protege('Établissements', '/etablissements'),
  concours: protege('Concours', '/concours'),
  formations: protege('Formations', '/formations'),
  'recrutement-journalier': protege('Recrutement journalier', '/recrutement-journalier'),
  'boite-a-idees': protege('Boîte à idées', '/boite-a-idees'),
  faq: protege('Questions fréquentes', '/faq'),
  service: protege('Nos services', '/service'),
  'conditions-utilisation': protege("Conditions d'utilisation", '/conditions-utilisation'),
  confidentialite: protege('Confidentialité', '/confidentialite'),
  recruteur: protege('Espace recruteur', '/recruteur'),
  admin: protege('Administration', '/admin'),
  // Une offre précise : le paramètre `id` (UUID) est contrôlé par le serveur.
  offre: protege('Offre', '/offres'),
};

export const SITE_URL = 'https://ffacilite.com';
