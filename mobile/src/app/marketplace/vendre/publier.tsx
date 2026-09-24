import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import { CATEGORIES_MARKETPLACE } from '@/lib/marketplace';
import { envoyerPhotoArticle, publierArticle } from '@/lib/vendeur';

const VERT_PROFOND = '#0d3b34';
const MAX_PHOTOS = 6;

type PhotoLocale = { uri: string; width: number; height: number };

export default function PublierArticleScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [photos, setPhotos] = useState<PhotoLocale[]>([]);
  const [titre, setTitre] = useState('');
  const [categorie, setCategorie] = useState('autre');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [description, setDescription] = useState('');
  const [publication, setPublication] = useState(false);

  async function ajouterPhotos() {
    if (photos.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à vos photos pour illustrer votre article.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (resultat.canceled) return;
    const nouvelles = resultat.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setPhotos((prev) => [...prev, ...nouvelles].slice(0, MAX_PHOTOS));
  }

  function retirerPhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function publier() {
    if (!storeId || !user?.id) return;
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

    setPublication(true);
    try {
      // Envoi séquentiel : la RLS Storage limite le débit par dossier
      // utilisateur, et un échec isolé (photo corrompue) doit interrompre
      // l'envoi plutôt que publier un article à moitié illustré.
      const chemins: string[] = [];
      for (const photo of photos) {
        chemins.push(await envoyerPhotoArticle(photo.uri, { width: photo.width, height: photo.height }, user.id));
      }

      await publierArticle(storeId, {
        titre: titreNet,
        categorie,
        prixXof: prixNombre,
        quantite: Math.max(0, Math.round(Number(quantite) || 0)),
        description,
        photos: chemins,
      });

      Alert.alert('Article publié', 'Il est désormais visible sur le Marketplace.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Publication impossible pour le moment.');
    } finally {
      setPublication(false);
    }
  }

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
          <Text className="text-[17px] font-black text-[#1A1A1A]">Publier un article</Text>
        </View>

        <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View>
            <Text className="text-[12.5px] font-bold text-gray-700 mb-2">Photos ({photos.length}/{MAX_PHOTOS})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((p) => (
                // Vignette à SON format (même hauteur pour toutes) : rien n'est recadré, rien à régler.
                <View
                  key={p.uri}
                  style={{ height: 80, aspectRatio: ratioAffichage(p.width, p.height) ?? 1 }}
                  className="rounded-xl overflow-hidden relative">
                  <Image source={{ uri: p.uri }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <Pressable
                    onPress={() => retirerPhoto(p.uri)}
                    accessibilityLabel="Retirer cette photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 items-center justify-center">
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
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
              placeholder="Ex. Robe wax taille M"
              placeholderTextColor="#9CA3AF"
              maxLength={120}
              className="border border-gray-300 rounded-xl px-3.5 py-3 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES_MARKETPLACE.map((c) => {
                const actif = categorie === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategorie(c.id)}
                    className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border ${
                      actif ? 'border-transparent' : 'bg-white border-gray-200'
                    }`}
                    style={actif ? { backgroundColor: VERT_PROFOND } : undefined}>
                    <Ionicons name={c.icone as keyof typeof Ionicons.glyphMap} size={13} color={actif ? '#6ee7c9' : '#4B5563'} />
                    <Text className={`text-[12px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
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
            <Text className="text-[12.5px] font-bold text-gray-700">Description (facultatif)</Text>
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

          <Pressable
            onPress={publier}
            disabled={publication}
            className="rounded-2xl py-3.5 items-center mt-2 disabled:opacity-60"
            style={{ backgroundColor: VERT_PROFOND }}>
            {publication ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Publier l&apos;article</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
