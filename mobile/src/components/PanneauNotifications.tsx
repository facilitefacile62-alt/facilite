import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { IconPoints } from '@/components/facilite-icons';

// Reproduction de design_handoff_facilite/pages/13-notifications.html. Le
// fichier source du handoff est tronqué (plusieurs balises jamais
// refermées) mais le contenu visible ne laisse pas d'ambiguïté sur la mise
// en page. Aucune table Supabase `notifications` dédiée n'existe encore
// (ni côté web) — cette liste est volontairement statique/d'exemple en
// attendant un vrai système de notifications, plutôt que d'inventer une
// fausse source de données dynamique.
type Notification = { id: string; badgeColor: string; text: string; time: string };

const NOTIFICATIONS_EXEMPLE: Notification[] = [
  { id: '1', badgeColor: '#2563EB', text: 'Votre candidature a été vue par le recruteur.', time: 'Il y a 2 h' },
  { id: '2', badgeColor: '#10B981', text: 'Une nouvelle offre correspond à votre profil.', time: 'Il y a 5 h' },
  { id: '3', badgeColor: '#F59E0B', text: 'Pensez à compléter votre CV pour plus de visibilité.', time: 'Hier' },
  { id: '4', badgeColor: '#DC2626', text: "L'offre que vous avez sauvegardée expire bientôt.", time: 'Hier' },
  { id: '5', badgeColor: '#2563EB', text: 'Le Support RH Facilité vous a répondu.', time: 'Il y a 2 j' },
];

export default function PanneauNotifications({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable onPress={onFermer} className="flex-1 bg-black/40 items-center pt-10 px-6">
        <Pressable onPress={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-h-[78%] overflow-hidden">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2.5">
            <Text className="text-[18px] font-extrabold text-[#1A1A1A]">Notifications</Text>
            <IconPoints size={16} color="#1A1A1A" />
          </View>

          <View className="flex-row gap-5 px-4 pb-2.5 border-b border-black/[0.06]">
            <View className="bg-[#e6f0fd] px-3.5 py-1.5 rounded-full">
              <Text className="text-[13px] font-bold text-blue-600">Tout</Text>
            </View>
            <View className="py-1.5">
              <Text className="text-[13px] font-semibold text-black/50">Non lu (28)</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
            <Text className="text-[13px] font-bold text-[#1A1A1A]">Nouveau</Text>
            <Text className="text-[12.5px] font-semibold text-blue-600">Voir tout</Text>
          </View>

          <ScrollView className="px-2 pb-2.5">
            {NOTIFICATIONS_EXEMPLE.map((n) => (
              <View key={n.id} className="flex-row gap-2.5 items-start px-2 py-2.5 rounded-xl">
                <View className="w-[34px] h-[34px] rounded-full border-[1.5px] border-black/50 items-center justify-center relative">
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={8} r={3.5} stroke="#1A1A1A" strokeWidth={1.8} />
                    <Path d="M4.5 20C5.5 15.8 8.4 14 12 14C15.6 14 18.5 15.8 19.5 20" stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                  <View
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: n.badgeColor }}
                  />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[12.5px] leading-[17px] text-[#1A1A1A] font-bold">{n.text}</Text>
                  <Text className="text-[11px] text-blue-600 mt-0.5">{n.time}</Text>
                </View>
                <View className="w-[7px] h-[7px] rounded-full bg-blue-600 mt-1" />
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
