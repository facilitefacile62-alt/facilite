import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PastilleCompteur from '@/components/PastilleCompteur';
import { useCompteursNonLus } from '@/lib/useCompteursNonLus';

// Barre du bas de la plateforme Facilité (Accueil · Offres · Extracteur ·
// Messages · Profil), charte §1.1-§1.2 : fond #e3dbcc, actif vert #10B981
// avec icône pleine, inactif rgba(0,0,0,0.6), libellés 10,5 px gras.
//
// Elle est rendue à deux endroits parce que les écrans de Facilité vivent à
// deux endroits : comme `tabBar` du groupe (tabs) pour les cinq onglets, et
// sous le Stack racine pour les écrans poussés par-dessus (fiche offre,
// chat, recherche, profil détaillé...). La règle §1.1 veut la barre visible
// partout, y compris sur ces pages de détail.
//
// Pendant qu'un écran hors onglet est affiché, AUCUNE entrée n'est active
// quand il n'appartient à aucun onglet : vérifié sur les maquettes
// « Recherche » (04), « Fonctionnalités » (13) et « Candidature
// spontanée » (14), où les cinq entrées sont grises. À l'inverse la fiche
// offre (07) garde Offres en vert et les sous-pages du profil (47-56)
// gardent Profil en vert.
const VERT = '#10B981';
const FOND = '#e3dbcc';
const INACTIF = 'rgba(0,0,0,0.6)';

type IdEntree = 'accueil' | 'offres' | 'extracteur' | 'messages' | 'profil';

type Entree = {
  id: IdEntree;
  libelle: string;
  icone: keyof typeof Ionicons.glyphMap;
  iconeActive: keyof typeof Ionicons.glyphMap;
  cible: string;
};

const ENTREES: Entree[] = [
  { id: 'accueil', libelle: 'Accueil', icone: 'home-outline', iconeActive: 'home', cible: '/' },
  { id: 'offres', libelle: 'Offres', icone: 'briefcase-outline', iconeActive: 'briefcase', cible: '/offres' },
  { id: 'extracteur', libelle: 'Extracteur', icone: 'flash-outline', iconeActive: 'flash', cible: '/extracteur' },
  { id: 'messages', libelle: 'Messages', icone: 'chatbubble-outline', iconeActive: 'chatbubble', cible: '/messages' },
  { id: 'profil', libelle: 'Profil', icone: 'person-outline', iconeActive: 'person', cible: '/profil' },
];

export function entreeActiveFacilite(chemin: string): IdEntree | null {
  if (chemin === '/' || chemin === '') return 'accueil';
  if (chemin.startsWith('/offres') || chemin.startsWith('/offre/')) return 'offres';
  if (chemin.startsWith('/extracteur')) return 'extracteur';
  if (chemin.startsWith('/messages') || chemin.startsWith('/chat/')) return 'messages';
  if (chemin.startsWith('/profil') || chemin.startsWith('/mon-profil')) return 'profil';
  return null;
}

export default function FaciliteBottomBar() {
  const router = useRouter();
  const chemin = usePathname();
  const insets = useSafeAreaInsets();
  const compteurs = useCompteursNonLus();
  const active = entreeActiveFacilite(chemin);

  return (
    <View
      style={{
        backgroundColor: FOND,
        paddingBottom: Math.max(insets.bottom, 6),
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
      }}>
      <View className="flex-row">
        {ENTREES.map((e) => {
          const estActif = active === e.id;
          const couleur = estActif ? VERT : INACTIF;
          return (
            <Pressable
              key={e.id}
              onPress={() => router.navigate(e.cible as Href)}
              accessibilityRole="tab"
              accessibilityLabel={e.libelle}
              accessibilityState={{ selected: estActif }}
              className="flex-1 items-center justify-center py-2 min-h-[52px]">
              <View>
                <Ionicons name={estActif ? e.iconeActive : e.icone} size={22} color={couleur} />
                {e.id === 'messages' ? <PastilleCompteur valeur={compteurs.messages} /> : null}
              </View>
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
