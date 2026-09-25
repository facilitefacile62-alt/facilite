import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useChatThread } from '@/lib/useChatThread';
import type { ChatMessage } from '@/lib/messages';

// Discussion façon WhatsApp : en-tête simple, fil qui s'ouvre sur le DERNIER message, zone de saisie arrondie et bouton
// d'envoi rond TOUJOURS visible en bas (au-dessus de la barre système, y compris la barre des tablettes) et poussé par le
// clavier. Seules les commandes qui fonctionnent sont affichées : la dictée vocale simulée, les « actions rapides IA » et
// les menus vides de la maquette ont été retirés (ils n'envoyaient rien).
const VERT = '#10B981';

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
  const { messages, autreParticipant, envoyer, envoiEnCours } = useChatThread(
    id,
    user?.id,
    marketplace ? 'MARKETPLACE' : undefined
  );
  const nomAffiche = marketplace && nomParam ? nomParam : autreParticipant?.nom;
  const [brouillon, setBrouillon] = useState(typeof brouillonParam === 'string' ? brouillonParam : '');
  const listeRef = useRef<FlatList<ChatMessage>>(null);
  // Clavier ouvert : il recouvre déjà la barre système, inutile de garder sa marge sous la zone d'envoi.
  const [clavierOuvert, setClavierOuvert] = useState(false);
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

          {/* Zone de saisie : toujours au-dessus de la barre système */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 8,
              paddingTop: 8,
              paddingBottom: clavierOuvert ? 8 : Math.max(insets.bottom, 8) + 4,
              backgroundColor: 'rgba(242,240,234,0.96)',
            }}>
            <View
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                paddingHorizontal: 16,
                minHeight: 48,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
              }}>
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
                style={{ maxHeight: 130, paddingVertical: 12, fontSize: 16, color: '#1A1A1A' }}
              />
            </View>
            <Pressable
              onPress={handleEnvoyer}
              accessibilityLabel="Envoyer le message"
              disabled={!peutEnvoyer}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: peutEnvoyer ? VERT : '#B6BCC4',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {envoiEnCours ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function BulleMessage({ message }: { message: ChatMessage }) {
  const moi = message.sender === 'me';
  return (
    <View style={{ flexDirection: 'row', justifyContent: moi ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '80%',
          paddingHorizontal: 11,
          paddingTop: 7,
          paddingBottom: 5,
          borderRadius: 14,
          borderTopRightRadius: moi ? 4 : 14,
          borderTopLeftRadius: moi ? 14 : 4,
          backgroundColor: moi ? '#D7F5E4' : '#FFFFFF',
          borderWidth: 1,
          borderColor: moi ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.06)',
        }}>
        <Text style={{ fontSize: 15, lineHeight: 21, color: '#111827' }}>{message.text}</Text>
        <Text style={{ fontSize: 10.5, color: 'rgba(0,0,0,0.45)', alignSelf: 'flex-end', marginTop: 2 }}>{message.time}</Text>
      </View>
    </View>
  );
}
