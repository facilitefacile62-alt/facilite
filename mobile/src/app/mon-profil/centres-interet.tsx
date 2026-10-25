import EcranEtiquettes from '@/components/EcranEtiquettes';

// Centres d'intérêt — lecture seule, issus du CV scanné ou importé (profiles.interests, tableau de chaînes).
export default function ProfilCentresInteretScreen() {
  return <EcranEtiquettes titre="Centres d'intérêt" champ="interests" />;
}
