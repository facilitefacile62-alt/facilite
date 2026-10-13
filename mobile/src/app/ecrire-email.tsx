import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';
import { useAuth } from '@/context/AuthContext';
import { choisirFichierCv, type FichierLocal } from '@/lib/candidature';
import { MAX_PIECES, envoyerEmail } from '@/lib/envoiEmail';

// « Nouveau message » — écran d'écriture d'e-mail à la manière de Gmail, ouvert
// par le bouton flottant : De (votre adresse), À, Objet, message, pièces jointes,
// et bouton d'envoi en haut à droite. L'envoi passe par Facilité (route
// /api/envoyer-email) : le destinataire voit « <Votre nom> via Facilité » et sa
// réponse arrive sur VOTRE adresse. 10 e-mails par 24 h au maximum.
const VERT = '#10B981';
const REGEX_EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export default function EcrireEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [a, setA] = useState('');
  const [objet, setObjet] = useState('');
  const [message, setMessage] = useState('');
  const [pieces, setPieces] = useState<FichierLocal[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const adresseValide = REGEX_EMAIL.test(a.trim());
  const pret = adresseValide && objet.trim().length > 0 && (message.trim().length > 0 || pieces.length > 0);

  async function ajouterPiece() {
    if (pieces.length >= MAX_PIECES) {
      Alert.alert('Pièces jointes', `${MAX_PIECES} pièces jointes au maximum.`);
      return;
    }
    try {
      const f = await choisirFichierCv();
      if (f) setPieces((l) => [...l, f]);
    } catch (e) {
      Alert.alert('Fichier refusé', e instanceof Error ? e.message : 'Ce fichier ne peut pas être ajouté.');
    }
  }

  async function envoyer() {
    if (!pret || envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      await envoyerEmail({ to: a, subject: objet, message, pieces });
      Alert.alert('Message envoyé', `Votre e-mail est parti vers ${a.trim()}.`, [{ text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'e-mail n'a pas pu être envoyé.");
    } finally {
      setEnvoi(false);
    }
  }

  const ligne = { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' } as const;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        {/* Barre de l'écran : retour · Nouveau message · envoyer */}
        <View className="flex-row items-center px-3 py-2 gap-1 bg-white" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Retour" className="items-center justify-center" style={{ width: 44, height: 44 }}>
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </Pressable>
          <Text className="flex-1 text-[18px] font-black text-[#1A1A1A]">Nouveau message</Text>
          <Pressable onPress={ajouterPiece} accessibilityLabel="Ajouter une pièce jointe" className="items-center justify-center" style={{ width: 44, height: 44 }}>
            <Ionicons name="attach" size={24} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={envoyer}
            disabled={!pret || envoi}
            accessibilityLabel="Envoyer"
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: pret ? VERT : '#BDEFD9' }}>
            {envoi ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={19} color="#fff" />}
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            <View className="flex-row items-center px-4" style={{ ...ligne, minHeight: 52 }}>
              <Text className="w-14 text-[14px]" style={{ color: 'rgba(0,0,0,0.5)' }}>De</Text>
              <Text className="flex-1 text-[15px] text-[#1A1A1A]" numberOfLines={1}>{user?.email ?? 'votre adresse'}</Text>
            </View>
            <View className="flex-row items-center px-4" style={{ ...ligne, minHeight: 52 }}>
              <Text className="w-14 text-[14px]" style={{ color: 'rgba(0,0,0,0.5)' }}>À</Text>
              <TextInput
                value={a}
                onChangeText={(t) => {
                  setA(t);
                  if (erreur) setErreur('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="adresse@exemple.com"
                placeholderTextColor="rgba(0,0,0,0.3)"
                accessibilityLabel="Destinataire"
                className="flex-1 text-[15px] text-[#1A1A1A]"
                style={{ paddingVertical: 12, outlineStyle: 'none' } as object}
              />
              {a.trim().length > 0 ? (
                <Ionicons name={adresseValide ? 'checkmark-circle' : 'alert-circle'} size={18} color={adresseValide ? VERT : '#DC2626'} />
              ) : null}
            </View>
            <View className="flex-row items-center px-4" style={{ ...ligne, minHeight: 52 }}>
              <Text className="w-14 text-[14px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Objet</Text>
              <TextInput
                value={objet}
                onChangeText={setObjet}
                maxLength={150}
                placeholder="Objet"
                placeholderTextColor="rgba(0,0,0,0.3)"
                accessibilityLabel="Objet"
                className="flex-1 text-[15px] text-[#1A1A1A]"
                style={{ paddingVertical: 12, outlineStyle: 'none' } as object}
              />
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              placeholder="Rédigez votre message"
              placeholderTextColor="rgba(0,0,0,0.3)"
              accessibilityLabel="Message"
              className="px-4 text-[15px] text-[#1A1A1A]"
              style={{ minHeight: 220, paddingTop: 14, outlineStyle: 'none' } as object}
            />

            {pieces.length > 0 ? (
              <View className="px-4 gap-2 mt-2">
                {pieces.map((f, i) => (
                  <View key={`${f.uri}-${i}`} className="flex-row items-center gap-2.5 rounded-[12px] px-3 py-3" style={{ backgroundColor: '#F3F4F6' }}>
                    <Ionicons name="document-attach-outline" size={18} color="#4B5563" />
                    <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]" numberOfLines={1}>{f.nom}</Text>
                    <Pressable onPress={() => setPieces((l) => l.filter((_, j) => j !== i))} accessibilityLabel="Retirer la pièce jointe" hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color="rgba(0,0,0,0.4)" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {erreur ? (
              <View className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <Text className="text-[12.5px] font-bold text-red-600">{erreur}</Text>
              </View>
            ) : null}

            <Text className="px-4 mt-4 text-[11.5px]" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Le destinataire verra « votre nom via Facilité » et sa réponse arrivera sur votre adresse. 10 e-mails par 24 heures au maximum.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
