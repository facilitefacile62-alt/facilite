import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { chargerCommande, confirmerReceptionCommande, refCommande, type MaCommande, type StatutCommande } from '@/lib/commandes';
import { chargerLivreurDeCommande, LIBELLES_VEHICULE, type LivreurDeCommande } from '@/lib/livraison';

// Suivi de livraison — maquettes 67 « Suivi de livraison » et 68 « Suivi —
// Livraison déclarée » : carte en haut avec la position du livreur, puis une
// carte blanche qui la recouvre (livreur, ligne d'état, quatre étapes), et le
// bouton « J'ai bien reçu mon colis » quand le livreur a déclaré la livraison.
//
// Ce que la maquette montre et que l'on ne peut PAS afficher honnêtement :
// - « arrivée estimée dans 12 min » : aucune estimation n'est calculée (la
//   position de l'acheteur n'est pas géocodée) ; la ligne d'état dit où en est
//   la commande, sans durée inventée.
// - le prénom du livreur (« Moussa ») : l'acheteur ne peut pas lire le profil
//   d'un autre compte ; on affiche « Votre livreur », son véhicule et un
//   bouton d'appel, qui eux sont réels.
const VERT = '#10B981';
const BLEU = '#2563EB';
const PICTO_VEHICULE: Record<string, string> = { pied: '🚶', velo: '🚲', moto: '🛵', voiture: '🚗' };
// Dakar par défaut tant que ni le livreur ni la boutique n'ont de position.
const DAKAR = { lat: 14.7167, lng: -17.4677 };
const RAFRAICHISSEMENT_AUTO_MS = 15000;

const ORDRE: StatutCommande[] = ['en_attente_livreur', 'assignee', 'recuperee', 'en_livraison', 'livree_declaree', 'livree'];

function etapes(statut: StatutCommande): { libelle: string; atteinte: boolean; courante: boolean }[] {
  const rang = ORDRE.indexOf(statut);
  const liste = [
    { libelle: 'Commande confirmée', atteinte: rang >= 0, seuil: 0 },
    { libelle: 'Article récupéré', atteinte: rang >= ORDRE.indexOf('recuperee'), seuil: ORDRE.indexOf('recuperee') },
    { libelle: 'En route vers vous', atteinte: rang >= ORDRE.indexOf('en_livraison'), seuil: ORDRE.indexOf('en_livraison') },
    { libelle: 'Livraison déclarée par le livreur', atteinte: rang >= ORDRE.indexOf('livree_declaree'), seuil: ORDRE.indexOf('livree_declaree') },
  ];
  // L'étape courante est la dernière atteinte.
  const derniere = liste.reduce((acc, e, i) => (e.atteinte ? i : acc), 0);
  return liste.map((e, i) => ({ libelle: e.libelle, atteinte: e.atteinte, courante: i === derniere }));
}

function phrase(statut: StatutCommande): { texte: string; couleur: string } {
  switch (statut) {
    case 'en_attente_livreur': return { texte: "En attente d'un livreur", couleur: BLEU };
    case 'assignee': return { texte: 'Un livreur va récupérer votre article', couleur: BLEU };
    case 'recuperee': return { texte: 'Votre article a été récupéré', couleur: BLEU };
    case 'en_livraison': return { texte: 'En route vers vous', couleur: BLEU };
    case 'livree_declaree': return { texte: 'Le livreur a déclaré la livraison effectuée', couleur: '#B45309' };
    case 'livree': return { texte: 'Commande reçue — merci !', couleur: '#047857' };
    case 'annulee': return { texte: 'Cette commande a été annulée', couleur: '#6B7280' };
  }
}

