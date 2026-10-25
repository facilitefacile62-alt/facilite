import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import { chargerModelesCv, lienTelechargementCv, urlApercuPage, useEnteteImages } from '@/lib/achatCv';
import { prixFcfa, type ModeleCv } from '@/lib/achatCvLogique';

// Catalogue « Modèles de CV » (onglet « Achat de CV » du Profil, maquette du 24/10/2026) : grille de 2 colonnes, grandes miniatures (page 1, filigranée,
// basse définition), nom, une ligne, prix, UN SEUL bouton vert « Acheter » et un lien « Voir l'aperçu ». Un modèle acheté montre « Acheté » et
// « Utiliser ce modèle ». Les prix viennent de la base (saisis par l'administrateur), jamais de l'application.
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const VERT = '#10B981';
const BLEU = '#2563EB';

export default function CatalogueCv() {
  const router = useRouter();
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

  const acheter = (m: ModeleCv) => router.push(`/mon-profil/achat-cv-payer?id=${m.id}` as Href);
  const apercu = (m: ModeleCv) => router.push(`/mon-profil/achat-cv-apercu?id=${m.id}` as Href);
  const utiliser = async (m: ModeleCv) => {
    const lien = await lienTelechargementCv(m.id);
    if (!lien) {
      Alert.alert('Modèle indisponible', "Ce modèle n'a pas pu être ouvert. Réessayez dans un instant.");
      return;
    }
    Linking.openURL(lien).catch(() => Alert.alert('Téléchargement impossible', "Aucune application n'a pu ouvrir ce fichier."));
  };

  return (
    <View className="px-4 mt-3">
      <Text className="text-[16px] font-black text-[#1A1A1A]">Modèles de CV</Text>

      {modeles === null && !erreur ? (
        // Chargement : 4 cartes squelettes grises
        <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
              <View className="w-full aspect-[3/4]" style={{ backgroundColor: '#E8E4DA' }} />
              <View className="p-2.5">
                <View style={{ height: 12, width: '70%', borderRadius: 6, backgroundColor: '#E8E4DA' }} />
                <View style={{ height: 10, width: '50%', borderRadius: 5, backgroundColor: '#EFEBE2', marginTop: 8 }} />
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
          <Ionicons name="bag-handle-outline" size={32} color="rgba(0,0,0,0.25)" />
          <Text className="text-[14px] text-black/50 text-center mt-2">Aucun modèle disponible pour le moment.</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 12 }}>
          {(modeles ?? []).map((m) => {
            const miniature = entete && m.nbPages > 0 ? urlApercuPage(m.id, 1) : null;
            return (
              <View key={m.id} className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
                <Pressable onPress={() => apercu(m)} accessibilityLabel={`Voir l'aperçu du modèle ${m.nom}`} className="w-full aspect-[3/4] items-center justify-center" style={{ backgroundColor: '#E8E4DA' }}>
                  {miniature ? (
                    <Image source={{ uri: miniature, headers: entete ?? undefined }} alt={`Aperçu du modèle ${m.nom}`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="none" blurRadius={1} />
                  ) : (
                    <Ionicons name="document-text-outline" size={40} color="rgba(0,0,0,0.25)" />
                  )}
                  {m.achete ? (
                    <View className="absolute top-2 left-2 rounded-full px-2.5 py-1" style={{ backgroundColor: VERT }}>
                      <Text className="text-white text-[11px] font-black">Acheté</Text>
                    </View>
                  ) : null}
                </Pressable>
                <View className="p-2.5">
                  <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>{m.nom}</Text>
                  {m.description ? (
                    <Text className="text-[12px] text-black/50 mt-0.5" numberOfLines={1}>{m.description}</Text>
                  ) : null}
                  {m.achete ? (
                    <>
                      <Text className="text-[13px] font-bold mt-1.5" style={{ color: '#047857' }}>Acheté</Text>
                      <Pressable
                        onPress={() => utiliser(m)}
                        accessibilityRole="button"
                        className="items-center justify-center mt-2"
                        style={{ minHeight: 48, borderRadius: 12, backgroundColor: '#D1FAE5' }}>
                        <Text className="text-[13.5px] font-extrabold" style={{ color: '#047857' }}>Utiliser ce modèle</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text className="text-[15px] font-black text-[#1A1A1A] mt-1.5">{prixFcfa(m.prixXof)}</Text>
                      <Pressable
                        onPress={() => acheter(m)}
                        accessibilityRole="button"
                        className="items-center justify-center mt-2"
                        style={{ minHeight: 48, borderRadius: 12, backgroundColor: VERT }}>
                        <Text className="text-[15px] font-extrabold text-white">Acheter</Text>
                      </Pressable>
                      <Pressable onPress={() => apercu(m)} accessibilityRole="link" className="items-center justify-center" style={{ minHeight: 44 }}>
                        <Text className="text-[13px] font-bold" style={{ color: BLEU }}>Voir l&apos;aperçu</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
