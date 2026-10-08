import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import { CATEGORIES_MARKETPLACE, libelleCategorie, prixLisible, urlPhoto } from '@/lib/marketplace';
import { envoyerPhotoArticle, modifierArticle, retirerArticle } from '@/lib/vendeur';

// Modifier l'article (maquette « Vendeur — Publier un article », mode
// édition) : mêmes champs que la publication, pré-remplis, avec un aperçu
// en direct et Supprimer / Enregistrer au lieu de Publier.
const VERT_PROFOND = '#0d3b34';
const MAX_PHOTOS = 6;

type PhotoExistante = { chemin: string };
type PhotoLocale = { uri: string; width: number; height: number };

export default function ModifierArticleScreen() {
  const params = useLocalSearchParams<{
    id: string;
    titre: string;
    categorie: string;
    prix: string;
    quantite: string;
    description: string;
    photos: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const photosInitiales: string[] = (() => {
    try {
      const liste = JSON.parse(params.photos || '[]');
      return Array.isArray(liste) ? liste : [];
    } catch {
      return [];
    }
  })();

  const [photosExistantes, setPhotosExistantes] = useState<PhotoExistante[]>(photosInitiales.map((chemin) => ({ chemin })));
  const [nouvellesPhotos, setNouvellesPhotos] = useState<PhotoLocale[]>([]);
  const [titre, setTitre] = useState(params.titre || '');
  const [categorie, setCategorie] = useState(params.categorie || 'autre');
  const [prix, setPrix] = useState(params.prix || '');
  const [quantite, setQuantite] = useState(params.quantite || '1');
  const [description, setDescription] = useState(params.description || '');
  const [enregistrement, setEnregistrement] = useState(false);

  const totalPhotos = photosExistantes.length + nouvellesPhotos.length;

  async function ajouterPhotos() {
    if (totalPhotos >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à vos photos pour illustrer votre article.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - totalPhotos,
    });
    if (resultat.canceled) return;
    const nouvelles = resultat.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setNouvellesPhotos((prev) => [...prev, ...nouvelles].slice(0, MAX_PHOTOS));
  }

  function retirerPhotoExistante(chemin: string) {
    setPhotosExistantes((prev) => prev.filter((p) => p.chemin !== chemin));
  }

  function retirerNouvellePhoto(uri: string) {
    setNouvellesPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function enregistrer() {
    if (!params.id) return;
    const titreNet = titre.trim();
    if (!titreNet) {
      Alert.alert('Titre manquant', 'Donnez un titre à votre article.');
      return;
    }
    const prixNombre = Number(prix.replace(/[^\d]/g, ''));
    if (!Number.isFinite(prixNombre) || prixNombre <= 0) {
      Alert.alert('Prix invalide', 'Indiquez un prix en FCFA supérieur à 0.');
      return;
    }

    setEnregistrement(true);
    try {
      const chemins = photosExistantes.map((p) => p.chemin);
      for (const photo of nouvellesPhotos) {
        if (!user?.id) break;
        chemins.push(await envoyerPhotoArticle(photo.uri, { width: photo.width, height: photo.height }, user.id));
      }

      await modifierArticle(params.id, {
        titre: titreNet,
        categorie,
        prixXof: prixNombre,
        quantite: Math.max(0, Math.round(Number(quantite) || 0)),
        description,
        photos: chemins,
      });
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Modification impossible pour le moment.');
    } finally {
      setEnregistrement(false);
    }
  }

  function demanderSuppression() {
    Alert.alert('Supprimer cet article ?', `« ${titre} » ne sera plus visible sur le Marketplace.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setEnregistrement(true);
          try {
            await retirerArticle(params.id);
            router.back();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
          } finally {
            setEnregistrement(false);
          }
        },
      },
    ]);
  }

  const premierePhoto = photosExistantes[0] ? urlPhoto(photosExistantes[0].chemin) : nouvellesPhotos[0]?.uri;
  const prixApercu = Number(prix.replace(/[^\d]/g, '')) || 0;

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[17px] font-black text-[#1A1A1A]">Modifier l&apos;article</Text>
        </View>

        <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Aperçu en direct, mis à jour avec la saisie */}
          <View className="flex-row items-center gap-3 bg-[#F8F6F1] rounded-2xl p-2.5">
            <View className="w-14 h-14 rounded-xl bg-[#F2F0EA] overflow-hidden items-center justify-center relative">
              {premierePhoto ? (
                <Image source={{ uri: premierePhoto }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#9CA3AF" />
              )}
              <View className="absolute top-0.5 left-0.5 bg-red-600 rounded px-1">
                <Text className="text-white text-[8px] font-black">LIVE</Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-[10.5px] text-gray-500">Aperçu · {libelleCategorie(categorie)}</Text>
              <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>
                {prixApercu > 0 ? `${prixLisible(prixApercu)} FCFA` : 'Prix'}
              </Text>
              <Text className="text-[12px] text-gray-600" numberOfLines={1}>
                {titre || 'Titre de votre article'}
              </Text>
            </View>
          </View>

          <View>
            <Text className="text-[12.5px] font-bold text-gray-700 mb-2">
              Photos ({totalPhotos}/{MAX_PHOTOS})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photosExistantes.map((p) => (
                <View key={p.chemin} style={{ height: 80, width: 80 }} className="rounded-xl overflow-hidden relative">
                  <Image source={{ uri: urlPhoto(p.chemin) ?? undefined }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable
                    onPress={() => retirerPhotoExistante(p.chemin)}
                    accessibilityLabel="Retirer cette photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 items-center justify-center">
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {nouvellesPhotos.map((p) => (
                <View
                  key={p.uri}
                  style={{ height: 80, aspectRatio: ratioAffichage(p.width, p.height) ?? 1 }}
                  className="rounded-xl overflow-hidden relative">
                  <Image source={{ uri: p.uri }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable
                    onPress={() => retirerNouvellePhoto(p.uri)}
                    accessibilityLabel="Retirer cette photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 items-center justify-center">
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {totalPhotos < MAX_PHOTOS && (
                <Pressable
                  onPress={ajouterPhotos}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 items-center justify-center">
                  <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                </Pressable>
              )}
            </ScrollView>
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Titre</Text>
            <TextInput
              value={titre}
              onChangeText={setTitre}
              placeholder="Ex. Tunique homme en lin"
              placeholderTextColor="#9CA3AF"
              maxLength={120}
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-[12.5px] font-bold text-gray-700">Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES_MARKETPLACE.map((c) => {
                  const actif = categorie === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategorie(c.id)}
                      className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 border ${
                        actif ? 'border-transparent' : 'bg-white border-gray-200'
                      }`}
                      style={actif ? { backgroundColor: VERT_PROFOND } : undefined}>
                      <Text className={`text-[11.5px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-[12.5px] font-bold text-gray-700">Prix (FCFA)</Text>
              <TextInput
                value={prix}
                onChangeText={(v) => setPrix(v.replace(/[^\d]/g, ''))}
                placeholder="5000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-[12.5px] font-bold text-gray-700">Quantité</Text>
              <TextInput
                value={quantite}
                onChangeText={(v) => setQuantite(v.replace(/[^\d]/g, ''))}
                placeholder="1"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
              />
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="État, détails, dimensions…"
              placeholderTextColor="#9CA3AF"
              multiline
              style={{ minHeight: 90, textAlignVertical: 'top' }}
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="flex-row gap-3 mt-2">
            <Pressable
              onPress={demanderSuppression}
              disabled={enregistrement}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 border border-red-300 disabled:opacity-60">
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
              <Text className="text-red-600 text-[13.5px] font-bold">Supprimer</Text>
            </Pressable>
            <Pressable
              onPress={enregistrer}
              disabled={enregistrement}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3.5 disabled:opacity-60"
              style={{ backgroundColor: VERT_PROFOND }}>
              {enregistrement ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text className="text-white text-[13.5px] font-bold">Enregistrer</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
