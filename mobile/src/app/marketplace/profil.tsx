import { Redirect } from 'expo-router';

// L'ancienne page « Profil » de Locaux est supprimée (décision du 23/10/2026) : le bouton Profil ouvre directement « Ma boutique »,
// où l'on choisit de devenir actif (vendeur) ou de rester visiteur.
export default function ProfilMarketplaceScreen() {
  return <Redirect href="/marketplace/vendre?profil=1" />;
}
