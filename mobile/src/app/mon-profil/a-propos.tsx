import ModifierInfosPager from '@/components/ModifierInfosPager';

// « Modifier infos — À propos » : les deux onglets (À propos, Paramètres) sont deux pages d'UN SEUL glisseur, comme « Facilité | Locaux » du menu ☰.
export default function ProfilAProposScreen() {
  return <ModifierInfosPager depart={0} />;
}
