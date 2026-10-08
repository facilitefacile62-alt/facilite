import EcranEtiquettes from '@/components/EcranEtiquettes';

// Compétences — maquette 52. Données réelles : profiles.skills (tableau de
// chaînes, voir src/app/profil/page.js côté web).
export default function ProfilCompetencesScreen() {
  return (
    <EcranEtiquettes
      titre="Compétences"
      champ="skills"
      libelleAjout="+ Ajouter une compétence"
      placeholder="Ex : Rédaction juridique"
    />
  );
}
