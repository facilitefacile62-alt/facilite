import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, FlatList, Linking, Modal, Text, View, Pressable } from 'react-native';

import { WHATSAPP_FACILITE } from '@/lib/configFacilite';
import { chargerModelesDocuments } from '@/lib/modelesDocuments';
import { messageDemandeModele, type ModeleDocument } from '@/lib/modelesDocumentsLogique';

// Onglet « Modèles de documents » du Profil de Facilité, affiché À LA PLACE de « Achat de CV » tant que les paiements de l'application sont fermés
// (feat_paiements_application) : les modèles de CV et de lettres publiés par l'administrateur (table modeles_documents), côte à côte comme le fil de
// Locaux ; ni prix, ni achat, ni paiement. Un modèle choisi ouvre WhatsApp vers Facilité avec son nom, pour que l'équipe prépare le document à la main.
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const VERT = '#10B981';

export default function CatalogueModelesDocuments() {
  const [modeles, setModeles] = useState<ModeleDocument[] | null>(null);
  const [erreur, setErreur] = useState(false);
  // Vue d'ensemble : toucher un modèle ouvre son affiche en grand (entière), avec le bouton « Demander ce modèle ». On passe d'un modèle à l'autre
  // en faisant glisser l'affiche de gauche à droite (ou de droite à gauche).
  const [indexOuvert, setIndexOuvert] = useState<number | null>(null);
  const largeur = Dimensions.get('window').width;
  const ouvert = indexOuvert !== null ? (modeles ?? [])[indexOuvert] ?? null : null;

  useFocusEffect(
    useCallback(() => {
      let annule = false;
      chargerModelesDocuments()
        .then((m) => {
          if (annule) return;
          setModeles(m);
          setErreur(false);
        })
        .catch(() => {
          if (!annule) setErreur(true);
        });
      return () => {
        annule = true;
      };
    }, [])
  );

  const demander = (m: ModeleDocument) =>
    Linking.openURL(`https://wa.me/${WHATSAPP_FACILITE}?text=${encodeURIComponent(messageDemandeModele(m.nom, m.imageUrl))}`).catch(() =>
      Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp.")
    );

  return (
    <View className="px-4 mt-3">
      <Text className="text-[16px] font-black text-[#1A1A1A]">Modèles de documents</Text>
      <Text className="text-[12.5px] text-black/50 mt-0.5">Choisissez un modèle : nous vous répondons sur WhatsApp.</Text>

      {modeles === null && !erreur ? (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
              <View className="w-full aspect-[3/4]" style={{ backgroundColor: '#E8E4DA' }} />
              <View className="p-2.5">
                <View style={{ height: 12, width: '70%', borderRadius: 6, backgroundColor: '#E8E4DA' }} />
                <View style={{ height: 44, borderRadius: 12, backgroundColor: '#EFEBE2', marginTop: 10 }} />
              </View>
            </View>
          ))}
        </View>
      ) : erreur && modeles === null ? (
        <View className="py-12 px-6 items-center">
          <Ionicons name="cloud-offline-outline" size={32} color="rgba(0,0,0,0.25)" />
          <Text className="text-[14px] text-black/50 text-center mt-2">Impossible de charger les modèles pour le moment.</Text>
        </View>
      ) : modeles && modeles.length === 0 ? (
        <View className="py-12 px-6 items-center">
          <Ionicons name="document-text-outline" size={32} color="rgba(0,0,0,0.25)" />
          <Text className="text-[14px] text-black/50 text-center mt-2">Aucun modèle disponible pour le moment.</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
          {(modeles ?? []).map((m, i) => {
            return (
              <View key={m.id} className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
                <Pressable
                  onPress={() => setIndexOuvert(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir le modèle ${m.nom} en grand`}
                  className="w-full aspect-[3/4] items-center justify-center"
                  style={{ backgroundColor: '#E8E4DA' }}>
                  <Image source={{ uri: m.imageUrl }} alt={`Aperçu du modèle ${m.nom}`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
                </Pressable>
                <View className="p-2.5">
                  <Pressable onPress={() => setIndexOuvert(i)} accessibilityRole="button" accessibilityLabel={`Voir le modèle ${m.nom} en grand`}>
                    <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>{m.nom}</Text>
                    {m.description ? <Text className="text-[12px] text-black/50 mt-0.5" numberOfLines={1}>{m.description}</Text> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => demander(m)}
                    accessibilityRole="button"
                    className="items-center justify-center mt-2"
                    style={{ minHeight: 48, borderRadius: 12, backgroundColor: VERT }}>
                    <Text className="text-[14px] font-extrabold text-white">Demander ce modèle</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={ouvert !== null} transparent animationType="fade" onRequestClose={() => setIndexOuvert(null)}>
        <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}>
          {ouvert ? (
            <>
              <View className="flex-row items-center px-4" style={{ paddingTop: 48, paddingBottom: 8 }}>
                <Text className="flex-1 text-[16px] font-black text-white" numberOfLines={1}>{ouvert.nom}</Text>
                {(modeles ?? []).length > 1 ? (
                  <Text className="text-[13px] font-bold text-white/70 mr-3">{(indexOuvert ?? 0) + 1} / {(modeles ?? []).length}</Text>
                ) : null}
                <Pressable
                  onPress={() => setIndexOuvert(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  hitSlop={10}
                  className="items-center justify-center"
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
              <View className="flex-1">
                <FlatList
                  data={modeles ?? []}
                  keyExtractor={(m) => m.id}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={indexOuvert ?? 0}
                  getItemLayout={(_d, i) => ({ length: largeur, offset: largeur * i, index: i })}
                  onMomentumScrollEnd={(e) => setIndexOuvert(Math.max(0, Math.min((modeles ?? []).length - 1, Math.round(e.nativeEvent.contentOffset.x / largeur))))}
                  renderItem={({ item }) => (
                    <View style={{ width: largeur, height: '100%', paddingHorizontal: 12 }}>
                      <Image source={{ uri: item.imageUrl }} alt={`Modèle ${item.nom}`} style={{ width: '100%', height: '100%' }} contentFit="contain" cachePolicy="memory-disk" />
                    </View>
                  )}
                />
                {(modeles ?? []).length > 1 ? (
                  <View className="flex-row justify-center" style={{ gap: 6, paddingTop: 8 }}>
                    {(modeles ?? []).map((m, i) => (
                      <View key={m.id} style={{ width: i === indexOuvert ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === indexOuvert ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }} />
                    ))}
                  </View>
                ) : null}
              </View>
              <View className="px-4" style={{ paddingTop: 10, paddingBottom: 28 }}>
                {ouvert.description ? <Text className="text-[12.5px] text-white/80 mb-2.5" numberOfLines={3}>{ouvert.description}</Text> : null}
                <Pressable
                  onPress={() => demander(ouvert)}
                  accessibilityRole="button"
                  className="items-center justify-center"
                  style={{ minHeight: 50, borderRadius: 14, backgroundColor: VERT }}>
                  <Text className="text-[15px] font-extrabold text-white">Demander ce modèle</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
