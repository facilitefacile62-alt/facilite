import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import EnteteEtapes from '@/components/EnteteEtapes';
import SelecteurListe from '@/components/SelecteurListe';
import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import { CATEGORIES_MARKETPLACE, libelleCategorie, prixLisible } from '@/lib/marketplace';
import { envoyerPhotoArticle, envoyerVideoArticle, publierArticle } from '@/lib/vendeur';

// Publier un article — maquettes 18 (« Comment voulez-vous vendre ? »),
// 19 (formulaire « Scanner avec l'IA ») et 20 (Étape 2 : Détails).
//
// Parcours en 4 étapes : 1 Catégorie (méthode puis catégorie) · 2 Détails
// (photos, titre, description) · 3 Prix & stock (prix, quantité, vidéo) ·
// 4 Publication (récapitulatif). Les maquettes ne montrent que les étapes 1
// et 2 ; 3 et 4 reprennent les champs réels de l'article (prix, quantité,
// vidéo) dans le même habillage.
//
// Non repris, faute de colonne en base : « État », « Marque » et « Taille »
// de la maquette 20 (marketplace_items n'a pas ces champs). « Zéro Saisie IA »
// et le remplissage automatique par scan n'existent pas non plus côté
// serveur : l'option est affichée désactivée, comme sur la maquette.
const VERT = '#10B981';
const FONCE = '#0B3D2A';
const MAX_PHOTOS_MANUEL = 5;
const MAX_PHOTOS_SCAN = 6;

type PhotoLocale = { uri: string; width: number; height: number };
type Ecran = 'methode' | 'categorie' | 'scan' | 'details' | 'prix' | 'recap';

