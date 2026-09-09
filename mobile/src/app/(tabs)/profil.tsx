import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

// Écran Profil minimal. "Informations personnelles" pousse vers le hub
// mon-profil/a-propos.tsx (12a-profil-a-propos.html et sous-écrans —
// Point F de la feuille de route). "Mes CV et documents" et "Paramètres"
// restent des Alert.alert stub : aucun écran de référence construit pour
// eux dans ce point (voir le hub, qui les stub pareillement sous forme
// d'onglets).
const LIBELLES_ROLE: Record<string, string> = {
  admin: 'Administrateur',
  publisher: 'Recruteur',
  user: 'Candidat',
  visitor: 'Visiteur',
};

export default function ProfilScreen() {
  const router = useRouter();
  const { user, profile, role, signOut } = useAuth();
  const initiale = (profile?.full_name || user?.email || 'F').charAt(0).toUpperCase();

  const confirmerDeconnexion = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView contentContainerClassName="px-5 pt-6 pb-10" showsVerticalScrollIndicator={false}>
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center">
              <Text className="text-white text-[26px] font-black">{initiale}</Text>
            </View>
            <Text className="text-[18px] font-black text-[#1A1A1A] mt-3">
              {profile?.full_name || 'Utilisateur Facilité'}
            </Text>
            <Text className="text-[12.5px] text-black/45 mt-0.5">{user?.email}</Text>
            <View className="bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mt-2.5">
              <Text className="text-[11.5px] font-bold text-emerald-700">
                {LIBELLES_ROLE[role] || role}
              </Text>
            </View>
          </View>

          <View className="mt-8 gap-2">
            <LigneMenu
              icone="person-outline"
              label="Informations personnelles"
              onPress={() => router.push('/mon-profil/a-propos')}
            />
            <LigneMenu
              icone="document-text-outline"
              label="Mes CV et documents"
              onPress={() => Alert.alert('Bientôt disponible', 'Cet écran arrive dans une prochaine mise à jour.')}
            />
            <LigneMenu
              icone="settings-outline"
              label="Paramètres"
              onPress={() => Alert.alert('Bientôt disponible', 'Cet écran arrive dans une prochaine mise à jour.')}
            />
          </View>

          <Pressable
            onPress={confirmerDeconnexion}
            className="mt-8 flex-row items-center justify-center gap-2 border border-red-200 bg-red-50 rounded-xl py-3.5">
            <Ionicons name="log-out-outline" size={16} color="#dc2626" />
            <Text className="text-red-600 text-[13.5px] font-bold">Déconnexion</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LigneMenu({
  icone,
  label,
  onPress,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5">
      <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center">
        <Ionicons name={icone} size={16} color="#1A1A1A" />
      </View>
      <Text className="flex-1 text-[13.5px] font-semibold text-[#1A1A1A]">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
    </Pressable>
  );
}
