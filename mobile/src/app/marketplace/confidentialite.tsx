import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { FOND_CARTES } from '@/components/CarteMenu';
import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques, definirVisibiliteBoutique, type MaBoutique } from '@/lib/vendeur';

// Confidentialité de Locaux : la politique PROPRE À LA BOUTIQUE (ce que les visiteurs voient, ce qui reste privé, ce que le vendeur
// maîtrise), et non celle de Facilité (CV, recruteurs). Le seul réglage qui a une fonction réelle derrière est la visibilité de la
// boutique (definir_visibilite_boutique) ; aucun autre interrupteur n'est affiché, faute de colonne en base pour le faire fonctionner.
const PUBLIC = [
  'Le nom de votre boutique, son logo et sa photo de couverture',
  'Votre quartier, votre ville et l’emplacement de la boutique sur la carte « Autour de moi »',
  'Vos articles : photos, titre, description, prix et disponibilité',
  'Votre numéro WhatsApp, utilisé par les acheteurs pour vous contacter depuis une annonce',
];
const PRIVE = [
  'Vos échanges dans la messagerie : seuls vous et votre interlocuteur peuvent les lire',
  'Votre e-mail, votre mot de passe et votre date de naissance',
  'Vos informations personnelles et vos pièces d’identité',
];

function Liste({ lignes, icone, couleur }: { lignes: string[]; icone: 'checkmark-circle' | 'lock-closed'; couleur: string }) {
  return (
    <View className="gap-2.5">
      {lignes.map((l) => (
        <View key={l} className="flex-row items-start gap-2.5">
          <Ionicons name={icone} size={16} color={couleur} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[13px] leading-[19px]" style={{ color: 'rgba(0,0,0,0.75)' }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ConfidentialiteMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [enCours, setEnCours] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      chargerMesBoutiques(userId)
        .then((l) => setBoutique(l[0] ?? null))
        .catch(() => setBoutique(null))
        .finally(() => setChargement(false));
    }, [userId])
  );

  async function basculer(visible: boolean) {
    if (!boutique || enCours) return;
    setEnCours(true);
    try {
      await definirVisibiliteBoutique(boutique.id, visible);
      setBoutique({ ...boutique, actif: visible });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de modifier la visibilité.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
      <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
        <MarketplaceHeader />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/reglages' as Href))}
            accessibilityLabel="Retour"
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF' }}>
            <Ionicons name="arrow-back" size={19} color="#2563EB" />
          </Pressable>
          <Text className="flex-1 text-center text-[15px] font-black tracking-widest" style={{ marginRight: 44 }} numberOfLines={1}>CONFIDENTIALITÉ</Text>
        </View>

        <View className="px-4 gap-3.5">
          {chargement ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : boutique ? (
            <View className="bg-white rounded-[18px] px-4 py-3.5 flex-row items-center gap-3">
              <View className="flex-1 min-w-0">
                <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Boutique visible</Text>
                <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>
                  {boutique.actif ? 'Les visiteurs voient votre boutique et vos articles' : 'Votre boutique et vos articles sont masqués'}
                </Text>
              </View>
              <Switch value={boutique.actif} onValueChange={basculer} disabled={enCours} trackColor={{ true: '#10B981' }} />
            </View>
          ) : null}

          <View className="bg-white rounded-[18px] px-4 py-4 gap-3">
            <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Ce que les visiteurs voient</Text>
            <Liste lignes={PUBLIC} icone="checkmark-circle" couleur="#10B981" />
          </View>

          <View className="bg-white rounded-[18px] px-4 py-4 gap-3">
            <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Ce qui reste privé</Text>
            <Liste lignes={PRIVE} icone="lock-closed" couleur="#2563EB" />
          </View>

          <View className="bg-white rounded-[18px] px-4 py-4 gap-2">
            <Text className="text-[14.5px] font-extrabold text-[#1A1A1A]">Vos droits</Text>
            <Text className="text-[13px] leading-[19px]" style={{ color: 'rgba(0,0,0,0.75)' }}>
              Vous pouvez masquer votre boutique à tout moment, modifier ou retirer un article, et changer les informations de votre
              boutique.
            </Text>
          </View>

          <View className="bg-white rounded-[18px] px-4">
            <Pressable onPress={() => router.push('/web/conditions-utilisation' as Href)} className="py-4">
              <Text className="text-[13.5px] font-bold text-[#2563EB]">Conditions d’utilisation</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/web/confidentialite' as Href)} className="py-4 border-t border-black/[0.06]">
              <Text className="text-[13.5px] font-bold text-[#2563EB]">Politique de confidentialité de Facilité</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
