import EcranCoordonnees from '@/components/EcranCoordonnees';

// Coordonnées ouvertes depuis Locaux : écran complet (téléphone, WhatsApp, e-mail, ville verrouillée, pays), rattaché à la plateforme Locaux
// pour garder son en-tête et sa barre du bas (jamais de mélange entre les deux plateformes).
export default function CoordonneesLocauxScreen() {
  return <EcranCoordonnees variante="locaux" />;
}
