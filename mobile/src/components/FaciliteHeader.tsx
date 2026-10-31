import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import ImageVariante from '@/components/ImageVariante';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import BasculePlateforme from '@/components/BasculePlateforme';
import { CleVectorielle } from '@/components/EcranConnexion';
import PanneauNotifications from '@/components/PanneauNotifications';
import PastilleCompteur from '@/components/PastilleCompteur';
import PastilleMiseAJour from '@/components/PastilleMiseAJour';
import { placeStories } from '@/lib/entetePlaceLogique';
import { useMiseAJour } from '@/lib/miseAJour';
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

export type PetiteStory = { id: string; imageUrl: string; titre: string; index: number; vue?: boolean };

// `petitesStories` : stories non vues, en petits cercles à côté du logo quand la rangée a disparu au défilement
// (maquette 09) ; vide = rien à afficher (aucun doublon quand tout est vu, maquette 16).
export default function FaciliteHeader({ petitesStories = [], onStory, accueil = false }: { petitesStories?: PetiteStory[]; onStory?: (index: number) => void; accueil?: boolean } = {}) {
  const router = useRouter();
  const maj = useMiseAJour();
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const compteurs = useCompteursNonLus();
  // Téléphone étroit : les ronds de stories ne doivent jamais être cachés par la bascule. On garde ce qui tient (jusqu'à 3) et, au besoin, on retire le
  // mot « ffacilite » (le logo reste) pour leur laisser la place.
  const { width: largeurEcran } = useWindowDimensions();
  const serre = accueil && petitesStories.length > 0;
  const place = placeStories(largeurEcran, petitesStories.length);

  return (
    <View style={{ backgroundColor: FOND, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: serre ? 12 : 16,
          paddingVertical: 13,
          gap: 8,
        }}>
        {/* Logo clé dans son disque menthe + « ffacilite » (nouvelles maquettes du 12/10/2026). */}
        <Pressable onPress={() => router.navigate('/')} accessibilityLabel="Accueil ffacilite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#C4F3DD', alignItems: 'center', justifyContent: 'center' }}>
            <CleVectorielle hauteur={20} />
          </View>
          {serre && place.sansMot ? null : <Text style={{ color: VERT_FONCE, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 }}>ffacilite</Text>}
        </Pressable>

        {/* Bascule Facilité ⇄ Locaux : FIXE, à droite, juste avant la loupe, sur tous les écrans (même position que dans
            Locaux, choix du 20/10/2026). Sur l'Accueil, les petits ronds de stories prennent la place libre à côté du logo. */}
        {!accueil || petitesStories.length === 0 ? <View style={{ flex: 1 }} /> : null}

        {accueil && petitesStories.length > 0 ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, marginRight: 4, overflow: 'hidden' }}>
            {petitesStories.slice(0, place.ronds).map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => onStory?.(s.index)}
                accessibilityLabel={`Story : ${s.titre}`}
                hitSlop={4}
                style={{ marginLeft: i === 0 ? 0 : -7, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: s.vue ? '#C4C4C4' : '#10E688', backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                <ImageVariante uri={s.imageUrl} largeur={480} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: serre ? 8 : 12, flexShrink: 0 }}>
          <BasculePlateforme plateforme="facilite" />
          <Pressable
            onPress={() => router.push('/recherche')}
            accessibilityLabel="Rechercher"
            style={{ width: serre ? 32 : 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
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

          <Pressable onPress={() => router.push('/menu')} accessibilityLabel="Menu" hitSlop={10}>
            <Ionicons name="menu" size={22} color={ICONE} />
            <PastilleMiseAJour visible={Boolean(maj.disponible)} fond={FOND} />
          </Pressable>
        </View>
      </View>

      <PanneauNotifications visible={notifsOuvertes} onFermer={() => setNotifsOuvertes(false)} />
    </View>
  );
}
