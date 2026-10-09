import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { useFavori } from '@/lib/favoris';
import { normaliserWhatsapp } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';
import { envoyerPieceJointeChat, urlPieceJointeSignee, type TypePieceJointe } from '@/lib/chatAttachments';
import { useChatThread } from '@/lib/useChatThread';
import type { ChatMessage } from '@/lib/messages';

// Discussion façon WhatsApp : en-tête simple, fil qui s'ouvre sur le DERNIER message, zone de saisie arrondie et
// bouton d'envoi rond TOUJOURS visible en bas, poussé par le clavier — plus les pièces jointes (photo, galerie,
// document) et la note vocale RÉELLEMENT enregistrée et écoutable (retirées par erreur le 24/09/2026 : la
// version précédente de cet écran ne les proposait pas du tout ; signalé le 25/09/2026, remises en place en
// s'inspirant de WhatsApp). « Autocollants » : pas de bibliothèque d'images dédiée construite ici (hors de
// portée raisonnable pour ce point) — un clavier d'emojis fait office d'équivalent léger, inséré dans le texte.
const VERT = '#10B981';

// Émojis courants (équivalent léger à des « autocollants ») — insérés dans le texte, pas envoyés comme pièce
// jointe séparée : un vrai système de stickers (packs, images dédiées) reste un chantier à part.
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍', '😘', '😜', '🤔', '😎',
  '😢', '😭', '😡', '😱', '🥳', '😴', '🤝', '👍', '👎', '🙏', '👏', '💪',
  '🎉', '❤️', '🔥', '✨', '👋', '💯', '🙌', '😇',
];

// Barres décoratives (pas une vraie mesure d'amplitude) : suffisant pour évoquer un enregistrement/une
// écoute, comme le fait d'ailleurs souvent l'indicateur d'attente d'une vraie appli plutôt qu'un calcul
// coûteux échantillon par échantillon en continu.
const BARRES_SAISIE = [6, 11, 8, 15, 9, 13, 7, 12, 10, 16, 8, 11];
const BARRES_LECTURE = [5, 9, 14, 8, 17, 11, 6, 13, 10, 16, 7, 12, 9, 15, 6, 11, 8, 14, 10, 5];

// Marketplace : deux premières lettres du nom (« MO » pour Moïse Couture) ;
// Facilité : première lettre du premier et du dernier mot (« SF » pour
// Support RH Facilité).
function initiales(nom: string | undefined, deuxLettres: boolean): string {
  const propre = (nom ?? '').trim();
  if (!propre) return '·';
  if (deuxLettres) return propre.slice(0, 2).toUpperCase();
  const mots = propre.split(/\s+/);
  return (mots.length > 1 ? mots[0][0] + mots[mots.length - 1][0] : mots[0].slice(0, 2)).toUpperCase();
}