function Champ({
  libelle,
  requis,
  compteur,
  children,
}: {
  libelle: string;
  requis?: boolean;
  compteur?: string;
  children: ReactNode;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[14px] font-black text-[#1A1A1A]">
          {libelle}
          {requis ? <Text style={{ color: '#DC2626' }}> *</Text> : null}
        </Text>
        {compteur ? <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.45)' }}>{compteur}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styleChamp = {
  height: 58,
  borderRadius: 16,
  borderWidth: 1.5,
  borderColor: FONCE,
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 18,
  fontSize: 15.5,
  color: '#1A1A1A',
  outlineStyle: 'none',
} as object;

export default function PublierArticleScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [ecran, setEcran] = useState<Ecran>('methode');
  const [categorie, setCategorie] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoLocale[]>([]);
  // Vidéo facultative de l'article (maquette 22). Une seule par article.
  const [video, setVideo] = useState<{ uri: string; extension: string } | null>(null);
  const [titre, setTitre] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [description, setDescription] = useState('');
  const [publication, setPublication] = useState(false);

  const maxPhotos = ecran === 'scan' ? MAX_PHOTOS_SCAN : MAX_PHOTOS_MANUEL;

  function retour() {
    if (ecran === 'details') setEcran('categorie');
    else if (ecran === 'prix') setEcran('details');
    else if (ecran === 'recap') setEcran('prix');
    else if (ecran === 'categorie' || ecran === 'scan') setEcran('methode');
    else router.back();
  }

  async function ajouterPhotos() {
    if (photos.length >= maxPhotos) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à vos photos pour illustrer votre article.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos - photos.length,
    });
    if (resultat.canceled) return;
    const nouvelles = resultat.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setPhotos((prev) => [...prev, ...nouvelles].slice(0, maxPhotos));
  }

  async function prendrePhoto() {
    if (photos.length >= maxPhotos) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à l’appareil photo.');
      return;
    }
    const resultat = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    const asset = resultat.assets?.[0];
    if (resultat.canceled || !asset) return;
    setPhotos((prev) => [...prev, { uri: asset.uri, width: asset.width, height: asset.height }].slice(0, maxPhotos));
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

  function verifierTitre(): boolean {
    if (!titre.trim()) {
      Alert.alert('Titre manquant', 'Donnez un titre à votre article.');
      return false;
    }
    return true;
  }

  function verifierPrix(): boolean {
    const prixNombre = Number(prix.replace(/[^\d]/g, ''));
    if (!Number.isFinite(prixNombre) || prixNombre <= 0) {
      Alert.alert('Prix invalide', 'Indiquez un prix en FCFA supérieur à 0.');
      return false;
    }
    return true;
  }

  async function publier() {
    if (!storeId || !user?.id || !categorie) {
      Alert.alert('Catégorie manquante', 'Choisissez la catégorie de votre article.');
      return;
    }
    if (!verifierTitre() || !verifierPrix()) return;
    const prixNombre = Number(prix.replace(/[^\d]/g, ''));

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
        titre: titre.trim(),
        categorie,
        prixXof: prixNombre,
        quantite: Math.max(0, Math.round(Number(quantite) || 0)),
        description,
        photos: chemins,
        urlVideo: cheminVideo,
      });

      Alert.alert('Article publié', 'Il est désormais visible sur le Marketplace.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Publication impossible pour le moment.');
    } finally {
      setPublication(false);
    }
  }

  const bandeauPhotos = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {photos.map((p) => (
        // Vignette à SON format (même hauteur pour toutes) : rien n'est recadré.
        <View key={p.uri} style={{ height: 98, aspectRatio: ratioAffichage(p.width, p.height) ?? 1, borderRadius: 16, overflow: 'hidden' }}>
          <Image source={{ uri: p.uri }} alt="" style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <Pressable
            onPress={() => retirerPhoto(p.uri)}
            accessibilityLabel="Retirer cette photo"
            className="absolute items-center justify-center"
            style={{ top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <Ionicons name="close" size={13} color="#fff" />
          </Pressable>
        </View>
      ))}
      {photos.length < maxPhotos ? (
        <Pressable
          onPress={ajouterPhotos}
          className="items-center justify-center"
          style={{ width: 98, height: 98, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)' }}>
          <Ionicons name="camera-outline" size={22} color="rgba(0,0,0,0.5)" />
          <Text className="text-[13px] mt-1" style={{ color: 'rgba(0,0,0,0.55)' }}>Ajouter</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  // ------------------------------------------------------------------ 18
  if (ecran === 'methode') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteEtapes etape={1} titre="Catégorie" onRetour={retour} />
        <View className="px-4 pt-7 gap-3.5">
          <Text className="text-[20px] font-black text-[#1A1A1A] text-center mb-1">Comment voulez-vous vendre ?</Text>

          <Pressable
            onPress={() => {
              setPhotos([]);
              setEcran('scan');
            }}
            className="flex-row items-center gap-3 rounded-[16px] p-3.5"
            style={{ backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399' }}>
            <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: '#D7F2EA' }}>
              <Ionicons name="camera-outline" size={22} color={FONCE} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[16px] font-black text-[#0B3D2A]">Scanner avec l&apos;IA</Text>
                <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#FEF3C7' }}>
                  <Ionicons name="trophy-outline" size={10} color="#B45309" />
                  <Text className="text-[10.5px] font-black text-[#B45309]">PRO</Text>
                </View>
              </View>
              <Text className="text-[12.5px] mt-0.5 font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>Une photo suffit, vous mettez le prix</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.3)" />
          </Pressable>

          <Pressable
            onPress={() => {
              setPhotos([]);
              setEcran('categorie');
            }}
            className="flex-row items-center gap-3.5 rounded-[20px] bg-white p-4"
            style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
            <View className="items-center justify-center" style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: '#ECFDF5' }}>
              <Text style={{ fontSize: 27 }}>✍️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-black text-[#1A1A1A]">Vendre manuellement</Text>
              <Text className="text-[13px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)', lineHeight: 18 }}>
                Choisissez la catégorie et remplissez la fiche vous-même.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.3)" />
          </Pressable>
        </View>
      </View>
    );
  }

  // ------------------------------------------------------- catégorie (1/4)
  if (ecran === 'categorie') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteEtapes etape={1} titre="Catégorie" onRetour={retour} />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10" showsVerticalScrollIndicator={false}>
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
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2.5 border ${actif ? 'border-transparent' : 'bg-white border-gray-200'}`}
                  style={actif ? { backgroundColor: '#0d3b34' } : undefined}>
                  <Ionicons name={c.icone as keyof typeof Ionicons.glyphMap} size={14} color={actif ? '#6ee7c9' : '#4B5563'} />
                  <Text className={`text-[13px] font-semibold ${actif ? 'text-white' : 'text-gray-700'}`}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Juste sous « ‹ Changer » et la grille, pas collé en bas de l'écran. */}
          <Pressable
            onPress={() => categorie && setEcran('details')}
            disabled={!categorie}
            className="rounded-2xl py-3.5 items-center mt-6"
            style={{ backgroundColor: '#0d3b34', opacity: categorie ? 1 : 0.4 }}>
            <Text className="text-white text-[14.5px] font-bold">Continuer</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------------------------ 19
  if (ecran === 'scan') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteEtapes etape={1} titre="Catégorie" onRetour={retour} />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="bg-white gap-4" style={{ borderRadius: 24, padding: 16 }}>
            <Text className="text-[16px] font-black text-[#1A1A1A]">Photos de l&apos;article ({photos.length}/{MAX_PHOTOS_SCAN})</Text>
            {photos.length > 0 ? bandeauPhotos : null}
            <View className="flex-row gap-3">
              <Pressable
                onPress={ajouterPhotos}
                className="flex-1 items-center justify-center gap-1.5"
                style={{ height: 80, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F4F8FF' }}>
                <Ionicons name="images-outline" size={22} color="#2563EB" />
                <Text className="text-[13.5px] font-black text-[#1A1A1A]">Galerie &amp; Scan</Text>
              </Pressable>
              <Pressable
                onPress={prendrePhoto}
                className="flex-1 items-center justify-center gap-1.5"
                style={{ height: 80, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6EE7B7', backgroundColor: '#F2FCF7' }}>
                <Ionicons name="camera-outline" size={22} color="#047857" />
                <Text className="text-[13.5px] font-black text-[#1A1A1A]">Caméra &amp; Scan</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => Alert.alert('Zéro Saisie IA', "Le remplissage automatique par l'IA arrive dans une prochaine mise à jour.")}
              className="items-center justify-center gap-1"
              style={{ height: 86, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D8D4F0', backgroundColor: '#FAFAFF', opacity: 0.75 }}>
              <View className="flex-row items-center gap-2">
                <Text style={{ fontSize: 16 }}>✨</Text>
                <Text className="text-[14px] font-black" style={{ color: 'rgba(0,0,0,0.5)' }}>Zéro Saisie IA</Text>
                <View style={{ borderWidth: 1, borderColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text className="text-[10px] font-black text-[#B45309]">PRO</Text>
                </View>
              </View>
              <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.4)' }}>Importez une photo pour l&apos;activer</Text>
            </Pressable>
            <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)', lineHeight: 18 }}>
              🛡 Photos compressées automatiquement avant l&apos;envoi pour économiser vos données mobiles.
            </Text>
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />

            <Champ libelle="Nom commercial du produit" requis>
              <TextInput value={titre} onChangeText={setTitre} placeholder="Nom ou marque du produit (ex. iPhone 13)" placeholderTextColor="rgba(0,0,0,0.4)" maxLength={80} style={styleChamp} />
            </Champ>
            <Champ libelle="Catégorie" requis>
              <SelecteurListe
                valeur={categorie}
                options={CATEGORIES_MARKETPLACE.map((c) => ({ id: c.id, label: c.label }))}
                placeholder="— Choisir une catégorie —"
                titre="Catégorie"
                onChoisir={setCategorie}
              />
            </Champ>
            <Champ libelle="Prix en FCFA" requis>
              <TextInput
                value={prix}
                onChangeText={(v) => setPrix(v.replace(/[^\d]/g, ''))}
                placeholder="Prix en FCFA"
                placeholderTextColor="rgba(0,0,0,0.4)"
                keyboardType="number-pad"
                style={[styleChamp, { borderColor: VERT }]}
              />
            </Champ>
            <Champ libelle="Quantité en stock">
              <TextInput value={quantite} onChangeText={(v) => setQuantite(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styleChamp} />
            </Champ>
            <Champ libelle="Description commerciale">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Détails, état, dimensions…"
                placeholderTextColor="rgba(0,0,0,0.4)"
                multiline
                maxLength={500}
                style={[styleChamp, { height: undefined, minHeight: 110, paddingTop: 16, textAlignVertical: 'top' }]}
              />
            </Champ>

            <Pressable onPress={publier} disabled={publication} className="rounded-2xl py-3.5 items-center" style={{ backgroundColor: '#0d3b34', opacity: publication ? 0.6 : 1 }}>
              {publication ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Publier l&apos;article</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------------------------ 20
  if (ecran === 'details') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteEtapes etape={2} titre="Détails" onRetour={retour} />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="bg-white gap-3" style={{ borderRadius: 22, padding: 16 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[16px] font-black text-[#1A1A1A]">
                Photos <Text style={{ color: '#DC2626' }}>*</Text>
              </Text>
              <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.45)' }}>{photos.length}/{MAX_PHOTOS_MANUEL}</Text>
            </View>
            {bandeauPhotos}
          </View>

          <View className="bg-white gap-4" style={{ borderRadius: 22, padding: 16 }}>
            <Champ libelle="Titre" requis>
              <TextInput value={titre} onChangeText={setTitre} placeholder="Ex : Tunique homme taille L" placeholderTextColor="rgba(0,0,0,0.4)" maxLength={80} style={styleChamp} />
              <Text className="text-[12.5px] text-right mt-1.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{titre.length}/80</Text>
            </Champ>
            <Champ libelle="Description" compteur={`${description.length}/500`}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="État, raison de vente, caractéristiques…"
                placeholderTextColor="rgba(0,0,0,0.4)"
                multiline
                maxLength={500}
                style={[styleChamp, { height: undefined, minHeight: 118, paddingTop: 16, textAlignVertical: 'top' }]}
              />
            </Champ>
          </View>

          <Pressable
            onPress={() => {
              if (photos.length === 0) {
                Alert.alert('Photo manquante', 'Ajoutez au moins une photo de votre article.');
                return;
              }
              if (verifierTitre()) setEcran('prix');
            }}
            className="rounded-2xl py-3.5 items-center"
            style={{ backgroundColor: '#0d3b34' }}>
            <Text className="text-white text-[14.5px] font-bold">Continuer</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // --------------------------------------------------------------- 3 / 4
  if (ecran === 'prix') {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteEtapes etape={3} titre="Prix & stock" onRetour={retour} />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="bg-white gap-4" style={{ borderRadius: 22, padding: 16 }}>
            <Champ libelle="Prix en FCFA" requis>
              <TextInput
                value={prix}
                onChangeText={(v) => setPrix(v.replace(/[^\d]/g, ''))}
                placeholder="Ex : 10000"
                placeholderTextColor="rgba(0,0,0,0.4)"
                keyboardType="number-pad"
                style={[styleChamp, { borderColor: VERT }]}
              />
            </Champ>
            <Champ libelle="Quantité en stock">
              <TextInput value={quantite} onChangeText={(v) => setQuantite(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={styleChamp} />
            </Champ>
          </View>

          <View className="bg-white gap-3" style={{ borderRadius: 22, padding: 16 }}>
            <Text className="text-[16px] font-black text-[#1A1A1A]">Vidéo <Text className="text-[13px] font-semibold" style={{ color: 'rgba(0,0,0,0.45)' }}>(facultative)</Text></Text>
            {video ? (
              <View className="flex-row items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ backgroundColor: '#F2F0EA' }}>
                <Ionicons name="videocam" size={18} color="#047857" />
                <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]" numberOfLines={1}>Vidéo prête à être envoyée</Text>
                <Pressable onPress={() => setVideo(null)} accessibilityLabel="Retirer la vidéo" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.35)" />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={choisirVideo} className="flex-row items-center gap-2.5 px-3.5 py-3.5" style={{ borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.25)' }}>
                <Ionicons name="videocam-outline" size={18} color="rgba(0,0,0,0.5)" />
                <Text className="text-[13px] font-semibold" style={{ color: 'rgba(0,0,0,0.55)' }}>Ajouter une vidéo (30 Mo max.)</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => {
              if (verifierPrix()) setEcran('recap');
            }}
            className="rounded-2xl py-3.5 items-center"
            style={{ backgroundColor: '#0d3b34' }}>
            <Text className="text-white text-[14.5px] font-bold">Continuer</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <EnteteEtapes etape={4} titre="Publication" onRetour={retour} />
      <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-4" showsVerticalScrollIndicator={false}>
        <View className="bg-white gap-3" style={{ borderRadius: 22, padding: 16 }}>
          <Text className="text-[16px] font-black text-[#1A1A1A]">Récapitulatif</Text>
          {photos.length > 0 ? (
            <Image source={{ uri: photos[0].uri }} alt="" contentFit="cover" style={{ width: '100%', height: 190, borderRadius: 16 }} />
          ) : null}
          <Text className="text-[17px] font-black text-[#1A1A1A]">{titre.trim()}</Text>
          <Text className="text-[16px] font-black" style={{ color: '#047857' }}>{prixLisible(Number(prix) || 0)} FCFA</Text>
          <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
            {libelleCategorie(categorie)} · {Math.max(0, Math.round(Number(quantite) || 0))} en stock · {photos.length} photo{photos.length > 1 ? 's' : ''}
            {video ? ' · 1 vidéo' : ''}
          </Text>
          {description.trim() ? <Text className="text-[13.5px]" style={{ color: '#374151', lineHeight: 20 }}>{description.trim()}</Text> : null}
        </View>

        <Pressable onPress={publier} disabled={publication} className="rounded-2xl py-3.5 items-center" style={{ backgroundColor: '#0d3b34', opacity: publication ? 0.6 : 1 }}>
          {publication ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-[14.5px] font-bold">Publier l&apos;article</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}
