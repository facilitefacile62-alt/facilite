import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';
import { IconCrayon, IconMessages, IconPoints, IconRecherche } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import { resolveSupportConversation } from '@/lib/messages';
import { useConversationsReelles, type ConversationReelle } from '@/lib/useConversationsReelles';

// Reproduction de design_handoff_facilite/pages/05-messages.html. La ligne
// "Support RH Facilité" est fixe dans le design (pas un élément de
// `conversations`) ; le `sc-for` du handoff correspond à useConversationsReelles.
// Pilules "Toutes" / "Non lues" réellement câblées (is_read côté messages) ;
// "Offres" / "Support" / "Stages" nécessiteraient une catégorisation qui
// n'existe pas encore au niveau conversation — affichées pour la fidélité
// visuelle, elles signalent honnêtement que le filtre arrive plus tard
// plutôt que de le simuler.
type FiltrePuce = 'toutes' | 'non_lues' | 'offres' | 'support' | 'stages';

const PUCES: { id: FiltrePuce; label: string; cablee: boolean }[] = [
  { id: 'toutes', label: 'Toutes', cablee: true },
  { id: 'non_lues', label: 'Non lues', cablee: true },
  { id: 'offres', label: 'Offres', cablee: false },
  { id: 'support', label: 'Support', cablee: false },
  { id: 'stages', label: 'Stages', cablee: false },
];

export default function MessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const conversations = useConversationsReelles(user?.id);
  const [recherche, setRecherche] = useState('');
  const [puceActive, setPuceActive] = useState<FiltrePuce>('toutes');
  const [ouvertureSupportEnCours, setOuvertureSupportEnCours] = useState(false);

  const conversationsFiltrees = useMemo(() => {
    if (!conversations) return null;
    let liste = conversations;
    if (puceActive === 'non_lues') liste = liste.filter((c) => c.nonLue);
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      liste = liste.filter(
        (c) => c.name.toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q)
      );
    }
    return liste;
  }, [conversations, puceActive, recherche]);

  // La ligne "Support RH Facilité" est fixe (pas une vraie conversation) —
  // resolveSupportConversation (déjà utilisée côté web) retrouve ou crée la
  // conversation avec un compte admin avant de naviguer, pour qu'un vrai
  // destinataire existe dès le premier message envoyé.
  async function ouvrirSupport() {
    if (!user?.id || ouvertureSupportEnCours) return;
    setOuvertureSupportEnCours(true);
    try {
      const resolu = await resolveSupportConversation(user.id);
      if (resolu) {
        router.push(`/chat/${resolu.conversationId}`);
      } else {
        Alert.alert('Support RH Facilité', "Impossible d'ouvrir la discussion pour le moment.");
      }
    } finally {
      setOuvertureSupportEnCours(false);
    }
  }

  function ouvrirConversation(conversation: ConversationReelle) {
    router.push(`/chat/${conversation.id}`);
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />

        <View className="flex-row items-center justify-between px-4 pt-4 pb-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[19px] font-extrabold text-[#1A1A1A]">Discussions</Text>
            <View className="bg-emerald-500 rounded-full px-2 py-0.5">
              <Text className="text-white text-[11px] font-bold">
                {conversations ? conversations.length + 1 : 1}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3.5">
            <Pressable onPress={() => Alert.alert('Nouvelle discussion', 'Bientôt disponible.')}>
              <IconCrayon />
            </Pressable>
            <Pressable onPress={() => Alert.alert('Options', 'Bientôt disponible.')}>
              <IconPoints />
            </Pressable>
          </View>
        </View>

        <View className="px-4 pt-3 pb-2.5">
          <View className="flex-row items-center gap-2.5 bg-white border border-black/[0.08] rounded-full px-4 py-2.5">
            <IconRecherche size={16} color="rgba(0,0,0,0.4)" strokeWidth={1.8} />
            <TextInput
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher ou démarrer une discussion..."
              placeholderTextColor="rgba(0,0,0,0.4)"
              className="flex-1 text-[13px] text-[#1A1A1A]"
            />
          </View>
        </View>

        <View className="flex-row gap-2 px-4 pb-3.5">
          {PUCES.map((puce) => (
            <Pressable
              key={puce.id}
              onPress={() =>
                puce.cablee
                  ? setPuceActive(puce.id)
                  : Alert.alert(puce.label, 'Ce filtre arrive dans une prochaine mise à jour.')
              }
              className={`px-4 py-2 rounded-full ${
                puceActive === puce.id ? 'bg-[#1A1A1A]' : 'bg-white border border-black/10'
              }`}>
              <Text
                className={`text-[12.5px] ${puceActive === puce.id ? 'font-bold text-white' : 'font-semibold text-[#1A1A1A]'}`}>
                {puce.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {conversationsFiltrees === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={conversationsFiltrees}
            keyExtractor={(item) => item.id}
            className="border-t border-black/[0.06]"
            ListHeaderComponent={
              puceActive === 'toutes' || puceActive === 'non_lues' ? (
                <Pressable
                  onPress={ouvrirSupport}
                  className="flex-row gap-3 items-center px-4 py-3.5 border-b border-black/[0.06] bg-white">
                  <View className="w-[46px] h-[46px] rounded-full bg-[#e8f8f1] border-[1.5px] border-emerald-500 items-center justify-center">
                    <IconMessages color="#10B981" />
                    <View className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14.5px] font-bold text-[#1A1A1A]">Support RH Facilité 📌</Text>
                    <Text className="text-[12.5px] text-black/45 mt-0.5" numberOfLines={1}>
                      🔗 Disponible 24/7 pour vos CV et démarches
                    </Text>
                  </View>
                  <Text className="text-[11.5px] font-semibold text-emerald-500">Disponible</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <Text className="text-[12.5px] text-black/40 font-medium text-center mt-10">
                Aucune discussion pour l&apos;instant.
              </Text>
            }
            renderItem={({ item }) => <LigneConversation conversation={item} onPress={() => ouvrirConversation(item)} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function LigneConversation({ conversation, onPress }: { conversation: ConversationReelle; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row gap-3 items-center px-4 py-3.5 border-b border-black/[0.06] bg-white">
      <View className="w-[46px] h-[46px] rounded-full bg-emerald-500 items-center justify-center">
        <Text className="text-white font-bold text-[15px]">{conversation.avatarLetter}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14.5px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {conversation.name}
        </Text>
        <Text className="text-[12.5px] text-black/45 mt-0.5" numberOfLines={1}>
          ✅✅ {conversation.lastText}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-[11.5px] text-black/35">{conversation.time}</Text>
        {conversation.nonLue && <View className="w-2 h-2 rounded-full bg-blue-600" />}
      </View>
    </Pressable>
  );
}
