import EcranEtiquettes from '@/components/EcranEtiquettes';

// Centres d'intérêt — maquette 53. Données réelles : profiles.interests
// (tableau de chaînes, voir src/app/profil/page.js côté web).
export default function ProfilCentresInteretScreen() {
  return (
    <EcranEtiquettes
      titre="Centres d'intérêt"
      champ="interests"
      libelleAjout="+ Ajouter un centre d'intérêt"
      placeholder="Ex : Bénévolat"
    />
  );
}
