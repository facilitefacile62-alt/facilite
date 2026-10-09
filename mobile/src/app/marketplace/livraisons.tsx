import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import BoutonAction from '@/components/BoutonAction';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { refCommande, type StatutCommande } from '@/lib/commandes';
import { prixLisible } from '@/lib/marketplace';
import {
  chargerMesLivraisonsEnCours,
  chargerMonStatutLivreur,
  envoyerPositionLivraison,
  faireEtapeLivraison,
  type EtapeLivraison,
  type LivraisonEnCours,
} from '@/lib/livraison';

// « Livreur — Livraisons en cours » (maquette 80) : une carte par commande
// réclamée, avec les coordonnées de l'acheteur (révélées seulement après
// réclamation). Les livraisons disponibles ont leur propre écran
// (livraisons-disponibles.tsx, maquette 81). La position n'est envoyée que
// pendant une livraison « en cours », tant que l'écran reste ouvert au
// premier plan.
const VERT = '#10B981';

const ETAPES_SUIVANTES: Partial<Record<StatutCommande, { etape: EtapeLivraison; libelle: string }>> = {
  assignee: { etape: 'recuperee', libelle: "J'ai récupéré l'article" },
  recuperee: { etape: 'demarrer', libelle: 'Je démarre la livraison' },
  en_livraison: { etape: 'livree', libelle: 'Marquer comme livré' },
};

// Libellés et couleurs du point de vue du LIVREUR (maquette 80) : « À
// récupérer » plutôt que « Livreur assigné ».
const BADGE_LIVREUR: Partial<Record<StatutCommande, { libelle: string; fond: string; texte: string }>> = {
  assignee: { libelle: 'À récupérer', fond: '#FEF3C7', texte: '#B45309' },
  recuperee: { libelle: 'Article récupéré', fond: '#DBEAFE', texte: '#1D4ED8' },
  en_livraison: { libelle: 'En livraison', fond: '#DBEAFE', texte: '#1D4ED8' },
  livree_declaree: { libelle: 'Livrée · à confirmer', fond: '#D1FAE5', texte: '#047857' },
};

