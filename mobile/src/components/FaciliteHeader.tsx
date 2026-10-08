import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import PanneauMenuProfil from '@/components/PanneauMenuProfil';
import PanneauNotifications from '@/components/PanneauNotifications';
import PastilleCompteur from '@/components/PastilleCompteur';
import { useCompteursNonLus } from '@/lib/useCompteursNonLus';

// En-tête de la plateforme Facilité (maquettes 01, 03, 05, 14, 42, 47...) :
// fond #e3dbcc comme la barre du bas (charte §1.2), « Facilité » en bleu à
// gauche, puis recherche, cloche et menu — icônes posées à plat, sans
// pastille grise circulaire.
//
// La variante sombre a été retirée : les maquettes « Accueil » (01) et
// « Offres » (03) montrent ce même en-tête crème, alors que le code le
// rendait en #0B0E14 sur ces deux écrans. Les écrans réellement sombres du
// design (Recherche 04, Fiche offre 07) n'utilisent pas cet en-tête, ils
// ont le leur avec un bouton retour rond.
const FOND = '#e3dbcc';
const BLEU = '#2563EB';
const ICONE = '#1A1A1A';

export default function FaciliteHeader() {
  const router = useRouter();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const compteurs = useCompteursNonLus();

  return (
    <View style={{ backgroundColor: FOND, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 13,
        }}>
        <Pressable onPress={() => router.navigate('/')} accessibilityLabel="Accueil Facilité">
          <Text style={{ color: BLEU, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>Facilité</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable
            onPress={() => router.push('/recherche')}
            accessibilityLabel="Rechercher"
            hitSlop={10}>
            <Ionicons name="search" size={20} color={ICONE} />
          </Pressable>

          <Pressable
            onPress={() => setNotifsOuvertes(true)}
            accessibilityLabel="Notifications"
            hitSlop={10}>
            <View>
              <Ionicons name="notifications-outline" size={20} color={ICONE} />
              <PastilleCompteur valeur={compteurs.notifications} />
            </View>
          </Pressable>

          <Pressable onPress={() => setMenuOuvert(true)} accessibilityLabel="Menu" hitSlop={10}>
            <Ionicons name="menu" size={22} color={ICONE} />
          </Pressable>
        </View>
      </View>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
      <PanneauMenuProfil visible={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}
