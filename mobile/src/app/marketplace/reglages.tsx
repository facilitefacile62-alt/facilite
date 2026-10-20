import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import MarketplaceHeader from '@/components/MarketplaceHeader';
import { CarteMenu, FOND_CARTES, GroupeCartes } from '@/components/CarteMenu';
import { LigneBascule, LigneMenu } from '@/components/LigneMenu';
import { useAuth } from '@/context/AuthContext';
import { libelleLangue, lireLangue, type CodeLangue } from '@/lib/preferencesConnexion';
import { chargerMesBoutiques, definirVisibiliteBoutique, type MaBoutique } from '@/lib/vendeur';

// Réglages Marketplace — maquettes 69 (visiteur) et 79 (vendeur). Liste
// volontairement différente de celle de Facilité (mon-profil/parametres.tsx,
// orientée recherche d'emploi) : les deux plateformes ne partagent pas leurs
// réglages, comme leurs barres du bas.
//
// Vendeur : sections BOUTIQUE / COMPTE / CONFIDENTIALITÉ / SÉCURITÉ, avec les
// interrupteurs de la maquette. Seul « Rendre ma boutique visible » a une
// fonction réelle derrière (definir_visibilite_boutique) ; les autres réglages
// n'ont aucune colonne en base et sont signalés « Bientôt disponible » au lieu
// de simuler un réglage qui ne ferait rien.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

function Groupe({ titre, enfants }: { titre?: string; enfants: React.ReactNode }) {
  return (
    <View className="mb-5">
      {titre ? (
        <Text className="text-[11.5px] font-extrabold uppercase tracking-wider mb-2 px-1" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {titre}
        </Text>
      ) : null}
      <View className="bg-white rounded-[18px] overflow-hidden">{enfants}</View>
    </View>
  );
}


