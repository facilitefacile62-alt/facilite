import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import { CATEGORIES_MARKETPLACE } from '@/lib/marketplace';
import { envoyerPhotoArticle, envoyerVideoArticle, publierArticle } from '@/lib/vendeur';

// Pas encore disponible : aucune API de reconnaissance d'article (scan IA)
// n'existe côté serveur pour le Marketplace — contrairement au scan de CV
// (src/lib/scanDocument.ts), qui est un service différent.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

const VERT_PROFOND = '#0d3b34';
const MAX_PHOTOS = 6;

type PhotoLocale = { uri: string; width: number; height: number };
type Etape = 'methode' | 'categorie' | 'details';

export default function PublierArticleScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  // Étape 1 : comment vendre, puis la catégorie. Étape 2 : les détails
  // (maquettes « Publier — Étape 1 Catégorie » et « Étape 2 Détails »).
  const [etape, setEtape] = useState<Etape>('methode');
  const [categorie, setCategorie] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PhotoLocale[]>([]);
  // Vidéo facultative de l'article (maquette 22). Une seule par article :
  // la colonne url_video n'en porte qu'une.
  const [video, setVideo] = useState<{ uri: string; extension: string } | null>(null);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [description, setDescription] = useState('');
  const [publication, setPublication] = useState(false);

  function retour() {
    if (etape === 'details') setEtape('categorie');
    else if (etape === 'categorie') setEtape('methode');
    else router.back();
  }

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

  async function choisirVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à votre galerie pour ajouter une vidéo.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (resultat.canceled || !resultat.assets?.length) return;
    const asset = resultat.assets[0];
    const extension = (asset.fileName?.split('.').pop() || asset.uri.split('.').pop() || 'mp4').toLowerCase();
    setVideo({ uri: asset.uri, extension });
  }

  async function publier() {
    if (!storeId || !user?.id || !categorie) return;
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

      const cheminVideo = video ? await envoyerVideoArticle(video.uri, user.id, video.extension) : null;

      await publierArticle(storeId, {
        titre: titreNet,
        categorie,
        prixXof: prixNombre,
        quantite: Math.max(0, Math.round(Number(quantite) || 0)),
        description,
        photos: chemins,
        urlVideo: cheminVideo,
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

  if (etape === 'methode') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteMarketplace titre="Catégorie" sousTitre="Étape 1 sur 2" onRetour={retour} />
        <View className="px-4 pt-5 gap-3.5">
          <Text className="text-[20px] font-black text-[#1A1A1A] text-center mb-1">Comment voulez-vous vendre ?</Text>

          {/* Scanner avec l'IA : pas encore branché (aucun service d'analyse d'article côté serveur). */}
          <Pressable
            onPress={() => BIENTOT('Scanner avec l’IA')}
            className="flex-row items-center gap-3 rounded-[16px] p-3.5"
            style={{ backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399' }}>
            <View className="w-11 h-11 rounded-[12px] items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
              <Ionicons name="camera-outline" size={21} color="#0B3D2A" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[15px] font-black text-[#0B3D2A]">Scanner avec l&apos;IA</Text>
                <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEF3C7' }}>
                  <Ionicons name="trophy-outline" size={10} color="#B45309" />
                  <Text className="text-[10px] font-black text-[#B45309]">PRO</Text>
                </View>
              </View>
              <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>Une photo suffit, vous mettez le prix</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.3)" />
          </Pressable>

          <Pressable
            onPress={() => setEtape('categorie')}
            className="flex-row items-center gap-3.5 rounded-[18px] bg-white p-4"
            style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
            <View className="w-14 h-14 rounded-[14px] items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
              <Text style={{ fontSize: 26 }}>✍️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[16px] font-black text-[#1A1A1A]">Vendre manuellement</Text>
              <Text className="text-[12.5px] mt-0.5 leading-[18px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Choisissez la catégorie et remplissez la fiche vous-même.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.3)" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (etape === 'categorie') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <View className="flex-1">
          <EnteteMarketplace titre="Catégorie" sousTitre="Étape 1 sur 2" onRetour={retour} />
          <View className="px-4">
            <Pressable onPress={retour} className="flex-row items-center gap-1 self-start mb-3" hitSlop={8}>
              <Ionicons name="chevron-back" size={15} color="#6B7280" />
              <Text className="text-[12.5px] font-semibold text-gray-500">Changer</Text>
            </Pressable>

            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES_MARKETPLACE.map((c) => {
                const actif = categorie === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategorie(c.id)}
                    className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2.5 border ${
                      actif ? 'border-transparent' : 'bg-white border-gray-200'
                    }`}
                    style={actif ? { backgroundColor: VERT_PROFOND } : undefined}>
                    <Ionicons name={c.icone as keyof typeof Ionicons.glyphMap} size={14} color={actif ? '#6ee7c9' : '#4B5563'} />
                    <Text className={`text-[13px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Juste sous « ‹ Changer » et la grille, pas collé en bas de l'écran. */}
            <Pressable
              onPress={() => categorie && setEtape('details')}
              disabled={!categorie}
              className="rounded-2xl py-3.5 items-center mt-6 disabled:opacity-40"
              style={{ backgroundColor: VERT_PROFOND }}>
              <Text className="text-white text-[14.5px] font-bold">Continuer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Détails" sousTitre="Étape 2 sur 2" onRetour={retour} />

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

          {/* Vidéo facultative — maquette 22. Une seule par article. */}
          <View>
            <Text className="text-[12.5px] font-bold text-gray-700 mb-2">Vidéo (facultative)</Text>
            {video ? (
              <View className="flex-row items-center gap-2.5 bg-[#F2F0EA] rounded-xl px-3.5 py-3">
                <Ionicons name="videocam" size={18} color="#047857" />
                <Text className="flex-1 text-[12.5px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
                  Vidéo prête à être envoyée
                </Text>
                <Pressable onPress={() => setVideo(null)} accessibilityLabel="Retirer la vidéo" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.35)" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={choisirVideo}
                className="flex-row items-center gap-2.5 rounded-xl border-2 border-dashed border-gray-300 px-3.5 py-3">
                <Ionicons name="videocam-outline" size={18} color="#9CA3AF" />
                <Text className="text-[12.5px] font-semibold text-gray-500">Ajouter une vidéo (30 Mo max.)</Text>
              </Pressable>
            )}
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
      </View>
    </View>
  );
}
