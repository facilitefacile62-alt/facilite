import EcranLangue from '@/components/EcranLangue';

// Choix de la langue ouvert depuis le menu ☰ de Locaux : même écran que celui de Facilité (/mon-profil/langue), mais affiché DANS la pile
// Marketplace pour que la barre du bas reste celle de Locaux (règle : ne jamais mélanger les deux plateformes).
export default function LangueMarketplaceScreen() {
  return <EcranLangue repli="/marketplace/menu" />;
}
