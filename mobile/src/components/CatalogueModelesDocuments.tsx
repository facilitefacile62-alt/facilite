import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Text, View, Pressable } from 'react-native';

import { chargerModelesCv, urlApercuPage, useEnteteImages } from '@/lib/achatCv';
import type { ModeleCv } from '@/lib/achatCvLogique';
import { WHATSAPP_FACILITE } from '@/lib/configFacilite';

// Onglet « Modèles de documents » du Profil de Facilité, affiché À LA PLACE de « Achat de CV » tant que les paiements de l'application sont fermés
// (feat_paiements_application) : même liste de modèles, mais ni prix, ni achat, ni paiement. Un modèle choisi ouvre WhatsApp vers Facilité avec son
// nom, pour que l'équipe prépare le document à la main.
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const VERT = '#10B981';

export const messageDemandeModele = (nom: string): string =>
  `Bonjour Facilité, je souhaite le modèle de document « ${nom} » que j'ai vu dans l'application.`;

export default function CatalogueModelesDocuments() {
  const entete = useEnteteImages();
  const [modeles, setModeles] = useState<ModeleCv[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let annule = false;
      chargerModelesCv()
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

  const demander = (m: ModeleCv) =>
    Linking.openURL(`https://wa.me/${WHATSAPP_FACILITE}?text=${encodeURIComponent(messageDemandeModele(m.nom))}`).catch(() =>
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
          {(modeles ?? []).map((m) => {
            const miniature = entete && m.nbPages > 0 ? urlApercuPage(m.id, 1) : null;
            return (
              <View key={m.id} className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
                <View className="w-full aspect-[3/4] items-center justify-center" style={{ backgroundColor: '#E8E4DA' }}>
                  {miniature ? (
                    <Image source={{ uri: miniature, headers: entete ?? undefined }} alt={`Aperçu du modèle ${m.nom}`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <Ionicons name="document-text-outline" size={40} color="rgba(0,0,0,0.25)" />
                  )}
                </View>
                <View className="p-2.5">
                  <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>{m.nom}</Text>
                  {m.description ? <Text className="text-[12px] text-black/50 mt-0.5" numberOfLines={1}>{m.description}</Text> : null}
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
    </View>
  );
}
