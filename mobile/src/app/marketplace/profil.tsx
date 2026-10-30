import { useFonctionnalite } from '@/lib/featureFlags';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarProfil from '@/components/AvatarProfil';
import { LigneMenu } from '@/components/LigneMenu';
import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// Profil Marketplace (maquettes « Visiteur — Profil » et « Vendeur — Profil »).
// Le badge et les lignes dépendent du rôle : VISITEUR sans boutique, BOUTIQUE avec une boutique.
const VERT_PROFOND = '#0d3b34';

export default function ProfilMarketplaceScreen() {
  const router = useRouter();
  // Interrupteurs du site (Administration → Fonctionnalités).
  const livreurOuvert = useFonctionnalite('nav_marketplace_livreur');
  const commandesOuvertes = useFonctionnalite('feat_marketplace_commandes');
  const voyagesOuverts = useFonctionnalite('nav_marketplace_voyages');
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const liste = await chargerMesBoutiques(userId);
      setBoutique(liste[0] ?? null);
    } catch {
      setBoutique(null);
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  const nom = (profile?.full_name as string | undefined) || user?.email || 'Mon compte';
  const telephone = (profile?.phone as string | undefined) || '';
  const estVendeur = Boolean(boutique);

  // Vendeur : le bouton Profil ouvre directement « Ma boutique » (cette page-menu ne sert qu'aux visiteurs).
  if (!chargement && userId && estVendeur) return <Redirect href="/marketplace/vendre/ma-boutique?profil=1" />;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {!userId ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour voir votre profil Locaux.</Text>
            <Pressable onPress={() => router.push('/login')} className="rounded-2xl px-6 py-3" style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[14px] font-bold">Se connecter</Text>
            </Pressable>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-3 pt-3 pb-6 gap-3" showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => router.push('/marketplace/mon-profil' as Href)}
              className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
              {/* Profil de Locaux séparé de celui de Facilité : initiale du nom (le logo se règle sur la boutique, « Modifier infos »). */}
              <AvatarProfil valeur={null} nom={nom} taille={64} />
              <View className="flex-1">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-[17px] font-black text-[#1A1A1A]" numberOfLines={1}>
                    {nom}
                  </Text>
                  <View className={`rounded-full px-2 py-0.5 ${estVendeur ? 'bg-[#D1FAE5]' : 'bg-[#FEF3C7]'}`}>
                    <Text className={`text-[10px] font-black tracking-wide ${estVendeur ? 'text-[#047857]' : 'text-[#B45309]'}`}>
                      {estVendeur ? 'BOUTIQUE' : 'VISITEUR'}
                    </Text>
                  </View>
                </View>
                {telephone ? <Text className="text-[12.5px] text-gray-500 mt-0.5">{telephone}</Text> : null}
              </View>
            </Pressable>

            {/* Visiteur : Ma boutique (Devenir Vendeur), À propos, Mes commandes, Réglages
                (maquette 59). Vendeur : Ma boutique (Voir ma boutique), Tableau de bord,
                Commandes reçues, Mes livraisons, Réglages (maquette 70). */}
            <View className="bg-white rounded-[18px] overflow-hidden">
              <LigneMenu
                emoji="🏪"
                titre="Ma boutique"
                droite={
                  <Text className="text-[13px] font-extrabold" style={{ color: '#047857' }}>
                    {estVendeur ? 'Voir ma boutique' : 'Devenir actif'}
                  </Text>
                }
                onPress={() => router.push('/marketplace/vendre')}
              />
              {estVendeur ? (
                <>
                  {commandesOuvertes ? (
                    <LigneMenu
                      emoji="📦"
                      titre="Commandes reçues"
                      onPress={() => router.push(`/marketplace/vendre/commandes-recues?storeId=${boutique?.id}`)}
                    />
                  ) : null}
                  {livreurOuvert ? <LigneMenu emoji="🛵" titre="Mes livraisons" onPress={() => router.push('/marketplace/livraisons')} /> : null}
                  {voyagesOuverts ? (
                    <>
                      <LigneMenu emoji="🚗" titre="Voyages" onPress={() => router.push('/marketplace/voyages' as Href)} />
                      <LigneMenu emoji="🧑‍✈️" titre="Mes voyages (chauffeur)" onPress={() => router.push('/marketplace/mes-voyages' as Href)} />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {/* « À propos » et « Réglages » ne font plus qu'un seul bouton : « Modifier infos » (la page À propos garde son bouton Réglages). */}
                  {commandesOuvertes ? <LigneMenu emoji="📦" titre="Mes commandes" onPress={() => router.push('/marketplace/commandes')} /> : null}
                  {/* Seul bouton « transport » ouvert à tous : plus il y a de livreurs, plus on en trouve dans sa zone. */}
                  {livreurOuvert ? <LigneMenu emoji="🛵" titre="Devenir livreur" onPress={() => router.push('/marketplace/vendre/livreur')} /> : null}
                  {voyagesOuverts ? (
                    <>
                      <LigneMenu emoji="🚗" titre="Voyages" onPress={() => router.push('/marketplace/voyages' as Href)} />
                      <LigneMenu emoji="🧑‍✈️" titre="Mes voyages (chauffeur)" onPress={() => router.push('/marketplace/mes-voyages' as Href)} />
                    </>
                  ) : null}
                </>
              )}
              <LigneMenu emoji="✏️" titre="Modifier infos" derniere onPress={() => router.push('/marketplace/a-propos')} />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
