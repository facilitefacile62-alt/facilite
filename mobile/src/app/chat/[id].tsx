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
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
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

import { useAuth } from '@/context/AuthContext';
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
  } = useLocalSearchParams<{ id: string; contexte?: string; nom?: string; brouillon?: string }>();
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
  const [brouillon, setBrouillon] = useState(typeof brouillonParam === 'string' ? brouillonParam : '');
  const listeRef = useRef<FlatList<ChatMessage>>(null);
  // Clavier ouvert : il recouvre déjà la barre système, inutile de garder sa marge sous la zone d'envoi.
  const [clavierOuvert, setClavierOuvert] = useState(false);
  const [menuJointOuvert, setMenuJointOuvert] = useState(false);
  const [emojiOuvert, setEmojiOuvert] = useState(false);
  const [envoiFichierEnCours, setEnvoiFichierEnCours] = useState(false);

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
    <ImageBackground
      source={require('../../../assets/images/facilite-pattern-background.png')}
      resizeMode="repeat"
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {/* En-tête */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 10,
              backgroundColor: '#FFFFFF',
              borderBottomWidth: 1,
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
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: VERT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>
                {nomAffiche ? nomAffiche.charAt(0).toUpperCase() : '·'}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1A1A' }} numberOfLines={1}>
                {nomAffiche ?? 'Discussion'}
              </Text>
              <Text style={{ fontSize: 11.5, color: '#059669' }} numberOfLines={1}>
                {marketplace ? 'Boutique' : autreParticipant?.estAdmin ? 'en ligne · Facilité' : 'Facilité'}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            {/* Fil : s'ouvre sur le dernier message, et suit les nouveaux */}
            {messages === null ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#2563EB" />
              </View>
            ) : (
              <FlatList
                ref={listeRef}
                data={messages}
                keyExtractor={(m) => m.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 12, gap: 6, flexGrow: 1, justifyContent: 'flex-end' }}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => <BulleMessage message={item} />}
                ListEmptyComponent={
                  <Text style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.4)', fontWeight: '500', textAlign: 'center', marginBottom: 24 }}>
                    Aucun message pour l&apos;instant — dites bonjour 👋
                  </Text>
                }
              />
            )}

            {/* Menu pièce jointe : Prendre une photo / Galerie / Document (comme WhatsApp) */}
            {menuJointOuvert && (
              <Pressable
                onPress={() => setMenuJointOuvert(false)}
                style={{ position: 'absolute', inset: 0 }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 8,
                    bottom: 68,
                    width: 220,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 18,
                    padding: 6,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                  }}>
                  <OptionJointe icone="camera-outline" couleur="#0d3b34" fond="#d7f2ea" label="Prendre une photo" onPress={prendrePhoto} />
                  <OptionJointe icone="images-outline" couleur="#b45309" fond="#fdf1d9" label="Galerie" onPress={choisirDansGalerie} />
                  <OptionJointe icone="document-outline" couleur="#2563EB" fond="#dbe8fc" label="Document" onPress={choisirDocument} />
                </View>
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
    </ImageBackground>
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
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: fond, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icone} size={18} color={couleur} />
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: '#1A1A1A' }}>{label}</Text>
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
      setModeEnregistrement(true);
    } catch {
      Alert.alert('Micro', "Impossible de démarrer l'enregistrement pour le moment.");
    }
  }

  async function annulerEnregistrement() {
    setModeEnregistrement(false);
    try {
      await recorder.stop();
    } catch {
      // rien à envoyer, l'annulation reste silencieuse même si l'arrêt natif échoue
    }
  }

  async function envoyerEnregistrement() {
    setModeEnregistrement(false);
    try {
      await recorder.stop();
    } catch {
      Alert.alert('Erreur', "Échec de l'enregistrement. Réessayez.");
      return;
    }
    const uri = recorder.uri;
    if (!uri || !userId) return;
    await onEnvoyerFichier(uri, `note_vocale_${Date.now()}.m4a`, 'audio/m4a', undefined, 'audio');
  }

  if (modeEnregistrement) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: clavierOuvert ? 8 : paddingBas,
          backgroundColor: 'rgba(242,240,234,0.96)',
        }}>
        <Pressable onPress={annulerEnregistrement} accessibilityLabel="Annuler la note vocale" hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
        </Pressable>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A', fontVariant: ['tabular-nums'] }}>
          {formaterDuree((etatEnregistreur.durationMillis || 0) / 1000)}
        </Text>
        <Text style={{ flex: 1, fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Enregistrement de la note vocale…</Text>
        <Pressable
          onPress={envoyerEnregistrement}
          accessibilityLabel="Envoyer la note vocale"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: VERT, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
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

function BulleMessage({ message }: { message: ChatMessage }) {
  const moi = message.sender === 'me';
  const aUnePieceJointe = !!message.attachmentUrl && !!message.attachmentType;

  return (
    <View style={{ flexDirection: 'row', justifyContent: moi ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '80%',
          padding: aUnePieceJointe && message.attachmentType === 'image' ? 4 : undefined,
          paddingHorizontal: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 11,
          paddingTop: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 7,
          paddingBottom: aUnePieceJointe && message.attachmentType === 'image' ? undefined : 5,
          borderRadius: 14,
          borderTopRightRadius: moi ? 4 : 14,
          borderTopLeftRadius: moi ? 14 : 4,
          backgroundColor: moi ? '#D7F5E4' : '#FFFFFF',
          borderWidth: 1,
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
          <Text style={{ fontSize: 15, lineHeight: 21, color: '#111827' }}>{message.text}</Text>
        ) : null}
        <Text
          style={{
            fontSize: 10.5,
            color: 'rgba(0,0,0,0.45)',
            alignSelf: 'flex-end',
            marginTop: aUnePieceJointe && message.attachmentType === 'image' ? 0 : 2,
            marginRight: aUnePieceJointe && message.attachmentType === 'image' ? 6 : 0,
            marginBottom: aUnePieceJointe && message.attachmentType === 'image' ? 4 : 0,
          }}>
          {message.time}
        </Text>
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
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <View style={{ width: `${avancement * 100}%`, height: '100%', backgroundColor: moi ? VERT : '#6B7280' }} />
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
