import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import { CATEGORIES_MARKETPLACE, libelleCategorie, prixLisible, urlPhoto } from '@/lib/marketplace';
import { envoyerPhotoArticle, envoyerVideoArticle, modifierArticle, retirerArticle } from '@/lib/vendeur';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import SelecteurListe from '@/components/SelecteurListe';

// Modifier l'article (maquette « Vendeur — Publier un article », mode
// édition) : mêmes champs que la publication, pré-remplis, avec un aperçu
// en direct et Supprimer / Enregistrer au lieu de Publier.
const MAX_PHOTOS = 6;

const styleChamp = {
  height: 58,
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: '#0B3D2A',
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 18,
  fontSize: 15.5,
  color: '#1A1A1A',
  outlineStyle: 'none',
} as object;

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
    video: string;
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
  // Vidéo (maquette 22) : chemin déjà enregistré, ou nouveau fichier choisi.
  const [videoExistante, setVideoExistante] = useState<string | null>(params.video || null);
  const [nouvelleVideo, setNouvelleVideo] = useState<{ uri: string; extension: string } | null>(null);
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
    setNouvelleVideo({ uri: asset.uri, extension });
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

      // Sans session, on garde la vidéo déjà enregistrée plutôt que de
      // l'effacer — même prudence que pour les photos juste au-dessus.
      const cheminVideo =
        nouvelleVideo && user?.id
          ? await envoyerVideoArticle(nouvelleVideo.uri, user.id, nouvelleVideo.extension)
          : videoExistante;

      await modifierArticle(params.id, {
        titre: titreNet,
        categorie,
        prixXof: prixNombre,
        quantite: Math.max(0, Math.round(Number(quantite) || 0)),
        description,
        photos: chemins,
        urlVideo: cheminVideo,
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
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Modifier l'article" />

        <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Aperçu en direct, mis à jour avec la saisie */}
          <View className="flex-row items-center gap-3.5 bg-white" style={{ borderRadius: 20, padding: 10 }}>
            <View style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: '#E9E4D8', overflow: 'hidden' }}>
              {premierePhoto ? (
                <Image source={{ uri: premierePhoto }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Svg width="100%" height="100%">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Line key={i} x1={i * 18 - 84} y1={84} x2={i * 18} y2={0} stroke="#DDD6C6" strokeWidth={8} />
                  ))}
                </Svg>
              )}
              <View className="absolute flex-row items-center gap-1" style={{ top: 6, left: 6, backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                <Text className="text-white text-[10px] font-black">LIVE</Text>
              </View>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>Aperçu · {libelleCategorie(categorie).split(' ')[0]}</Text>
              <Text className="text-[20px] font-black text-[#1A1A1A]" numberOfLines={1}>
                {prixApercu > 0 ? `${prixLisible(prixApercu)} FCFA` : 'Prix'}
              </Text>
              <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>
                {titre || 'Titre de votre article'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-stretch gap-3">
            <Pressable
              onPress={ajouterPhotos}
              className="items-center justify-center"
              style={{ width: 76, height: 76, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)' }}>
              <Text className="text-[18px]" style={{ color: 'rgba(0,0,0,0.6)' }}>+</Text>
              <Text className="text-[11.5px] font-black text-[#1A1A1A]">Photos</Text>
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Scanner avec l’IA', 'Le remplissage de la fiche depuis une photo arrive dans une prochaine mise à jour.')}
              className="flex-1 flex-row items-center gap-3"
              style={{ backgroundColor: '#F3FBF7', borderRadius: 16, borderWidth: 1.5, borderColor: '#34D399', paddingHorizontal: 12 }}>
              <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: '#D7F2EA' }}>
                <Ionicons name="camera-outline" size={21} color="#0B3D2A" />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-black text-[#1A1A1A]">Scanner avec l&apos;IA</Text>
                <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Remplit la fiche depuis une photo</Text>
              </View>
            </Pressable>
          </View>

          {totalPhotos > 0 ? (
            <View>
              <Text className="text-[13px] font-black text-[#1A1A1A] mb-2">
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
                  <View key={p.uri} style={{ height: 80, aspectRatio: ratioAffichage(p.width, p.height) ?? 1 }} className="rounded-xl overflow-hidden relative">
                    <Image source={{ uri: p.uri }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <Pressable
                      onPress={() => retirerNouvellePhoto(p.uri)}
                      accessibilityLabel="Retirer cette photo"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 items-center justify-center">
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Vidéo (maquette 22) : celle déjà enregistrée, ou une nouvelle. */}
          <View>
            <Text className="text-[12.5px] font-bold text-gray-700 mb-2">Vidéo (facultative)</Text>
            {nouvelleVideo || videoExistante ? (
              <View className="flex-row items-center gap-2.5 bg-[#F2F0EA] rounded-xl px-3.5 py-3">
                <Ionicons name="videocam" size={18} color="#047857" />
                <Text className="flex-1 text-[12.5px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
                  {nouvelleVideo ? 'Nouvelle vidéo prête à être envoyée' : 'Vidéo enregistrée'}
                </Text>
                <Pressable
                  onPress={() => {
                    setNouvelleVideo(null);
                    setVideoExistante(null);
                  }}
                  accessibilityLabel="Retirer la vidéo"
                  hitSlop={8}>
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

          <View>
            <Text className="text-[14px] font-black text-[#1A1A1A] mb-2">Titre</Text>
            <TextInput value={titre} onChangeText={setTitre} placeholder="Ex. Tunique homme en lin" placeholderTextColor="rgba(0,0,0,0.4)" maxLength={120} style={styleChamp} />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-[14px] font-black text-[#1A1A1A] mb-2">Catégorie</Text>
              <SelecteurListe
                valeur={categorie}
                options={CATEGORIES_MARKETPLACE.map((c) => ({ id: c.id, label: c.label }))}
                placeholder="— Choisir —"
                titre="Catégorie"
                onChoisir={setCategorie}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-black text-[#1A1A1A] mb-2">Quantité</Text>
              <TextInput value={quantite} onChangeText={(v) => setQuantite(v.replace(/[^\d]/g, ''))} placeholder="1" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="number-pad" style={[styleChamp, { height: 50 }]} />
            </View>
          </View>

          <View>
            <Text className="text-[14px] font-black text-[#1A1A1A] mb-2">Prix (FCFA)</Text>
            <TextInput value={prix} onChangeText={(v) => setPrix(v.replace(/[^\d]/g, ''))} placeholder="5000" placeholderTextColor="rgba(0,0,0,0.4)" keyboardType="number-pad" style={styleChamp} />
          </View>

          <View>
            <Text className="text-[14px] font-black text-[#1A1A1A] mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="État, détails, dimensions…"
              placeholderTextColor="rgba(0,0,0,0.4)"
              multiline
              style={[styleChamp, { height: undefined, minHeight: 104, paddingTop: 16, textAlignVertical: 'top' }]}
            />
          </View>

          <View className="flex-row gap-3 mt-1">
            <Pressable
              onPress={demanderSuppression}
              disabled={enregistrement}
              className="flex-1 flex-row items-center justify-center gap-2"
              style={{ height: 58, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FCA5A5', opacity: enregistrement ? 0.6 : 1 }}>
              <Ionicons name="trash" size={16} color="#DC2626" />
              <Text className="text-[15.5px] font-black" style={{ color: '#DC2626' }}>Supprimer</Text>
            </Pressable>
            <Pressable
              onPress={enregistrer}
              disabled={enregistrement}
              className="flex-[1.4] flex-row items-center justify-center gap-2"
              style={{ height: 58, borderRadius: 16, backgroundColor: '#10B981', opacity: enregistrement ? 0.6 : 1 }}>
              {enregistrement ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-[16px] font-black">✓ Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
