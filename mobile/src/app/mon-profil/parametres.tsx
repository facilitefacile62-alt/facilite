import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteModifierInfos from '@/components/EnteteModifierInfos';

// « Modifier infos » > Paramètres — maquette 41 : le titre « Paramètres », sa
// phrase d'explication et la carte « Apparence / Thème ». Rien d'autre.
//
// Les listes de liens vers les pages du compte (sécurité, facturation, CV,
// candidatures, outils, informations légales…) qui s'y trouvaient ne figurent
// pas sur la maquette : elles ont été retirées le 12/10/2026 à la demande du
// propriétaire, qui indiquera ce qui doit être remis dans l'application. Elles
// restent dans l'historique git (commit précédant ce retrait).
export default function ParametresScreen() {
  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif="parametres" />

        <ScrollView contentContainerClassName="px-4 pt-5 pb-10 gap-5" showsVerticalScrollIndicator={false}>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[22px] font-black text-[#1A1A1A]">Paramètres</Text>
              <Ionicons name="chevron-down" size={15} color="#1A1A1A" />
            </View>
            <Text className="text-[14px] mt-1.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Personnalisez votre expérience visuelle et vos préférences.
            </Text>
          </View>

          <View className="bg-white" style={{ borderRadius: 18, padding: 16 }}>
            <Text className="text-[12px] font-extrabold" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>APPARENCE</Text>
            <View className="flex-row items-center gap-3 mt-3">
              <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#F0EEE8' }}>
                <Ionicons name="contrast-outline" size={20} color="#1A1A1A" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-black text-[#1A1A1A]">Thème</Text>
                <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Apparence de Facilité</Text>
              </View>
              {/* Seul le thème clair existe dans l'app (aucun écran du design n'a de mode sombre) :
                  Auto et Sombre annoncent honnêtement qu'ils arrivent plus tard. */}
              <View className="flex-row items-center" style={{ backgroundColor: '#F0EEE8', borderRadius: 22, padding: 4, gap: 2 }}>
                <View className="items-center justify-center bg-white" accessibilityLabel="Thème clair, actif" style={{ width: 38, height: 38, borderRadius: 19 }}>
                  <Ionicons name="sunny-outline" size={18} color="#1A1A1A" />
                </View>
                <Pressable
                  onPress={() => Alert.alert('Thème automatique', 'Disponible avec le mode sombre, dans une prochaine mise à jour.')}
                  accessibilityLabel="Thème automatique"
                  className="items-center justify-center"
                  style={{ width: 38, height: 38, borderRadius: 19 }}>
                  <Ionicons name="settings-outline" size={17} color="rgba(0,0,0,0.5)" />
                </Pressable>
                <Pressable
                  onPress={() => Alert.alert('Thème sombre', 'Le mode sombre arrive dans une prochaine mise à jour.')}
                  accessibilityLabel="Thème sombre"
                  className="items-center justify-center"
                  style={{ width: 38, height: 38, borderRadius: 19 }}>
                  <Ionicons name="moon-outline" size={17} color="rgba(0,0,0,0.5)" />
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
