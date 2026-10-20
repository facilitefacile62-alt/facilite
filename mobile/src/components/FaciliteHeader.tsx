import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import BasculePlateforme from '@/components/BasculePlateforme';
import { CleVectorielle } from '@/components/EcranConnexion';
import PanneauNotifications from '@/components/PanneauNotifications';
import PastilleCompteur from '@/components/PastilleCompteur';
import { useCompteursNonLus } from '@/lib/useCompteursNonLus';

// En-tête de la plateforme Facilité (maquettes 01, 03, 05, 14, 42, 47...) :
// fond #e3dbcc comme la barre du bas (charte §1.2), logo clé + « ffacilite » à
// gauche (logo clé + « ffacilite » en vert foncé depuis les maquettes du 12/10), puis recherche, cloche et menu — icônes posées à plat, sans
// pastille grise circulaire.
//
// La variante sombre a été retirée : les maquettes « Accueil » (01) et
// « Offres » (03) montrent ce même en-tête crème, alors que le code le
// rendait en #0B0E14 sur ces deux écrans. Les écrans réellement sombres du
// design (Recherche 04, Fiche offre 07) n'utilisent pas cet en-tête, ils
// ont le leur avec un bouton retour rond.
const FOND = '#e3dbcc';
const VERT_FONCE = '#0B3D2A';
const ICONE = '#1A1A1A';

export default function FaciliteHeader() {
  const router = useRouter();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const compteurs = useCompteursNonLus();

  return (
    <View style={{ backgroundColor: FOND, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          paddingVertical: 13,
          gap: 12,
        }}>
        {/* Logo clé dans son disque menthe + « ffacilite » (nouvelles maquettes du 12/10/2026). */}
        <Pressable onPress={() => router.navigate('/')} accessibilityLabel="Accueil ffacilite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#C4F3DD', alignItems: 'center', justifyContent: 'center' }}>
            <CleVectorielle hauteur={20} />
          </View>
          <Text style={{ color: VERT_FONCE, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>ffacilite</Text>
        </Pressable>

        {/* Bascule FIXE, centrée sur l'écran (même position sur Facilité et Locaux), puis cloche, loupe dans sa pastille grise et menu : même disposition que Locaux
            (choix du 20/10/2026). */}
        <View style={{ flex: 1 }} />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <BasculePlateforme plateforme="facilite" />
        </View>

        <Pressable
          onPress={() => setNotifsOuvertes(true)}
          accessibilityLabel="Notifications"
          hitSlop={8}>
          <View>
            <Ionicons name="notifications-outline" size={20} color={ICONE} />
            <PastilleCompteur valeur={compteurs.notifications} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/recherche')}
          accessibilityLabel="Rechercher"
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.08)' }}>
          <Ionicons name="search" size={18} color={ICONE} />
        </Pressable>

        <Pressable onPress={() => router.push('/menu')} accessibilityLabel="Menu" hitSlop={8}>
          <Ionicons name="menu" size={22} color={ICONE} />
        </Pressable>
      </View>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
    </View>
  );
}