function CarteLivraison({
  livraison,
  occupee,
  onEtape,
  onLiberer,
}: {
  livraison: LivraisonEnCours;
  occupee: boolean;
  onEtape: (etape: EtapeLivraison) => void;
  onLiberer: () => void;
}) {
  const badge = BADGE_LIVREUR[livraison.statut] ?? { libelle: livraison.statut, fond: '#F3F4F6', texte: '#6B7280' };
  const suivante = ETAPES_SUIVANTES[livraison.statut];
  const lieu = [livraison.store?.nom, livraison.store?.quartier].filter(Boolean).join(', ');
  return (
    <View className="bg-white rounded-[20px] p-4 gap-2.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[12.5px] font-extrabold" style={{ color: 'rgba(0,0,0,0.5)' }}>
          {refCommande(livraison.id, 'LIV')} · {prixLisible(livraison.prix_total_xof)} FCFA
        </Text>
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: badge.fond }}>
          <Text className="text-[11.5px] font-extrabold" style={{ color: badge.texte }}>{badge.libelle}</Text>
        </View>
      </View>

      <Text className="text-[17px] font-black text-[#1A1A1A]" numberOfLines={2}>
        {livraison.item?.titre ?? 'Article'}
      </Text>
      <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Retrait : {lieu || 'Boutique'}</Text>

      <View className="rounded-[14px] p-3 gap-1" style={{ backgroundColor: '#F6F5F1' }}>
        <Text className="text-[11px] font-black tracking-wider" style={{ color: '#047857' }}>ACHETEUR</Text>
        <Text className="text-[15px] font-black text-[#1A1A1A]">{livraison.livraison_nom}</Text>
        <Pressable
          onPress={() => Linking.openURL(`tel:${livraison.livraison_telephone}`).catch(() => {})}
          className="flex-row items-center gap-2 self-start">
          <Ionicons name="call" size={14} color="#DB2777" />
          <Text className="text-[13.5px]" style={{ color: 'rgba(0,0,0,0.65)' }}>{livraison.livraison_telephone}</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Ionicons name="location" size={14} color="#DB2777" />
          <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(0,0,0,0.65)' }}>{livraison.livraison_adresse}</Text>
        </View>
      </View>

      {livraison.statut === 'livree_declaree' && (
        <Text className="text-[12px] font-bold" style={{ color: '#B45309' }}>
          En attente de la confirmation de réception par l&apos;acheteur.
        </Text>
      )}

      {suivante && (
        <Pressable
          onPress={() => onEtape(suivante.etape)}
          disabled={occupee}
          className="items-center justify-center rounded-[16px] disabled:opacity-60"
          style={{ height: 54, backgroundColor: VERT }}>
          {occupee ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[15px] font-black">{suivante.libelle}</Text>}
        </Pressable>
      )}

      {livraison.statut === 'assignee' && (
        <Pressable onPress={onLiberer} disabled={occupee} hitSlop={6} className="self-start py-1 disabled:opacity-60">
          <Text className="text-[12.5px] font-bold text-red-600">Rendre cette livraison</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function LivraisonsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  // null = vérification en cours ; false = pas livreur actif ; true = livreur actif.
  const [estLivreur, setEstLivreur] = useState<boolean | null>(null);
  const [enCours, setEnCours] = useState<LivraisonEnCours[]>([]);
  const [occupee, setOccupee] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreurPartage, setErreurPartage] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const etat = await chargerMonStatutLivreur(userId);
      const actif = etat.livreur?.statut === 'actif';
      setEstLivreur(actif);
      if (actif) setEnCours(await chargerMesLivraisonsEnCours(userId));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setRafraichissement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  // Partage de la position pendant une livraison en cours : la surveillance
  // démarre quand une commande passe en « en_livraison » et s'arrête dès que
  // l'écran se ferme ou que la livraison change d'état.
  const commandePartagee = enCours.find((c) => c.statut === 'en_livraison')?.id ?? null;
  useEffect(() => {
    if (!commandePartagee) return;
    let annule = false;
    let abonnement: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!annule) setErreurPartage('Autorisez la localisation pour partager votre position avec l’acheteur.');
        return;
      }
      abonnement = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 12000, distanceInterval: 20 },
        (p) => {
          envoyerPositionLivraison(commandePartagee, { latitude: p.coords.latitude, longitude: p.coords.longitude })
            .then(() => {
              if (!annule) setErreurPartage(null);
            })
            .catch((e: unknown) => {
              if (!annule) setErreurPartage(e instanceof Error ? e.message : 'Position non envoyée.');
            });
        }
      );
      if (annule) abonnement.remove();
    })();
    return () => {
      annule = true;
      abonnement?.remove();
    };
  }, [commandePartagee]);

  async function actionSur(id: string, action: () => Promise<void>) {
    setOccupee(id);
    try {
      await action();
      await recharger();
    } catch (e) {
      Alert.alert('Action impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setOccupee(null);
    }
  }

  function libererAvecConfirmation(livraison: LivraisonEnCours) {
    Alert.alert('Rendre cette livraison ?', 'Elle redeviendra disponible pour les autres livreurs.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: () => actionSur(livraison.id, () => faireEtapeLivraison(livraison.id, 'liberer')) },
    ]);
  }

  function contenu() {
    if (!userId) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour accéder à vos livraisons.</Text>
        </View>
      );
    }
    if (estLivreur === null) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      );
    }
    if (!estLivreur) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Text style={{ fontSize: 40 }}>🛵</Text>
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Vous n&apos;êtes pas livreur actif</Text>
          <View className="w-full mt-2">
            <BoutonAction
              titre="Devenir livreur"
              sousTitre="Livrez les commandes autour de vous"
              icone="bicycle-outline"
              onPress={() => router.replace('/marketplace/vendre/livreur')}
            />
          </View>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerClassName="px-4 pt-4 pb-10 gap-3.5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={() => {
              setRafraichissement(true);
              recharger();
            }}
            tintColor={VERT}
          />
        }>
        {commandePartagee && (
          <View className="rounded-[14px] px-3.5 py-2.5" style={{ backgroundColor: '#E0F2FE' }}>
            <Text className="text-[12px] text-[#0369A1]">
              Position partagée avec l&apos;acheteur pendant la livraison, tant que cet écran reste ouvert.
            </Text>
            {erreurPartage ? <Text className="text-[12px] font-bold text-red-600 mt-1">{erreurPartage}</Text> : null}
          </View>
        )}

        {enCours.length === 0 ? (
          <View className="items-center py-10 gap-1.5">
            <Text style={{ fontSize: 34 }}>📭</Text>
            <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucune livraison en cours</Text>
            <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Réclamez-en une parmi les livraisons disponibles.</Text>
          </View>
        ) : (
          enCours.map((l) => (
            <CarteLivraison
              key={l.id}
              livraison={l}
              occupee={occupee === l.id}
              onEtape={(etape) => actionSur(l.id, () => faireEtapeLivraison(l.id, etape))}
              onLiberer={() => libererAvecConfirmation(l)}
            />
          ))
        )}

        <BoutonAction
          titre="Livraisons disponibles"
          sousTitre="Triées par distance"
          icone="navigate-outline"
          onPress={() => router.push('/marketplace/livraisons-disponibles' as Href)}
        />
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes livraisons en cours" sousTitre={estLivreur ? 'Livreur actif' : undefined} />
        {contenu()}
      </View>
    </View>
  );
}
