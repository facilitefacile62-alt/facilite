import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Barre du bas de la plateforme Marketplace (maquettes : Accueil · Autour de
// moi · Publier · Messages · Profil). Elle reste affichée sur toutes les pages
// de la plateforme, y compris les fiches détail (règle §1 de la charte).
// Facilité garde sa propre barre (Accueil · Offres · Extracteur · Messages · Profil).
const VERT = '#10B981';
const FOND = '#e3dbcc';

type Entree = {
  id: 'accueil' | 'autour' | 'publier' | 'messages' | 'profil';
  libelle: string;
  icone: keyof typeof Ionicons.glyphMap;
  iconeActive: keyof typeof Ionicons.glyphMap;
  // Chemin cible. « Autour de moi » ouvre l'accueil avec le menu de localisation.
  cible: string;
};

const ENTREES: Entree[] = [
  { id: 'accueil', libelle: 'Accueil', icone: 'home-outline', iconeActive: 'home', cible: '/marketplace' },
  { id: 'autour', libelle: 'Autour de moi', icone: 'location-outline', iconeActive: 'location', cible: '/marketplace?autour=1' },
  { id: 'publier', libelle: 'Publier', icone: 'add-circle-outline', iconeActive: 'add-circle', cible: '/marketplace/vendre' },
  { id: 'messages', libelle: 'Messages', icone: 'chatbubble-outline', iconeActive: 'chatbubble', cible: '/messages' },
  { id: 'profil', libelle: 'Profil', icone: 'person-outline', iconeActive: 'person', cible: '/marketplace/profil' },
];

// Quelle entrée est active pour un chemin donné. Les pages de détail rattachées
// à une entrée (ex. /marketplace/[id] -> Accueil) gardent l'entrée parente active.
function entreeActive(chemin: string): Entree['id'] | null {
  if (chemin.startsWith('/marketplace/profil') || chemin.startsWith('/marketplace/a-propos')) return 'profil';
  if (chemin.startsWith('/marketplace/vendre')) return 'publier';
  if (chemin.startsWith('/messages')) return 'messages';
  if (chemin.startsWith('/marketplace')) return 'accueil';
  return null;
}

export default function MarketplaceBottomBar() {
  const router = useRouter();
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  const active = entreeActive(chemin);

  return (
    <View style={{ backgroundColor: FOND, paddingBottom: Math.max(insets.bottom, 6), borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
      <View className="flex-row">
        {ENTREES.map((e) => {
          const estActif = active === e.id;
          const couleur = estActif ? VERT : 'rgba(0,0,0,0.6)';
          return (
            <Pressable
              key={e.id}
              onPress={() => router.navigate(e.cible as never)}
              accessibilityRole="tab"
              accessibilityState={{ selected: estActif }}
              className="flex-1 items-center justify-center py-2 min-h-[52px]">
              <Ionicons name={estActif ? e.iconeActive : e.icone} size={22} color={couleur} />
              <Text className="text-[10.5px] font-bold mt-0.5" style={{ color: couleur }}>
                {e.libelle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