function formaterDuree(secondes: number): string {
  const total = Math.max(0, Math.round(secondes));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function ChatDetailScreen() {
  const {
    id,
    contexte,
    nom: nomParam,
    brouillon: brouillonParam,
    article: articleParam,
  } = useLocalSearchParams<{ id: string; contexte?: string; nom?: string; brouillon?: string; article?: string }>();
  // Arrivée depuis la fiche d'un article (Marketplace) : les messages sont
  // étiquetés MARKETPLACE, le fil porte le nom de la boutique et le composeur
  // est prérempli avec un message qui nomme l'article.
  const marketplace = contexte === 'marketplace';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { messages, autreParticipant, envoyer, envoyerPieceJointe, envoiEnCours } = useChatThread(
    id,
    user?.id,
    marketplace ? 'MARKETPLACE' : undefined
  );
  const nomAffiche = marketplace && nomParam ? nomParam : autreParticipant?.nom;

  // Marketplace (maquette 36) : téléphone du vendeur (boutique active de
  // l'interlocuteur) — l'icône n'apparaît que s'il en a un — et cœur de
  // l'article d'où vient la discussion (absent quand on ouvre la discussion
  // depuis la liste : aucun article à mettre en favori).
  const [telephoneVendeur, setTelephoneVendeur] = useState<string | null>(null);
  const autreId = autreParticipant?.id;
  useEffect(() => {
    if (!marketplace || !autreId) return;
    let annule = false;
    supabase
      .from('marketplace_stores')
      .select('telephone_whatsapp')
      .eq('owner_id', autreId)
      .eq('actif', true)
      .not('telephone_whatsapp', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!annule) setTelephoneVendeur(normaliserWhatsapp(data?.telephone_whatsapp as string | null | undefined));
      });
    return () => {
      annule = true;
    };
  }, [marketplace, autreId]);
  const idArticle = typeof articleParam === 'string' ? articleParam : undefined;
  const { favori, basculer: basculerFavori } = useFavori(marketplace ? idArticle : undefined, user?.id);
  const [brouillon, setBrouillon] = useState(typeof brouillonParam === 'string' ? brouillonParam : '');
  const listeRef = useRef<FlatList<ChatMessage>>(null);
  // Clavier ouvert : il recouvre déjà la barre système, inutile de garder sa marge sous la zone d'envoi.
  const [clavierOuvert, setClavierOuvert] = useState(false);
  const [menuJointOuvert, setMenuJointOuvert] = useState(false);
  const [emojiOuvert, setEmojiOuvert] = useState(false);
  const [envoiFichierEnCours, setEnvoiFichierEnCours] = useState(false);

  // Facilité (maquettes 06 et 12) : cœur = conversation favorite DE CET
  // APPAREIL (aucune colonne en base, le site garde cet état en mémoire),
  // loupe = recherche dans le fil, ⋮ = « Réponses de l'IA » / « Infos ».
  const [conversationFavorite, setConversationFavorite] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [termeRecherche, setTermeRecherche] = useState('');
  const [modalIa, setModalIa] = useState(false);
  const [modalInfos, setModalInfos] = useState(false);
  const cleFavori = `FACILITE_CONV_FAVORITE_${id}`;
  useEffect(() => {
    if (marketplace) return;
    AsyncStorage.getItem(cleFavori)
      .then((v) => setConversationFavorite(v === '1'))
      .catch(() => {});
  }, [marketplace, cleFavori]);
  function basculerConversationFavorite() {
    const suivant = !conversationFavorite;
    setConversationFavorite(suivant);
    AsyncStorage.setItem(cleFavori, suivant ? '1' : '0').catch(() => {});
  }
  const messagesAffiches =
    messages && termeRecherche.trim()
      ? messages.filter((m) => (m.text ?? '').toLowerCase().includes(termeRecherche.trim().toLowerCase()))
      : messages;

  useEffect(() => {
    const ouvre = Keyboard.addListener('keyboardDidShow', () => setClavierOuvert(true));
    const ferme = Keyboard.addListener('keyboardDidHide', () => setClavierOuvert(false));
    return () => {
      ouvre.remove();
      ferme.remove();
    };
  }, []);

  const peutEnvoyer = !envoiEnCours && brouillon.trim().length > 0;

  async function handleEnvoyer() {
    if (!peutEnvoyer) return;
    const texte = brouillon;
    setBrouillon('');
    await envoyer(texte);
  }

  async function envoyerFichierChoisi(uri: string, fileName: string, mimeType: string, taille?: number, attachmentType?: TypePieceJointe) {
    if (!user?.id) return;
    setEnvoiFichierEnCours(true);
    try {
      const piece = await envoyerPieceJointeChat({ uri, userId: user.id, fileName, mimeType, taille, attachmentType });
      await envoyerPieceJointe(piece.attachmentUrl, piece.attachmentType, piece.fileName, piece.fileSize);
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Échec de l'envoi du fichier.");
    } finally {
      setEnvoiFichierEnCours(false);
    }
  }

  async function prendrePhoto() {
    setMenuJointOuvert(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder à l'appareil photo.");
      return;
    }
    const resultat = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await envoyerFichierChoisi(asset.uri, asset.fileName || `photo_${Date.now()}.jpg`, asset.mimeType || 'image/jpeg', asset.fileSize, 'image');
    }
  }

  async function choisirDansGalerie() {
    setMenuJointOuvert(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder à vos photos.");
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await envoyerFichierChoisi(asset.uri, asset.fileName || `photo_${Date.now()}.jpg`, asset.mimeType || 'image/jpeg', asset.fileSize, 'image');
    }
  }

  async function choisirDocument() {
    setMenuJointOuvert(false);
    const resultat = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/webp',
      ],
      copyToCacheDirectory: true,
    });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await envoyerFichierChoisi(asset.uri, asset.name, asset.mimeType || 'application/octet-stream', asset.size ?? undefined);
    }
  }

  function inserer(emoji: string) {
    setBrouillon((prev) => prev + emoji);
  }

  return (
    <View style={{ flex: 1, backgroundColor: marketplace ? '#F4EFE7' : '#F0EEE8' }}>
      {/* Marketplace (maquette 36) : l'en-tête de la plateforme porte la zone sûre du haut */}
      {marketplace ? (
        <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
          <MarketplaceHeader />
        </View>
      ) : null}
      <SafeAreaView style={{ flex: 1 }} edges={marketplace ? [] : ['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {/* En-tête */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 10,
              backgroundColor: marketplace ? '#F4EFE7' : '#F0EEE8',
              borderBottomWidth: marketplace ? 1 : 0,
              borderBottomColor: 'rgba(0,0,0,0.06)',
            }}>
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Retour"
              hitSlop={8}
              style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
            </Pressable>
            <View
              style={{ width: marketplace ? 38 : 46, height: marketplace ? 38 : 46, borderRadius: 23, backgroundColor: VERT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{initiales(nomAffiche, marketplace)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>
                {nomAffiche ?? 'Discussion'}
              </Text>
              <Text style={{ fontSize: 11.5, color: '#059669' }} numberOfLines={1}>
                {marketplace ? `Boutique${nomAffiche ? ` · ${nomAffiche}` : ''}` : autreParticipant?.estAdmin ? 'en ligne · Facilité' : 'Facilité'}
              </Text>
            </View>
            {!marketplace ? (
              <>
                <Pressable
                  onPress={basculerConversationFavorite}
                  accessibilityLabel={conversationFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  hitSlop={8}
                  style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={conversationFavorite ? 'heart' : 'heart-outline'} size={21} color={conversationFavorite ? '#DC2626' : '#1A1A1A'} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setRechercheOuverte((v) => !v);
                    setTermeRecherche('');
                    setMenuOuvert(false);
                  }}
                  accessibilityLabel="Rechercher dans la discussion"
                  hitSlop={8}
                  style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="search-outline" size={20} color="#1A1A1A" />
                </Pressable>
                <Pressable
                  onPress={() => setMenuOuvert((v) => !v)}
                  accessibilityLabel="Options de la discussion"
                  hitSlop={8}
                  style={{ width: 28, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="ellipsis-vertical" size={19} color="#1A1A1A" />
                </Pressable>
              </>
            ) : null}
            {marketplace && idArticle ? (
              <Pressable
                onPress={basculerFavori}
                accessibilityLabel={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                hitSlop={8}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={favori ? 'heart' : 'heart-outline'} size={22} color={favori ? '#EF4444' : '#1A1A1A'} />
              </Pressable>
            ) : null}
            {marketplace && telephoneVendeur ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${telephoneVendeur}`).catch(() => Alert.alert('Appel', "Impossible de lancer l'appel."))}
                accessibilityLabel="Appeler le vendeur"
                hitSlop={8}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="call-outline" size={21} color="#1A1A1A" />
              </Pressable>
            ) : null}
          </View>

          {rechercheOuverte && !marketplace ? (
            <View style={{ paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#F0EEE8' }}>
              <TextInput
                value={termeRecherche}
                onChangeText={setTermeRecherche}
                autoFocus
                placeholder="Rechercher dans la discussion…"
                placeholderTextColor="rgba(0,0,0,0.4)"
                style={[{ height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontSize: 14.5, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
              />
            </View>
          ) : null}

          {marketplace ? (
            <View
              style={{
                marginHorizontal: 14,
                marginTop: 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: '#FFF3C4',
                borderWidth: 1,
                borderColor: '#F0D27A',
              }}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#92400E' }}>
                🔒 Les échanges avec ce vendeur/client du Marketplace sont chiffrés.
              </Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            {/* Fil : s'ouvre sur le dernier message, et suit les nouveaux */}
            {messages === null ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#2563EB" />
              </View>
            ) : (
              <FlatList
                ref={listeRef}
                data={messagesAffiches}
                keyExtractor={(m) => m.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 12, gap: 6, flexGrow: 1, justifyContent: 'flex-end' }}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => <BulleMessage message={item} marketplace={marketplace} />}
                ListEmptyComponent={
                  <Text style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.4)', fontWeight: '500', textAlign: 'center', marginBottom: 24 }}>
                    {termeRecherche.trim() ? 'Aucun message ne correspond à cette recherche.' : 'Aucun message pour l&apos;instant — dites bonjour 👋'}
                  </Text>
                }
              />
            )}

            {/* Menu pièce jointe : feuille du bas, icônes en cercle (même famille visuelle que WhatsApp) */}
            {menuJointOuvert && (
              <Pressable onPress={() => setMenuJointOuvert(false)} style={{ position: 'absolute', inset: 0 }}>
                <Pressable
                  onPress={() => {}}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 22,
                    borderTopRightRadius: 22,
                    paddingTop: 20,
                    paddingBottom: 26,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: -4 },
                    elevation: 10,
                  }}>
                  <OptionJointe icone="document-outline" couleur="#7C3AED" fond="#EDE7FB" label="Document" onPress={choisirDocument} />
                  <OptionJointe icone="camera-outline" couleur="#DC2626" fond="#FBE7E7" label="Appareil photo" onPress={prendrePhoto} />
                  <OptionJointe icone="images-outline" couleur="#2563EB" fond="#E1EAFB" label="Galerie" onPress={choisirDansGalerie} />
                </Pressable>
              </Pressable>
            )}

            {/* Clavier d'émojis (équivalent léger aux autocollants) */}
            {emojiOuvert && (
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  bottom: 68,
                  height: 210,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 10,
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}>
                <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {EMOJIS.map((e, i) => (
                    <Pressable
                      key={`${e}-${i}`}
                      onPress={() => inserer(e)}
                      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {menuOuvert && !marketplace ? (
            <Pressable onPress={() => setMenuOuvert(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <View
                style={{
                  position: 'absolute',
                  top: 62,
                  right: 12,
                  width: 214,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  paddingVertical: 8,
                  shadowColor: '#000',
                  shadowOpacity: 0.16,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 8,
                }}>
                <Pressable
                  onPress={() => {
                    setMenuOuvert(false);
                    setModalIa(true);
                  }}
                  style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>Réponses de l&apos;IA</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMenuOuvert(false);
                    setModalInfos(true);
                  }}
                  style={{ paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="information-circle-outline" size={17} color="#2563EB" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>Infos sur la discussion</Text>
                </Pressable>
              </View>
            </Pressable>
          ) : null}

          <Modal visible={modalIa} transparent animationType="fade" onRequestClose={() => setModalIa(false)}>
            <Pressable onPress={() => setModalIa(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111' }}>Réponses de l’IA</Text>
                <Text style={{ fontSize: 13.5, lineHeight: 20, color: '#374151', marginTop: 10 }}>
                  L’IA répondra automatiquement aux messages de cette discussion. Vous recevrez une notification de message non lu si l’IA ne sait pas comment répondre.
                </Text>
                <Pressable onPress={() => setModalIa(false)} style={{ alignSelf: 'flex-end', marginTop: 22, paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#147953' }}>Fermer</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal visible={modalInfos} transparent animationType="fade" onRequestClose={() => setModalInfos(false)}>
            <Pressable onPress={() => setModalInfos(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111' }}>Infos sur la discussion</Text>
                <Text style={{ fontSize: 13.5, color: '#374151', marginTop: 8 }}>Avec : {nomAffiche ?? '—'}</Text>
                <Text style={{ fontSize: 13.5, color: '#374151' }}>Messages : {messages?.length ?? 0}</Text>
                <Text style={{ fontSize: 13.5, color: '#374151' }}>
                  Photos et documents : {messages?.filter((m) => m.attachmentUrl).length ?? 0}
                </Text>
                <Pressable onPress={() => setModalInfos(false)} style={{ alignSelf: 'flex-end', marginTop: 16, paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#147953' }}>Fermer</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <ZoneSaisie
            brouillon={brouillon}
            setBrouillon={setBrouillon}
            marketplace={marketplace}
            peutEnvoyer={peutEnvoyer}
            envoiEnCours={envoiEnCours || envoiFichierEnCours}
            onEnvoyer={handleEnvoyer}
            clavierOuvert={clavierOuvert}
            paddingBas={Math.max(insets.bottom, 8) + 4}
            menuJointOuvert={menuJointOuvert}
            onToggleJoint={() => {
              setEmojiOuvert(false);
              setMenuJointOuvert((v) => !v);
            }}
            emojiOuvert={emojiOuvert}
            onToggleEmoji={() => {
              setMenuJointOuvert(false);
              setEmojiOuvert((v) => !v);
            }}
            onEnvoyerFichier={envoyerFichierChoisi}
            userId={user?.id}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function OptionJointe({
  icone,
  couleur,
  fond,
  label,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  couleur: string;
  fond: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 7, width: 84 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: fond, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={24} color={couleur} />
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

// Zone de saisie séparée (composant à part) : peut ainsi héberger le hook d'enregistrement (useAudioRecorder)
// sans le monter dans l'écran entier — un enregistreur audio a un coût natif, autant ne l'instancier qu'ici.
function ZoneSaisie({
  brouillon,
  setBrouillon,
  marketplace,
  peutEnvoyer,
  envoiEnCours,
  onEnvoyer,
  clavierOuvert,
  paddingBas,
  menuJointOuvert,
  onToggleJoint,
  emojiOuvert,
  onToggleEmoji,
  onEnvoyerFichier,
  userId,
}: {
  brouillon: string;
  setBrouillon: (v: string) => void;
  marketplace: boolean;
  peutEnvoyer: boolean;
  envoiEnCours: boolean;
  onEnvoyer: () => void;
  clavierOuvert: boolean;
  paddingBas: number;
  menuJointOuvert: boolean;
  onToggleJoint: () => void;
  emojiOuvert: boolean;
  onToggleEmoji: () => void;
  onEnvoyerFichier: (uri: string, fileName: string, mimeType: string, taille?: number, attachmentType?: TypePieceJointe) => Promise<void>;
  userId?: string;
}) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const etatEnregistreur = useAudioRecorderState(recorder, 200);
  const [modeEnregistrement, setModeEnregistrement] = useState(false);
  // En pause : l'enregistrement est suspendu et écoutable avant d'être envoyé ou repris — comme WhatsApp
  // (« Pause » puis « Reprendre »), pas seulement Annuler/Envoyer.
  const [enPause, setEnPause] = useState(false);
  const [uriApercu, setUriApercu] = useState<string | null>(null);
  const lecteurApercu = useAudioPlayer(uriApercu ?? undefined);
  const statutApercu = useAudioPlayerStatus(lecteurApercu);
  const dureeApercu = statutApercu.duration || 0;
  const positionApercu = statutApercu.currentTime || 0;
  const avancementApercu = dureeApercu > 0 ? Math.min(1, positionApercu / dureeApercu) : 0;

  async function commencerEnregistrement() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder au micro pour une note vocale.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setEnPause(false);
      setUriApercu(null);
      setModeEnregistrement(true);
    } catch {
      Alert.alert('Micro', "Impossible de démarrer l'enregistrement pour le moment.");
    }
  }

  function mettreEnPause() {
    try {
      recorder.pause();
      setUriApercu(recorder.uri);
      setEnPause(true);
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre en pause pour le moment.');
    }
  }

  function reprendreEnregistrement() {
    lecteurApercu.pause();
    setUriApercu(null);
    setEnPause(false);
    recorder.record();
  }

  function basculerApercu() {
    if (!uriApercu) return;
    if (statutApercu.playing) {
      lecteurApercu.pause();
      return;
    }
    if (positionApercu >= dureeApercu - 0.05 && dureeApercu > 0) lecteurApercu.seekTo(0);
    lecteurApercu.play();
  }

  async function annulerEnregistrement() {
    setModeEnregistrement(false);
    setEnPause(false);
    lecteurApercu.pause();
    setUriApercu(null);
    try {
      await recorder.stop();
    } catch {
      // rien à envoyer, l'annulation reste silencieuse même si l'arrêt natif échoue
    }
  }

  async function envoyerEnregistrement() {
    setModeEnregistrement(false);
    setEnPause(false);
    lecteurApercu.pause();
    try {
      await recorder.stop();
    } catch {
      Alert.alert('Erreur', "Échec de l'enregistrement. Réessayez.");
      return;
    }
    const uri = recorder.uri;
    setUriApercu(null);
    if (!uri || !userId) return;
    await onEnvoyerFichier(uri, `note_vocale_${Date.now()}.m4a`, 'audio/m4a', undefined, 'audio');
  }

  if (modeEnregistrement) {
    return (
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: clavierOuvert ? 10 : paddingBas,
          backgroundColor: 'rgba(242,240,234,0.96)',
          gap: 10,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={annulerEnregistrement} accessibilityLabel="Supprimer la note vocale" hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </Pressable>
          {enPause ? (
            <>
              <Pressable
                onPress={basculerApercu}
                disabled={!uriApercu}
                accessibilityLabel={statutApercu.playing ? "Mettre l'écoute en pause" : 'Écouter avant d’envoyer'}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: VERT, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={statutApercu.playing ? 'pause' : 'play'} size={14} color="#FFFFFF" style={statutApercu.playing ? undefined : { marginLeft: 1.5 }} />
              </Pressable>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 }}>
                {BARRES_LECTURE.map((h, i) => {
                  const actif = i / BARRES_LECTURE.length <= avancementApercu;
                  return (
                    <View
                      key={i}
                      style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: actif ? VERT : 'rgba(0,0,0,0.15)' }}
                    />
                  );
                })}
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', fontVariant: ['tabular-nums'] }}>
                {formaterDuree(statutApercu.playing || positionApercu > 0 ? positionApercu : dureeApercu)}
              </Text>
            </>
          ) : (
            <>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', fontVariant: ['tabular-nums'] }}>
                {formaterDuree((etatEnregistreur.durationMillis || 0) / 1000)}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 18 }}>
                {BARRES_SAISIE.map((h, i) => (
                  <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: 'rgba(220,38,38,0.55)' }} />
                ))}
              </View>
            </>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={enPause ? reprendreEnregistrement : mettreEnPause}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.1)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            <Ionicons name={enPause ? 'mic' : 'pause'} size={16} color="#1A1A1A" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A' }}>{enPause ? 'Reprendre' : 'Pause'}</Text>
          </Pressable>
          <Pressable
            onPress={envoyerEnregistrement}
            accessibilityLabel="Envoyer la note vocale"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: VERT, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (!marketplace) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: clavierOuvert ? 10 : paddingBas,
          backgroundColor: '#FFFFFF',
        }}>
        <Pressable
          onPress={onToggleJoint}
          accessibilityLabel="Joindre une photo ou un document"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDEBE5', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={24} color="#1A1A1A" />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDEBE5', borderRadius: 22, paddingLeft: 18, paddingRight: 12, minHeight: 46 }}>
          <TextInput
            value={brouillon}
            onChangeText={setBrouillon}
            placeholder="Posez une question, demandez un conseil…"
            placeholderTextColor="rgba(0,0,0,0.42)"
            accessibilityLabel="Écrire un message"
            multiline
            textAlignVertical="center"
            style={[{ flex: 1, maxHeight: 130, paddingVertical: 10, fontSize: 15, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
          />
          <Pressable onPress={commencerEnregistrement} accessibilityLabel="Enregistrer une note vocale" hitSlop={8} style={{ paddingLeft: 8 }}>
            <Ionicons name="mic-outline" size={19} color="rgba(0,0,0,0.65)" />
          </Pressable>
        </View>
        <Pressable
          onPress={onEnvoyer}
          disabled={!peutEnvoyer || envoiEnCours}
          accessibilityLabel="Envoyer le message"
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#111111', opacity: peutEnvoyer || envoiEnCours ? 1 : 0.85, alignItems: 'center', justifyContent: 'center' }}>
          {envoiEnCours ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: clavierOuvert ? 8 : paddingBas,
        backgroundColor: 'rgba(242,240,234,0.96)',
      }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          paddingLeft: 6,
          paddingRight: 10,
          minHeight: 48,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.08)',
        }}>
        <Pressable
          onPress={onToggleEmoji}
          accessibilityLabel="Émojis"
          style={{ width: 36, height: 36, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={emojiOuvert ? 'happy' : 'happy-outline'} size={22} color={emojiOuvert ? VERT : 'rgba(0,0,0,0.45)'} />
        </Pressable>
        <TextInput
          value={brouillon}
          onChangeText={setBrouillon}
          placeholder={marketplace ? 'Écrire au vendeur…' : 'Message'}
          placeholderTextColor="rgba(0,0,0,0.4)"
          accessibilityLabel="Écrire un message"
          // Multiligne : le message prérempli d'un article (3 lignes) doit être
          // lisible en entier avant l'envoi, pas tronqué sur une seule ligne.
          multiline
          textAlignVertical="center"
          style={{ flex: 1, maxHeight: 130, paddingVertical: 12, fontSize: 16, color: '#1A1A1A' }}
        />
        <Pressable
          onPress={onToggleJoint}
          accessibilityLabel="Joindre une photo ou un document"
          style={{ width: 36, height: 36, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="attach" size={22} color={menuJointOuvert ? VERT : 'rgba(0,0,0,0.45)'} />
        </Pressable>
      </View>
      <Pressable
        onPress={peutEnvoyer ? onEnvoyer : commencerEnregistrement}
        accessibilityLabel={peutEnvoyer ? 'Envoyer le message' : 'Enregistrer une note vocale'}
        disabled={envoiEnCours}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: envoiEnCours ? '#B6BCC4' : VERT,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {envoiEnCours ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons name={peutEnvoyer ? 'send' : 'mic'} size={20} color="#FFFFFF" style={peutEnvoyer ? { marginLeft: 2 } : undefined} />
        )}
      </Pressable>
    </View>
  );
}

function BulleMessage({ message, marketplace }: { message: ChatMessage; marketplace: boolean }) {
  const moi = message.sender === 'me';
  const aUnePieceJointe = !!message.attachmentUrl && !!message.attachmentType;

  return (
    <View style={{ flexDirection: 'row', justifyContent: moi ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: marketplace ? '80%' : '86%',
          padding: aUnePieceJointe && message.attachmentType === 'image' ? 4 : undefined,
          paddingHorizontal: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 11,
          paddingTop: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 7,
          paddingBottom: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 5,
          borderRadius: marketplace ? 14 : 20,
          borderTopRightRadius: marketplace ? (moi ? 4 : 14) : 20,
          borderTopLeftRadius: marketplace ? (moi ? 14 : 4) : 20,
          backgroundColor: moi ? (marketplace ? '#D7F5E4' : '#D3F1E8') : '#FFFFFF',
          borderWidth: marketplace ? 1 : 0,
          borderColor: moi ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.06)',
          gap: 4,
        }}>
        {aUnePieceJointe && message.attachmentType === 'image' && (
          <ImagePieceJointe chemin={message.attachmentUrl as string} />
        )}
        {aUnePieceJointe && message.attachmentType === 'audio' && (
          <View style={{ paddingHorizontal: 4, paddingTop: 2 }}>
            <LecteurNoteVocale chemin={message.attachmentUrl as string} moi={moi} />
          </View>
        )}
        {aUnePieceJointe && (message.attachmentType === 'pdf' || message.attachmentType === 'document') && (
          <DocumentPieceJointe
            chemin={message.attachmentUrl as string}
            nom={message.fileName || 'Fichier'}
            taille={message.fileSize}
            estPdf={message.attachmentType === 'pdf'}
          />
        )}
        {!aUnePieceJointe && message.text ? (
          <Text style={{ fontSize: marketplace ? 15 : 16, lineHeight: marketplace ? 21 : 23, color: '#111827' }}>{message.text}</Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            alignSelf: 'flex-end',
            marginTop: aUnePieceJointe && message.attachmentType === 'image' ? 0 : 2,
            marginRight: aUnePieceJointe && message.attachmentType === 'image' ? 6 : 0,
            marginBottom: aUnePieceJointe && message.attachmentType === 'image' ? 4 : 0,
          }}>
          <Text style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.45)' }}>{message.time}</Text>
          {/* Accusé de lecture, comme WhatsApp : coche grise simple tant que non lu, double coche colorée une
              fois lu. Snapshot pris à l'ouverture du fil — ne se met pas à jour toute seule si l'autre
              personne lit pendant que cet écran reste ouvert (pas de mise à jour en direct pour l'instant). */}
          {moi && (
            <Ionicons
              name={message.isRead ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={message.isRead ? '#34B7F1' : 'rgba(0,0,0,0.4)'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function ImagePieceJointe({ chemin }: { chemin: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    let annule = false;
    urlPieceJointeSignee(chemin).then((u) => {
      if (!annule) setUrl(u);
    });
    return () => {
      annule = true;
    };
  }, [chemin]);

  return (
    <>
      <Pressable
        onPress={() => url && setOuverte(true)}
        accessibilityLabel="Agrandir la photo"
        style={{ width: 190, height: 190, borderRadius: 11, overflow: 'hidden', backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
        {url ? (
          <Image source={{ uri: url }} alt="Photo envoyée" style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <ActivityIndicator color="#6B7280" />
        )}
      </Pressable>
      <Modal visible={ouverte} transparent animationType="fade" onRequestClose={() => setOuverte(false)}>
        <Pressable
          onPress={() => setOuverte(false)}
          accessibilityLabel="Fermer"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {url && <Image source={{ uri: url }} alt="Photo envoyée" style={{ width: '100%', height: '80%' }} contentFit="contain" />}
        </Pressable>
      </Modal>
    </>
  );
}

function LecteurNoteVocale({ chemin, moi }: { chemin: string; moi: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    urlPieceJointeSignee(chemin).then((u) => {
      if (!annule) setUrl(u);
    });
    return () => {
      annule = true;
    };
  }, [chemin]);

  const player = useAudioPlayer(url ?? undefined);
  const status = useAudioPlayerStatus(player);
  const duree = status.duration || 0;
  const position = status.currentTime || 0;
  const avancement = duree > 0 ? Math.min(1, position / duree) : 0;

  function basculer() {
    if (!url || !status.isLoaded) return;
    if (status.playing) player.pause();
    else {
      if (position >= duree - 0.05 && duree > 0) player.seekTo(0);
      player.play();
    }
  }

  return (
    <Pressable onPress={basculer} disabled={!url} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170, paddingVertical: 2 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: moi ? VERT : '#E5E7EB',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {!url ? (
          <ActivityIndicator size="small" color={moi ? '#FFFFFF' : '#111827'} />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={15} color={moi ? '#FFFFFF' : '#111827'} style={status.playing ? undefined : { marginLeft: 1.5 }} />
        )}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 18 }}>
        {BARRES_LECTURE.map((h, i) => {
          const actif = i / BARRES_LECTURE.length <= avancement;
          const couleurInactive = moi ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.15)';
          return (
            <View
              key={i}
              style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: actif ? (moi ? VERT : '#374151') : couleurInactive }}
            />
          );
        })}
      </View>
      <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', minWidth: 30, fontVariant: ['tabular-nums'] }}>
        {formaterDuree(status.playing || position > 0 ? position : duree)}
      </Text>
    </Pressable>
  );
}

function DocumentPieceJointe({
  chemin,
  nom,
  taille,
  estPdf,
}: {
  chemin: string;
  nom: string;
  taille: string | null;
  estPdf: boolean;
}) {
  const [chargement, setChargement] = useState(false);

  async function ouvrir() {
    setChargement(true);
    const url = await urlPieceJointeSignee(chemin);
    setChargement(false);
    if (!url) {
      Alert.alert('Erreur', "Impossible d'ouvrir ce fichier pour le moment.");
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Erreur', "Impossible d'ouvrir ce fichier."));
  }

  return (
    <Pressable onPress={ouvrir} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 175, paddingVertical: 2 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' }}>
        {chargement ? <ActivityIndicator size="small" color="#2563EB" /> : <Ionicons name={estPdf ? 'document-text' : 'document'} size={18} color="#2563EB" />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
          {nom}
        </Text>
        {taille ? <Text style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>{taille}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={16} color="rgba(0,0,0,0.4)" />
    </Pressable>
  );
}
