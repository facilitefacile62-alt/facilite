import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Barre du bas de la plateforme Marketplace (maquettes : Accueil · Autour de
// moi · Publier · Messages · Profil). Elle reste affichée sur toutes les pages
// de la plateforme, y compris les fiches détail (règle §1 de la charte).
// Facilité garde sa propre barre (Accueil · Offres · Extracteur · Messages · Profil).
//
// « Autour de moi » (mise à jour du 12/10/2026) ne change plus de page : un
// appui déplie, juste au-dessus de la barre, une ligne de 3 pilules blanches
// (Articles proches · Mini carte · Pleine carte) ; un nouvel appui la replie.
// La ligne fait partie de la barre, qui est un bloc sous la pile des pages :
// en s'agrandissant elle POUSSE le contenu vers le haut au lieu de le
// recouvrir, et le contenu redescend quand elle se replie.
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
  { id: 'autour', libelle: 'Autour de moi', icone: 'location-outline', iconeActive: 'location', cible: '/marketplace/autour' },
  { id: 'publier', libelle: 'Publier', icone: 'add-circle-outline', iconeActive: 'add-circle', cible: '/marketplace/vendre' },
  { id: 'messages', libelle: 'Messages', icone: 'chatbubble-outline', iconeActive: 'chatbubble', cible: '/marketplace/messages' },
  { id: 'profil', libelle: 'Profil', icone: 'person-outline', iconeActive: 'person', cible: '/marketplace/profil' },
];

// Quelle entrée est active pour un chemin donné. Les pages de détail rattachées
// à une entrée (ex. /marketplace/[id] -> Accueil) gardent l'entrée parente active.
function entreeActive(chemin: string): Entree['id'] | null {
  if (chemin.startsWith('/marketplace/profil') || chemin.startsWith('/marketplace/mon-profil') || chemin.startsWith('/marketplace/a-propos')) return 'profil';
  if (chemin.startsWith('/marketplace/autour')) return 'autour';
  if (chemin.startsWith('/marketplace/recherche')) return 'accueil';
  if (chemin.startsWith('/marketplace/vendre')) return 'publier';
  if (chemin.startsWith('/marketplace/messages') || chemin.startsWith('/marketplace/chat')) return 'messages';
  if (chemin.startsWith('/marketplace')) return 'accueil';
  return null;
}

const HAUTEUR_LIGNE = 62;

const PILULES: { id: string; libelle: string; icone: keyof typeof Ionicons.glyphMap; cible: string }[] = [
  { id: 'articles', libelle: 'Articles proches', icone: 'grid-outline', cible: '/marketplace?proches=1' },
  // « Mini carte » est retirée pour le moment (trop compliquée), comme sur le site : Articles proches et Pleine carte restent.
  { id: 'pleine', libelle: 'Pleine carte', icone: 'scan-outline', cible: '/marketplace/autour?onglet=boutiques' },
];

export default function MarketplaceBottomBar() {
  const t = useT();
  const router = useRouter();
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  const [deplie, setDeplie] = useState(false);
  const [hauteur] = useState(() => new Animated.Value(0));
  const active = deplie ? 'autour' : entreeActive(chemin);

  useEffect(() => {
    Animated.timing(hauteur, {
      toValue: deplie ? HAUTEUR_LIGNE : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [deplie, hauteur]);

  const appuyer = (e: Entree) => {
    if (e.id === 'autour') {
      setDeplie((v) => !v);
      return;
    }
    setDeplie(false);
    router.navigate(e.cible as Href);
  };

  return (
    <View style={{ backgroundColor: FOND, paddingBottom: Math.max(insets.bottom, 6), borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
      <Animated.View style={{ height: hauteur, overflow: 'hidden', pointerEvents: deplie ? 'auto' : 'none' }}>
        <View className="flex-row items-center justify-center gap-2 px-3" style={{ height: HAUTEUR_LIGNE }}>
          {PILULES.map((pl) => (
            <Pressable
              key={pl.id}
              onPress={() => {
                setDeplie(false);
                router.navigate(pl.cible as Href);
              }}
              accessibilityRole="button"
              accessibilityLabel={t(pl.libelle)}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-white"
              style={{ height: 44, borderRadius: 22, paddingHorizontal: 6 }}>
              <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#D1FAE5' }}>
                <Ionicons name={pl.icone} size={14} color={VERT} />
              </View>
              <Text className="text-[11.5px] font-black text-[#111]" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t(pl.libelle)}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
      <View className="flex-row">
        {ENTREES.map((e) => {
          const estActif = active === e.id;
          const couleur = estActif ? VERT : 'rgba(0,0,0,0.6)';
          return (
            <Pressable
              key={e.id}
              onPress={() => appuyer(e)}
              accessibilityRole="tab"
              accessibilityState={{ selected: estActif }}
              className="flex-1 items-center justify-center py-2 min-h-[52px]">
              <Ionicons name={estActif ? e.iconeActive : e.icone} size={22} color={couleur} />
              <Text className="text-[10.5px] font-bold mt-0.5" style={{ color: couleur }}>
                {t(e.libelle)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
import { useT } from '@/lib/i18n';
