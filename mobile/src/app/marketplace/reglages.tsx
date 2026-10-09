import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { LigneBascule, LigneMenu } from '@/components/LigneMenu';
import { useAuth } from '@/context/AuthContext';
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
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const [chargement, setChargement] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [visibiliteEnCours, setVisibiliteEnCours] = useState(false);

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
                      <LigneMenu emoji="🌐" titre="Langue" sous="Français" derniere onPress={() => BIENTOT('Changer la langue')} />
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
                      <LigneMenu emoji="🌐" titre="Changer la langue" sous="Français" derniere onPress={() => BIENTOT('Changer la langue')} />
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