export default function ReglagesMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [visibiliteEnCours, setVisibiliteEnCours] = useState(false);
  const [langue, setLangue] = useState<CodeLangue>('fr');

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
      lireLangue().then(setLangue);
    }, [recharger])
  );

  async function basculerVisibilite(visible: boolean) {
    if (!boutique || visibiliteEnCours) return;
    setVisibiliteEnCours(true);
    try {
      await definirVisibiliteBoutique(boutique.id, visible);
      setBoutique({ ...boutique, actif: visible });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de modifier la visibilité.');
    } finally {
      setVisibiliteEnCours(false);
    }
  }

  function deconnexion() {
    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter pour accéder à votre compte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const estVendeur = Boolean(boutique);

  if (userId && !chargement && estVendeur) {
    const rubrique = (cle: string) => router.push(`/marketplace/rubrique/${cle}` as Href);
    return (
      <View className="flex-1" style={{ backgroundColor: FOND_CARTES }}>
        <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
          <MarketplaceHeader />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View className="flex-row items-center px-4 py-3">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/profil'))}
              accessibilityLabel="Retour"
              className="items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF' }}>
              <Ionicons name="arrow-back" size={19} color="#2563EB" />
            </Pressable>
            <Text className="flex-1 text-center text-[15px] font-black tracking-widest" style={{ marginRight: 44 }} numberOfLines={1}>{(boutique?.nom ?? 'Réglages').toUpperCase()}</Text>
          </View>

          <View className="px-4">
            <GroupeCartes>
              <CarteMenu icone="rocket-outline" titre="Faire profit & Boost" sous="Mettre vos articles en avant" onPress={() => rubrique('boost')} />
              <CarteMenu icone="people-outline" titre="Abonnés" sous="Les personnes qui suivent votre boutique" onPress={() => rubrique('abonnes')} />
              <CarteMenu icone="star-outline" titre="Avis clients" sous="Ce que disent vos clients" onPress={() => rubrique('avis')} />
            </GroupeCartes>
            <GroupeCartes>
              <CarteMenu icone="id-card-outline" titre="Coordonnées" sous="Téléphone, e-mail et adresse" onPress={() => router.push('/mon-profil/coordonnees')} />
              <CarteMenu icone="bicycle-outline" titre="Contact & Livraison" sous="Comment les clients vous joignent" onPress={() => rubrique('livraison')} />
              <CarteMenu icone="help-circle-outline" titre="Foire aux questions" sous="Les réponses à vos questions" onPress={() => router.push('/web/faq')} />
              <CarteMenu icone="language-outline" titre="Changer la langue" sous={libelleLangue(langue)} onPress={() => router.push('/mon-profil/langue' as Href)} />
            </GroupeCartes>
            <GroupeCartes>
              <CarteMenu icone="shield-checkmark-outline" titre="Confidentialité" sous="Vos données et votre visibilité" onPress={() => router.push('/mon-profil/confidentialite')} />
              <CarteMenu icone="chatbubble-outline" titre="Désactiver le chat" sous="Bientôt disponible" pastille={{ texte: 'Actif', actif: true }} onPress={() => rubrique('chat')} />
              <CarteMenu icone="chatbubbles-outline" titre="Désactiver les commentaires" sous="Bientôt disponible" pastille={{ texte: 'Actifs', actif: true }} onPress={() => rubrique('commentaires')} />
              <CarteMenu icone="notifications-outline" titre="Gérer les notifications" sous="Choisir ce que vous recevez" onPress={() => rubrique('notifications')} />
            </GroupeCartes>
            <GroupeCartes>
              <CarteMenu icone="lock-closed-outline" titre="Sécurité & Connexion" sous="Mot de passe et appareils" onPress={() => router.push('/mon-profil/securite')} />
              <CarteMenu icone="log-out-outline" titre="Se déconnecter" rouge onPress={deconnexion} />
              <CarteMenu icone="arrow-undo-outline" titre="Retour au Marketplace" sous="Revenir à Locaux" sansFleche onPress={() => router.replace('/marketplace' as Href)} />
            </GroupeCartes>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Réglages" sousTitre={estVendeur ? 'Boutique' : undefined} />

        {!userId ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour voir vos réglages.</Text>
          </View>
        ) : chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-4 pt-4 pb-10" showsVerticalScrollIndicator={false}>
            {estVendeur ? (
              <>
                <Groupe
                  titre="Boutique"
                  enfants={
                    <>
                      <LigneMenu emoji="🚀" titre="Faire profit & Boost" onPress={() => BIENTOT('Faire profit & Boost')} />
                      <LigneMenu emoji="👥" titre="Abonnés" onPress={() => BIENTOT('Abonnés')} />
                      <LigneMenu emoji="⭐" titre="Avis clients" derniere onPress={() => BIENTOT('Avis clients')} />
                    </>
                  }
                />

                <Groupe
                  titre="Compte"
                  enfants={
                    <>
                      <LigneMenu emoji="👤" titre="Informations personnelles" onPress={() => router.push('/mon-profil/infos-perso')} />
                      <LigneMenu emoji="🪪" titre="Coordonnées" onPress={() => router.push('/mon-profil/coordonnees')} />
                      <LigneMenu emoji="🚚" titre="Contact & Livraison" onPress={() => BIENTOT('Contact & Livraison')} />
                      <LigneMenu emoji="❔" titre="Foire aux questions" onPress={() => router.push('/web/faq')} />
                      <LigneMenu emoji="🌐" titre="Langue" sous={libelleLangue(langue)} derniere onPress={() => router.push('/mon-profil/langue' as Href)} />
                    </>
                  }
                />

                <Groupe
                  titre="Confidentialité"
                  enfants={
                    <>
                      <LigneBascule
                        emoji="🛡️"
                        titre="Confidentialité"
                        sous="Rendre ma boutique visible"
                        valeur={boutique?.actif === true}
                        occupe={visibiliteEnCours}
                        onChange={basculerVisibilite}
                      />
                      <LigneBascule emoji="💬" titre="Désactiver le chat" valeur={false} onChange={() => {}} bientot />
                      <LigneBascule emoji="🗨️" titre="Désactiver les commentaires" valeur={false} onChange={() => {}} bientot />
                      <LigneMenu emoji="🔔" titre="Gérer les notifications" derniere onPress={() => BIENTOT('Gérer les notifications')} />
                    </>
                  }
                />
              </>
            ) : (
              <>
                <Groupe
                  titre="Compte"
                  enfants={
                    <>
                      <LigneMenu emoji="👤" titre="Informations personnelles" onPress={() => router.push('/mon-profil/infos-perso')} />
                      <LigneMenu emoji="🪪" titre="Coordonnées" derniere onPress={() => router.push('/mon-profil/coordonnees')} />
                    </>
                  }
                />
                <Groupe
                  titre="Aide"
                  enfants={
                    <>
                      <LigneMenu emoji="❔" titre="Foire aux questions" onPress={() => router.push('/web/faq')} />
                      <LigneMenu emoji="🌐" titre="Changer la langue" sous={libelleLangue(langue)} derniere onPress={() => router.push('/mon-profil/langue' as Href)} />
                    </>
                  }
                />
              </>
            )}

            <Groupe
              titre="Sécurité"
              enfants={
                <>
                  {estVendeur ? null : (
                    <LigneMenu
                      emoji="🛡️"
                      titre="Confidentialité"
                      sous="Page légale du site"
                      externe
                      onPress={() => router.push('/web/confidentialite')}
                    />
                  )}
                  <LigneMenu emoji="🔒" titre="Sécurité & Connexion" onPress={() => router.push('/mon-profil/securite')} />
                  <LigneMenu emoji="↪️" titre="Se déconnecter" rouge derniere onPress={deconnexion} />
                </>
              }
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
