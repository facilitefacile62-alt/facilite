import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { IconPoints } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import { useChatThread } from '@/lib/useChatThread';
import type { ChatMessage } from '@/lib/messages';

// Reproduction de design_handoff_facilite/pages/06-chat-detail.html — seul
// écran clair (bg #F2F0EA) de ce point, contrairement à offre/[id].tsx.
// Dictée vocale : minuteur + barres d'onde réels côté UI (setInterval,
// hauteurs aléatoires), mais aucune transcription/IA branchée — le bouton
// d'envoi de l'enregistrement n'envoie pour l'instant aucun message, il
// annule juste l'enregistrement (honnête plutôt que de simuler une
// fonctionnalité absente). "Réponses de l'IA" → modale de confirmation
// UI uniquement, pas de logique de pause réellement persistée (pas de
// colonne dédiée trouvée sur `conversations`).
const NB_BARRES = 20;

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { messages, autreParticipant, envoyer, envoiEnCours } = useChatThread(id, user?.id);

  const [favori, setFavori] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [actionsRapidesOuvertes, setActionsRapidesOuvertes] = useState(false);
  const [modaleIaOuverte, setModaleIaOuverte] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [dureeEnregistrement, setDureeEnregistrement] = useState(0);
  const [brouillon, setBrouillon] = useState('');
  const [barresOnde, setBarresOnde] = useState<number[]>(() => Array.from({ length: NB_BARRES }, () => 6));
  const minuteurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enregistrement) {
      if (minuteurRef.current) clearInterval(minuteurRef.current);
      minuteurRef.current = null;
      // setState différé : corps de l'effet, pas un callback d'un système
      // externe — exigé par la règle react-hooks correspondante.
      queueMicrotask(() => setDureeEnregistrement(0));
      return;
    }
    minuteurRef.current = setInterval(() => {
      setDureeEnregistrement((d) => d + 1);
      setBarresOnde(Array.from({ length: NB_BARRES }, () => 4 + Math.round(Math.random() * 16)));
    }, 1000);
    return () => {
      if (minuteurRef.current) clearInterval(minuteurRef.current);
    };
  }, [enregistrement]);

  function formaterDuree(s: number) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  async function handleEnvoyer() {
    const texte = brouillon;
    setBrouillon('');
    await envoyer(texte);
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-3.5 py-3 border-b border-black/[0.06] bg-white">
          <Pressable onPress={() => router.back()} className="w-[30px] h-[30px] items-center justify-center">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View className="w-[34px] h-[34px] rounded-full bg-emerald-500 items-center justify-center">
            <Text className="text-white font-bold text-[13px]">
              {autreParticipant ? autreParticipant.nom.charAt(0).toUpperCase() : '·'}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={1}>
              {autreParticipant?.nom ?? 'Discussion'}
            </Text>
            <Text className="text-[11px] text-emerald-500">
              {autreParticipant?.estAdmin ? 'en ligne · Facilité' : 'Facilité'}
            </Text>
          </View>
          <Pressable onPress={() => setFavori((f) => !f)}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill={favori ? '#DC2626' : 'none'}>
              <Path
                d="M12 20L4.5 12.7C2.2 10.4 2.5 6.6 5.2 5C7.1 3.9 9.5 4.3 11 6L12 7L13 6C14.5 4.3 16.9 3.9 18.8 5C21.5 6.6 21.8 10.4 19.5 12.7L12 20Z"
                stroke="#DC2626"
                strokeWidth={1.6}
              />
            </Svg>
          </Pressable>
          <Pressable onPress={() => setMenuOuvert((m) => !m)}>
            <IconPoints size={17} color="#1A1A1A" />
          </Pressable>
        </View>

        {menuOuvert && (
          <View className="absolute top-[52px] right-3.5 bg-white rounded-2xl shadow-lg p-1.5 z-10 w-[190px]">
            <Pressable
              onPress={() => {
                setMenuOuvert(false);
                setModaleIaOuverte(true);
              }}
              className="px-3 py-2.5 rounded-lg">
              <Text className="text-[13px] font-semibold text-[#1A1A1A]">Réponses de l&apos;IA</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOuvert(false);
                Alert.alert('Infos sur la discussion', 'Cet écran arrive dans une prochaine mise à jour.');
              }}
              className="px-3 py-2.5 rounded-lg flex-row items-center gap-1.5">
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={9} stroke="#2563EB" strokeWidth={1.6} />
                <Line x1={12} y1={11} x2={12} y2={16} stroke="#2563EB" strokeWidth={1.6} strokeLinecap="round" />
                <Circle cx={12} cy={8} r={1} fill="#2563EB" />
              </Svg>
              <Text className="text-[13px] font-semibold text-[#1A1A1A]">Infos sur la discussion</Text>
            </Pressable>
          </View>
        )}

        {messages === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerClassName="px-3.5 py-4 gap-2.5"
            renderItem={({ item }) => <BulleMessage message={item} />}
            ListEmptyComponent={
              <Text className="text-[12.5px] text-black/40 font-medium text-center mt-10">
                Aucun message pour l&apos;instant — dites bonjour 👋
              </Text>
            }
          />
        )}

        {actionsRapidesOuvertes && (
          <View className="absolute left-3.5 bottom-16 bg-[#1a1a1a] rounded-2xl p-2 w-[230px] shadow-lg z-10">
            <Text className="text-[10px] font-bold tracking-wider text-white/50 px-2 py-1.5">
              ACTIONS RAPIDES IA
            </Text>
            {[
              { couleur: '#10B981', label: 'Tarifs & Modèles CV Facilité' },
              { couleur: '#2563EB', label: 'Conseils Recrutement Sénégal' },
              { couleur: '#DC2626', label: 'Carte des Opportunités & Itinéraires' },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  setActionsRapidesOuvertes(false);
                  Alert.alert(action.label, 'Cette fonctionnalité arrive dans une prochaine mise à jour.');
                }}
                className="flex-row items-center gap-2.5 px-2 py-2">
                <View className="w-[26px] h-[26px] rounded-lg" style={{ backgroundColor: action.couleur }} />
                <Text className="text-[12.5px] font-semibold text-white flex-1">{action.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {enregistrement ? (
          <View className="flex-row gap-2.5 items-center px-3.5 pt-2.5 pb-4 border-t border-black/[0.06] bg-white">
            <Pressable onPress={() => setEnregistrement(false)}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 7H19M9 7V4H15V7M8 7L9 20H15L16 7"
                  stroke="#DC2626"
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            <View className="w-2 h-2 rounded-full bg-[#DC2626]" />
            <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">{formaterDuree(dureeEnregistrement)}</Text>
            <View className="flex-1 flex-row items-center gap-0.5 overflow-hidden">
              {barresOnde.map((h, i) => (
                <View key={i} className="w-[2.5px] rounded-sm bg-black/25" style={{ height: h }} />
              ))}
            </View>
            <Pressable
              onPress={() => setEnregistrement(false)}
              className="w-[34px] h-[34px] rounded-full bg-amber-500 items-center justify-center">
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="#fff">
                <Rect x={5} y={4} width={4} height={16} rx={1} />
                <Rect x={15} y={4} width={4} height={16} rx={1} />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => setEnregistrement(false)}
              className="w-[34px] h-[34px] rounded-full bg-[#1A1A1A] items-center justify-center">
              <Svg width={15} height={15} viewBox="0 0 24 24">
                <Path d="M3 11L21 3L13 21L11 13L3 11Z" fill="#fff" />
              </Svg>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-2 items-center px-3.5 pt-2.5 pb-4 border-t border-black/[0.06] bg-white">
            <Pressable
              onPress={() => setActionsRapidesOuvertes((v) => !v)}
              className="w-[30px] h-[30px] rounded-full bg-[#F2F0EA] items-center justify-center">
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Line x1={12} y1={5} x2={12} y2={19} stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
                <Line x1={5} y1={12} x2={19} y2={12} stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <TextInput
              value={brouillon}
              onChangeText={setBrouillon}
              placeholder="Posez une question, demandez un conseil CV ou orientation..."
              placeholderTextColor="rgba(0,0,0,0.4)"
              className="flex-1 bg-[#F2F0EA] rounded-full px-3.5 py-2.5 text-[13px] text-[#1A1A1A]"
            />
            <Pressable
              onPress={() => setEnregistrement(true)}
              className="w-[30px] h-[30px] rounded-full items-center justify-center">
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={9} y={3} width={6} height={11} rx={3} stroke="#1A1A1A" strokeWidth={1.7} />
                <Path d="M6 11V12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12V11" stroke="#1A1A1A" strokeWidth={1.7} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={handleEnvoyer}
              disabled={envoiEnCours || !brouillon.trim()}
              className="w-[34px] h-[34px] rounded-full bg-[#1A1A1A] items-center justify-center disabled:opacity-40">
              <Svg width={15} height={15} viewBox="0 0 24 24">
                <Path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        )}

        {modaleIaOuverte && (
          <View className="absolute inset-0 bg-black/45 items-center justify-center px-6">
            <View className="bg-white rounded-2xl p-5.5 w-full">
              <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Réponses de l&apos;IA</Text>
              <Text className="text-[13px] leading-5 text-black/60 mt-2.5">
                L&apos;IA répondra automatiquement aux messages de cette discussion. Vous recevrez une
                notification de message non lu si l&apos;IA ne sait pas comment répondre.
              </Text>
              <View className="flex-row justify-end items-center gap-4.5 mt-5">
                <Pressable onPress={() => setModaleIaOuverte(false)}>
                  <Text className="text-[13.5px] font-bold text-emerald-500">Annuler</Text>
                </Pressable>
                <Pressable onPress={() => setModaleIaOuverte(false)} className="bg-orange-600 px-4.5 py-2.5 rounded-full">
                  <Text className="text-[13.5px] font-bold text-white">Mettre en pause</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function BulleMessage({ message }: { message: ChatMessage }) {
  const moi = message.sender === 'me';
  return (
    <View className={`flex-row ${moi ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl ${
          moi ? 'bg-[#1A1A1A] rounded-br-md' : 'bg-white border border-black/[0.06] rounded-bl-md'
        }`}>
        <Text className={`text-[13.5px] leading-5 ${moi ? 'text-white' : 'text-[#1A1A1A]'}`}>{message.text}</Text>
      </View>
    </View>
  );
}
