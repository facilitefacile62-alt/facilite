import { Redirect } from 'expo-router';

// Le « Tableau de bord » est retiré du système jusqu'aux prochaines mises à jour (23/10/2026) : plus aucun lien n'y mène, et ce
// chemin renvoie à « Ma boutique ». Le code de l'écran est conservé dans l'historique git (avant le commit de ce retrait).
export default function TableauDeBordRetire() {
  return <Redirect href="/marketplace/vendre/ma-boutique" />;
}
