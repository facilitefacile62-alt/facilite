import EcranCoordonnees from '@/components/EcranCoordonnees';

// Paramètres de Facilité > Coordonnées : téléphone et e-mail seulement (ce qui sert à récupérer le compte), sans ville ni WhatsApp.
export default function ProfilCoordonneesScreen() {
  return <EcranCoordonnees variante="compte" />;
}
