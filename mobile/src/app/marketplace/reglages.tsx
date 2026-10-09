import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';

// Réglages Marketplace (maquettes « Réglages (visiteur) » et « Réglages
// (vendeur) »). Liste volontairement différente de celle de Facilité
// (mon-profil/parametres.tsx, orientée recherche d'emploi) : les deux
// plateformes ne partagent pas leurs réglages, comme leurs barres du bas.
// Pour le vendeur, les rubriques sans fonctionnalité réelle derrière
// (Boost, Abonnés, Avis, chat, notifications) sont marquées « Bientôt
// disponible » plutôt que de simuler un réglage qui ne ferait rien.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');
const VERT_PROFOND = '#0d3b34';

function Ligne({
  icone,
  titre,
  sous,
  externe,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  sous?: string;
  externe?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3.5 border-b border-black/[0.05] active:bg-gray-50">
      <View className="w-9 h-9 rounded-xl bg-[#F2F0EA] items-center justify-center">
        <Ionicons name={icone} size={17} color="#1A1A1A" />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-[#1A1A1A]">{titre}</Text>
        {sous ? <Text className="text-[11.5px] text-gray-500 mt-0.5">{sous}</Text> : null}
      </View>
      <Ionicons name={externe ? 'open-outline' : 'chevron-forward'} size={15} color="rgba(0,0,0,0.3)" />
    </Pressable>
  );
}

function Groupe({ titre, enfants }: { titre?: string; enfants: React.ReactNode }) {
  return (
    <View className="mb-5">
      {titre ? <Text className="text-[11px] font-extrabold text-black/40 uppercase tracking-wider mb-2 px-1">{titre}</Text> : null}
      <View className="bg-white rounded-2xl overflow-hidden">{enfants}</View>
    </View>
  );
}

export default function ReglagesMarketplaceScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
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

  function deconnexion() {
    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter pour accéder à votre compte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const estVendeur = Boolean(boutique);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Réglages" />

        {!userId ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour voir vos réglages.</Text>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-4 pt-3 pb-10" showsVerticalScrollIndicator={false}>
            {estVendeur && (
              <Groupe
                titre="Boutique"
                enfants={
                  <>
                    <Ligne icone="trending-up-outline" titre="Faire profit & Boost" onPress={() => BIENTOT('Faire profit & Boost')} />
                    <Ligne icone="people-outline" titre="Abonnés" onPress={() => BIENTOT('Abonnés')} />
                    <Ligne icone="star-outline" titre="Avis clients" onPress={() => BIENTOT('Avis clients')} />
                  </>
                }
              />
            )}

            <Groupe
              titre="Mon compte"
              enfants={
                <>
                  <Ligne icone="person-outline" titre="Informations personnelles" onPress={() => router.push('/mon-profil/infos-perso')} />
                  <Ligne
                    icone="call-outline"
                    titre="Coordonnées"
                    sous="Téléphone, WhatsApp, e-mail"
                    onPress={() => router.push('/mon-profil/infos-perso')}
                  />
                  {estVendeur && (
                    <Ligne icone="bicycle-outline" titre="Contact & Livraison" onPress={() => BIENTOT('Contact & Livraison')} />
                  )}
                </>
              }
            />

            <Groupe
              titre="Informations"
              enfants={
                <>
                  <Ligne icone="help-circle-outline" titre="Foire aux questions" onPress={() => router.push('/web/faq')} />
                  <Ligne icone="language-outline" titre="Changer la langue" onPress={() => BIENTOT('Changer la langue')} />
                  {estVendeur ? (
                    <Ligne
                      icone="eye-outline"
                      titre="Confidentialité"
                      sous="Visibilité de la boutique, dans Ma boutique"
                      onPress={() => router.push('/marketplace/vendre')}
                    />
                  ) : (
                    <Ligne icone="lock-closed-outline" titre="Confidentialité" externe onPress={() => router.push('/web/confidentialite')} />
                  )}
                </>
              }
            />

            {estVendeur && (
              <Groupe
                titre="Modération"
                enfants={
                  <>
                    <Ligne icone="chatbubble-ellipses-outline" titre="Désactiver le chat" onPress={() => BIENTOT('Désactiver le chat')} />
                    <Ligne icone="chatbox-outline" titre="Désactiver les commentaires" onPress={() => BIENTOT('Désactiver les commentaires')} />
                    <Ligne icone="notifications-outline" titre="Gérer les notifications" onPress={() => BIENTOT('Gérer les notifications')} />
                  </>
                }
              />
            )}

            <Groupe
              enfants={
                <>
                  <Ligne icone="shield-checkmark-outline" titre="Sécurité & Connexion" onPress={() => router.push('/web/securite')} />
                  <Pressable onPress={deconnexion} className="flex-row items-center gap-3 px-4 py-3.5">
                    <View className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                      <Ionicons name="log-out-outline" size={17} color="#DC2626" />
                    </View>
                    <Text className="flex-1 text-[13.5px] font-bold text-red-600">Se déconnecter</Text>
                  </Pressable>
                </>
              }
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
