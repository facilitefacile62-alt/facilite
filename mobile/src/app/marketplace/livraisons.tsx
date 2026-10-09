import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { LIBELLES_STATUT, couleurStatut, dateCourte } from '@/lib/commandes';
import { distanceLisible, prixLisible, type Position } from '@/lib/marketplace';
import {
  chargerMesLivraisonsEnCours,
  chargerMonStatutLivreur,
  envoyerPositionLivraison,
  faireEtapeLivraison,
  listerLivraisonsDisponibles,
  reclamerLivraison,
  type EtapeLivraison,
  type LivraisonDisponible,
  type LivraisonEnCours,
} from '@/lib/livraison';
import { useLocalisation } from '@/lib/useLocalisation';

// Espace livreur actif : les livraisons réclamées (avec les coordonnées de
// l'acheteur, révélées seulement après réclamation) et les livraisons
// disponibles près de la position. La position n'est envoyée que pendant une
// livraison « en cours », tant que l'écran reste ouvert au premier plan.
const VERT_PROFOND = '#0d3b34';

const ETAPES_SUIVANTES: Partial<Record<LivraisonEnCours['statut'], { etape: EtapeLivraison; libelle: string }>> = {
  assignee: { etape: 'recuperee', libelle: "J'ai récupéré l'article" },
  recuperee: { etape: 'demarrer', libelle: 'Je démarre la livraison' },
  en_livraison: { etape: 'livree', libelle: 'Marquer comme livré' },
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
  const statut = couleurStatut(livraison.statut);
  const suivante = ETAPES_SUIVANTES[livraison.statut];
  return (
    <View className="bg-white rounded-2xl border border-black/[0.06] p-3.5 gap-2.5">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[14px] font-bold text-[#1A1A1A]" numberOfLines={2}>
          {livraison.item?.titre ?? 'Article'}
        </Text>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statut.fond }}>
          <Text className="text-[11px] font-bold" style={{ color: statut.texte }}>
            {LIBELLES_STATUT[livraison.statut]}
          </Text>
        </View>
      </View>

      <View className="rounded-xl bg-[#F8F6F1] p-3 gap-0.5">
        <Text className="text-[11px] font-bold tracking-wide text-gray-500">RETRAIT</Text>
        <Text className="text-[13px] font-semibold text-[#1A1A1A]">{livraison.store?.nom ?? 'Boutique'}</Text>
        <Text className="text-[12px] text-gray-600">
          {[livraison.store?.quartier, livraison.store?.ville].filter(Boolean).join(', ') || 'Sénégal'}
        </Text>
      </View>

      <View className="rounded-xl bg-[#F8F6F1] p-3 gap-0.5">
        <Text className="text-[11px] font-bold tracking-wide text-gray-500">LIVRAISON</Text>
        <Text className="text-[13px] font-semibold text-[#1A1A1A]">{livraison.livraison_nom}</Text>
        <Text className="text-[12px] text-gray-600">{livraison.livraison_adresse}</Text>
        <Pressable
          onPress={() => Linking.openURL(`tel:${livraison.livraison_telephone}`).catch(() => {})}
          className="flex-row items-center gap-1.5 mt-1 self-start">
          <Ionicons name="call-outline" size={14} color={VERT_PROFOND} />
          <Text className="text-[12.5px] font-bold" style={{ color: VERT_PROFOND }}>
            {livraison.livraison_telephone}
          </Text>
        </Pressable>
      </View>

      <Text className="text-[12px] text-gray-500">
        {livraison.quantite} × {prixLisible(livraison.prix_unitaire_xof)} FCFA · {dateCourte(livraison.created_at)}
      </Text>

      {livraison.statut === 'livree_declaree' && (
        <Text className="text-[12px] font-semibold text-amber-700">
          En attente de la confirmation de réception par l&apos;acheteur.
        </Text>
      )}

      {suivante && (
        <Pressable
          onPress={() => onEtape(suivante.etape)}
          disabled={occupee}
          className="rounded-xl py-2.5 items-center disabled:opacity-60"
          style={{ backgroundColor: VERT_PROFOND }}>
          {occupee ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[13px] font-bold">{suivante.libelle}</Text>}
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

function CarteDisponible({
  livraison,
  occupee,
  onReclamer,
}: {
  livraison: LivraisonDisponible;
  occupee: boolean;
  onReclamer: () => void;
}) {
  const distance = distanceLisible(livraison.distance_km);
  const lieu = [livraison.boutique_quartier, livraison.boutique_ville].filter(Boolean).join(', ');
  return (
    <View className="bg-white rounded-2xl border border-black/[0.06] p-3.5 gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={2}>
            {livraison.item_titre}
          </Text>
          <Text className="text-[12px] text-gray-500" numberOfLines={1}>
            Retrait : {livraison.boutique_nom}
            {lieu ? ` · ${lieu}` : ''}
          </Text>
        </View>
        {distance ? (
          <View className="flex-row items-center gap-1 rounded-full bg-[#E0F2FE] px-2.5 py-1">
            <Ionicons name="navigate-outline" size={11} color="#0369A1" />
            <Text className="text-[11px] font-bold text-[#0369A1]">{distance}</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-extrabold" style={{ color: VERT_PROFOND }}>
          {prixLisible(livraison.prix_total_xof)} FCFA
        </Text>
        <Pressable
          onPress={onReclamer}
          disabled={occupee}
          className="rounded-xl px-4 py-2 disabled:opacity-60"
          style={{ backgroundColor: VERT_PROFOND }}>
          {occupee ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white text-[12.5px] font-bold">Réclamer</Text>}
        </Pressable>
      </View>
    </View>
  );
}

export default function LivraisonsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const { activer } = useLocalisation();
  // null = vérification en cours ; false = pas livreur actif ; true = livreur actif.
  const [estLivreur, setEstLivreur] = useState<boolean | null>(null);
  const [enCours, setEnCours] = useState<LivraisonEnCours[]>([]);
  const [disponibles, setDisponibles] = useState<LivraisonDisponible[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
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

  async function chercherDisponibles(p: Position) {
    try {
      setDisponibles(await listerLivraisonsDisponibles(p));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Recherche impossible.');
    }
  }

  async function relever() {
    const { position: releve } = await activer().catch(() => ({ position: null }));
    if (!releve) {
      Alert.alert('Localisation', "Impossible d'obtenir votre position pour le moment.");
      return;
    }
    setPosition(releve);
    await chercherDisponibles(releve);
  }

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

  async function reclamer(livraison: LivraisonDisponible) {
    await actionSur(livraison.id, async () => {
      await reclamerLivraison(livraison.id);
      if (position) setDisponibles(await listerLivraisonsDisponibles(position));
    });
  }

  function libererAvecConfirmation(livraison: LivraisonEnCours) {
    Alert.alert('Rendre cette livraison ?', "Elle redeviendra disponible pour les autres livreurs.", [
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
          <ActivityIndicator color="#10B981" />
        </View>
      );
    }
    if (!estLivreur) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Ionicons name="bicycle-outline" size={40} color="#9CA3AF" />
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Vous n&apos;êtes pas livreur actif</Text>
          <Pressable
            onPress={() => router.replace('/marketplace/vendre/livreur')}
            className="rounded-2xl px-6 py-3 mt-2"
            style={{ backgroundColor: VERT_PROFOND }}>
            <Text className="text-white text-[13.5px] font-bold">Devenir livreur</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-5 pt-2"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={() => {
              setRafraichissement(true);
              recharger();
              if (position) chercherDisponibles(position);
            }}
            tintColor="#10B981"
          />
        }>
        <View className="gap-3">
          <Text className="text-[12.5px] font-extrabold tracking-wide text-gray-500">MES LIVRAISONS EN COURS ({enCours.length})</Text>
          {commandePartagee && (
            <View className="rounded-xl bg-[#E0F2FE] px-3 py-2">
              <Text className="text-[12px] text-[#0369A1]">
                Position partagée avec l&apos;acheteur pendant la livraison, tant que cet écran reste ouvert.
              </Text>
              {erreurPartage ? <Text className="text-[12px] font-bold text-red-600 mt-1">{erreurPartage}</Text> : null}
            </View>
          )}
          {enCours.length === 0 ? (
            <Text className="text-[13px] text-gray-500">Aucune livraison réclamée pour l&apos;instant.</Text>
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
        </View>

        <View className="gap-3">
          <Text className="text-[12.5px] font-extrabold tracking-wide text-gray-500">LIVRAISONS DISPONIBLES</Text>
          {!position ? (
            <Pressable
              onPress={relever}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-gray-300 py-3">
              <Ionicons name="location-outline" size={18} color={VERT_PROFOND} />
              <Text className="text-[13px] font-bold text-[#1A1A1A]">Relever ma position actuelle</Text>
            </Pressable>
          ) : disponibles.length === 0 ? (
            <Text className="text-[13px] text-gray-500">Aucune livraison disponible dans un rayon de 15 km.</Text>
          ) : (
            disponibles.map((l) => (
              <CarteDisponible key={l.id} livraison={l} occupee={occupee === l.id} onReclamer={() => reclamer(l)} />
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes livraisons" />
        {contenu()}
      </View>
    </View>
  );
}