export default function SuiviLivraisonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [commande, setCommande] = useState<MaCommande | null | undefined>(undefined);
  const [livreur, setLivreur] = useState<LivreurDeCommande | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const recharger = useCallback(async () => {
    if (!id) return;
    try {
      const c = await chargerCommande(id);
      setCommande(c);
      if (c?.livreur_id) setLivreur(await chargerLivreurDeCommande(c.livreur_id));
    } catch {
      setCommande(null);
    } finally {
      setRafraichissement(false);
    }
  }, [id]);

  // Rechargement à l'ouverture, puis toutes les 15 s tant que la livraison
  // est en route : c'est ce qui fait bouger le point du livreur sur la carte.
  const enRoute = commande?.statut === 'en_livraison';
  useFocusEffect(
    useCallback(() => {
      recharger();
      if (!enRoute) return;
      const t = setInterval(recharger, RAFRAICHISSEMENT_AUTO_MS);
      return () => clearInterval(t);
    }, [recharger, enRoute])
  );

  async function confirmer() {
    if (!commande) return;
    setConfirmation(true);
    try {
      await confirmerReceptionCommande(commande.id);
      await recharger();
      Alert.alert('Merci !', 'La commande est marquée comme reçue.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Confirmation impossible.');
    } finally {
      setConfirmation(false);
    }
  }

  const latLivreur = commande?.livreur_position_lat ?? null;
  const lngLivreur = commande?.livreur_position_lng ?? null;
  const marqueurs = useMemo<MarqueurCarte[]>(
    () =>
      latLivreur !== null && lngLivreur !== null
        ? [{ id: 'livreur', lat: latLivreur, lng: lngLivreur, couleur: VERT, rayon: 10, halo: true, libelle: 'Livreur' }]
        : [],
    [latLivreur, lngLivreur]
  );

  const positionConnue = marqueurs.length > 0;
  const centre = positionConnue ? { lat: marqueurs[0].lat, lng: marqueurs[0].lng } : DAKAR;
  const p = commande ? phrase(commande.statut) : null;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <EnteteMarketplace titre="Suivi de livraison" sousTitre={commande ? refCommande(commande.id) : undefined} />

      {commande === undefined ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : commande === null ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[13.5px] text-gray-500 text-center">Commande introuvable.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
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
          <View style={{ height: 270 }}>
            <CarteLeaflet centre={centre} zoom={14} marqueurs={marqueurs} ajuster={positionConnue} style={{ flex: 1 }} />
            {!positionConnue ? (
              <View className="absolute left-3 top-3 rounded-[10px] px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
                <Text className="text-[12px] font-semibold" style={{ color: 'rgba(0,0,0,0.6)' }}>
                  {commande.statut === 'en_livraison' ? 'En attente de la position du livreur' : 'Position du livreur : dès le départ'}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            className="mx-3.5 bg-white p-4 gap-3"
            style={{
              marginTop: -34,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
            {commande.livreur_id ? (
              <View className="flex-row items-center gap-3">
                <View className="items-center justify-center rounded-full" style={{ width: 46, height: 46, backgroundColor: '#E4DED2' }}>
                  <Text style={{ fontSize: 20 }}>{PICTO_VEHICULE[livreur?.type_vehicule ?? 'moto']}</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[16px] font-black text-[#1A1A1A]">Votre livreur</Text>
                  <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {livreur ? LIBELLES_VEHICULE[livreur.type_vehicule] : 'Livreur'} · {refCommande(commande.id)}
                  </Text>
                </View>
                {livreur?.telephone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${livreur.telephone}`).catch(() => {})}
                    accessibilityLabel="Appeler le livreur"
                    className="items-center justify-center rounded-full"
                    style={{ width: 46, height: 46, backgroundColor: '#D1FAE5' }}>
                    <Ionicons name="call" size={19} color="#DB2777" />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View>
                <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={2}>{commande.item?.titre ?? 'Article'}</Text>
                <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  Retrait : {commande.store?.nom ?? 'Boutique'}
                  {commande.store?.ville ? ` · ${commande.store.ville}` : ''}
                </Text>
              </View>
            )}

            {p ? <Text className="text-[16px] font-black" style={{ color: p.couleur }}>{p.texte}</Text> : null}

            {commande.statut !== 'annulee' ? (
              <View className="gap-2.5">
                {etapes(commande.statut).map((e) => (
                  <View key={e.libelle} className="flex-row items-center gap-3">
                    <View className="rounded-full" style={{ width: 10, height: 10, backgroundColor: e.atteinte ? VERT : '#D1D5DB' }} />
                    <Text
                      className={`text-[14px] ${e.courante && e.atteinte ? 'font-black text-[#1A1A1A]' : e.atteinte ? 'font-semibold text-[#1A1A1A]' : 'text-gray-400 font-semibold'}`}>
                      {e.libelle}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {commande.statut === 'livree_declaree' ? (
              <Pressable
                onPress={confirmer}
                disabled={confirmation}
                className="items-center justify-center rounded-[16px] flex-row gap-2 mt-1 disabled:opacity-60"
                style={{ height: 54, backgroundColor: VERT }}>
                {confirmation ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text className="text-white text-[16px] font-black">J&apos;ai bien reçu mon colis</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => router.replace('/marketplace/commandes')} className="self-center mt-4" hitSlop={8}>
            <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>Voir toutes mes commandes</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
