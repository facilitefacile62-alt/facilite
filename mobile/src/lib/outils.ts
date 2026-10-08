import type { useRouter } from 'expo-router';

// Catalogue des outils, partagé par l'écran « Fonctionnalités » (maquette 13)
// et l'onglet « Fonctionnalités » du profil (maquette 38) — les deux
// montrent la même liste, elle ne doit exister qu'une fois.
//
// Liste alignée sur les VRAIS outils du site
// (src/app/fonctionnalites/FonctionnalitesClient.jsx). Les outils PDF
// s'ouvrent sur la page du site, dans l'app : ils traitent le fichier sur
// l'appareil, comme sur le web. Aucun outil inventé.

export type TypeOutil = 'tous' | 'pdf' | 'ia';

export type Outil = {
  id: string;
  type: 'pdf' | 'ia';
  icone: string;
  bg: string;
  titre: string;
  sous: string;
  ouvrir: (router: ReturnType<typeof useRouter>) => void;
};

const OUTILS_PDF_SITE = () => '/web/fonctionnalites' as const;

export const OUTILS: Outil[] = [
  {
    id: 'compresser',
    type: 'pdf',
    icone: '📉',
    bg: '#E0E7FF',
    titre: 'Compresser un PDF',
    sous: 'Réduire la taille du fichier',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'fusionner',
    type: 'pdf',
    icone: '📎',
    bg: '#DBEAFE',
    titre: 'Fusionner des PDF',
    sous: 'Combiner plusieurs documents',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'diviser',
    type: 'pdf',
    icone: '✂️',
    bg: '#FEF3C7',
    titre: 'Diviser un PDF',
    sous: 'Extraire les pages voulues',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'organiser',
    type: 'pdf',
    icone: '🗂️',
    bg: '#D1FAE5',
    titre: 'Organiser les pages',
    sous: 'Trier, pivoter, supprimer',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'jpg_en_pdf',
    type: 'pdf',
    icone: '🖼️',
    bg: '#FCE7F3',
    titre: 'Convertir JPG en PDF',
    sous: 'Photos vers un seul document',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'pdf_en_jpg',
    type: 'pdf',
    icone: '📷',
    bg: '#EDE9FE',
    titre: 'Convertir PDF en JPG',
    sous: 'Chaque page en image',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'extracteur_ia',
    type: 'ia',
    icone: '⚡',
    bg: '#FEF3C7',
    titre: 'Extracteur 1-Clic',
    sous: 'Candidature depuis une annonce',
    ouvrir: (router) => router.push('/extracteur'),
  },
  {
    id: 'diagnostic_cv',
    type: 'ia',
    icone: '📄',
    bg: '#D1FAE5',
    titre: 'Diagnostic CV Gratuit',
    sous: 'Analyse ATS et mots-clés',
    ouvrir: (router) => router.push('/web/importer-cv'),
  },
  {
    id: 'services_modeles',
    type: 'ia',
    icone: '🎨',
    bg: '#DBEAFE',
    titre: 'Studio Services & Modèles',
    sous: 'CV, lettres et modèles prêts',
    ouvrir: (router) => router.push('/web/modeles'),
  },
  {
    id: 'boite_idees',
    type: 'ia',
    icone: '💡',
    bg: '#EDE9FE',
    titre: 'Boîte à idées',
    sous: 'Proposer une amélioration',
    ouvrir: (router) => router.push('/web/boite-a-idees'),
  },
];

/** Libellés exacts de la maquette 13 (« Tous », pas « Tous les outils »). */
export const ONGLETS_OUTILS: { id: TypeOutil; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'pdf', label: 'PDF & Documents' },
  { id: 'ia', label: 'IA & Carrière' },
];

export function filtrerOutils(type: TypeOutil): Outil[] {
  return type === 'tous' ? OUTILS : OUTILS.filter((o) => o.type === type);
}
