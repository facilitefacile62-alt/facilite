import type { useRouter } from 'expo-router';

// Catalogue des outils, partagé par l'écran « Fonctionnalités » (maquette 13)
// et l'onglet « Fonctionnalités » du profil (maquette 38) — les deux
// montrent la même liste, elle ne doit exister qu'une fois.
//
// Titres, sous-titres et ordre des 8 premiers outils : maquettes du 12/10/2026.
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
    titre: 'Compresser PDF',
    sous: 'Optimisation',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'fusionner',
    type: 'pdf',
    icone: '📎',
    bg: '#DBEAFE',
    titre: 'Fusionner PDF',
    sous: 'Outil PDF',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'diviser',
    type: 'pdf',
    icone: '✂️',
    bg: '#FEF3C7',
    titre: 'Diviser PDF',
    sous: 'Outil PDF',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'organiser',
    type: 'pdf',
    icone: '🗂️',
    bg: '#D1FAE5',
    titre: 'Organiser PDF',
    sous: 'Outil PDF',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'jpg_en_pdf',
    type: 'pdf',
    icone: '🖼️',
    bg: '#FCE7F3',
    titre: 'JPG en PDF',
    sous: 'Conversion',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'pdf_en_jpg',
    type: 'pdf',
    icone: '📷',
    bg: '#EDE9FE',
    titre: 'PDF en JPG',
    sous: 'Conversion',
    ouvrir: (router) => router.push(OUTILS_PDF_SITE()),
  },
  {
    id: 'extracteur_ia',
    type: 'ia',
    icone: '⚡',
    bg: '#FEF3C7',
    titre: 'Extracteur 1-Click',
    sous: 'Outil IA',
    ouvrir: (router) => router.push('/extracteur'),
  },
  {
    id: 'boite_idees',
    type: 'ia',
    icone: '💡',
    bg: '#EDE9FE',
    titre: 'Boîte à idées',
    sous: 'Collaboratif',
    ouvrir: (router) => router.push('/web/boite-a-idees'),
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
