import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import BandeauOnboarding from '@/components/BandeauOnboarding';
import { useAuth } from '@/context/AuthContext';
import { terminerOnboarding } from '@/lib/onboarding';

// Onboarding 24 — « Un dernier détail » : « Ajouter un document » ouvre le
// vrai scan de document (mon-profil/scanner-document.tsx — photo, galerie ou
// fichier, analysé puis pré-remplit le profil). Illustration
// onboarding-cv-v2.jpg centrée à 32 %.
export default function OnboardingDocumentScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  async function passer() {
    if (user?.id) await terminerOnboarding(user.id);
    await refreshProfile();
    router.replace('/');
  }

  return (
    <BandeauOnboarding image={require('../../../assets/images/onboarding/onboarding-cv-v2.jpg')} centrage={32} retour>
      <Text className="text-[24px] font-bold text-[#111] text-center">Un dernier détail</Text>
      <Text className="text-[14.5px] text-center mt-2 mb-5" style={{ color: 'rgba(0,0,0,0.5)' }}>
        Importez un document pour compléter votre profil automatiquement.
      </Text>
      <Pressable
        onPress={() => router.push('/mon-profil/scanner-document?onboarding=1' as Href)}
        className="flex-row items-center justify-center gap-2 rounded-[18px] bg-white"
        style={{ height: 52, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }}>
        <Ionicons name="add" size={18} color="#111" />
        <Text className="text-[15px] font-black text-[#111]">Ajouter un document</Text>
      </Pressable>
      <Text className="text-[12px] text-center mt-3" style={{ color: 'rgba(0,0,0,0.5)' }}>CV, lettre de motivation, diplôme… (PDF)</Text>
      <Pressable onPress={passer} className="items-center py-4" hitSlop={8}>
        <Text className="text-[14px] font-black text-[#111]">Passer cette étape ›</Text>
      </Pressable>
    </BandeauOnboarding>
  );
}
