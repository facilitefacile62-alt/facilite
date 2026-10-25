import EcranInformationsCompte from '@/components/EcranInformationsCompte';

// Même écran, ouvert depuis Locaux : rattaché à la plateforme Locaux pour garder sa barre du bas (même compte, mêmes règles côté serveur).
export default function InformationsCompteLocauxScreen() {
  return <EcranInformationsCompte />;
}
