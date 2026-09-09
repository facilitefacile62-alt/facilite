import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

// Reproduction de design_handoff_facilite/pages/12a-profil-a-propos.html —
// le hub "À propos" du profil, poussé depuis la ligne "Informations
// personnelles" de (tabs)/profil.tsx (jusqu'ici un Alert.alert stub).
// Dossier `mon-profil/` (pas `profil/`) : évite toute ambiguïté avec
// (tabs)/profil.tsx qui possède déjà la route `/profil`, même précaution
// que offre/[id].tsx vis-à-vis de (tabs)/offres.tsx.
//
// Les onglets "Mes documents" / "Paramètres" et le bouton "Scanner
// Document" n'ont pas d'écran/service réel derrière eux (aucune fonction
// de scan CV/CNI/Passeport dans ce dépôt, l'Extracteur ne fait que
// l'OCR d'annonces) : alerte honnête, comme "Mes CV et documents" /
// "Paramètres" déjà stub dans (tabs)/profil.tsx. Seule "À propos" (les 3
// rubriques ci-dessous) a un vrai contenu à ce point de la feuille de
// route.
const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

const RUBRIQUES = [
  { id: 'infos-perso', icone: '🪪', label: 'Informations personnelles', route: '/mon-profil/infos-perso' as const },
  { id: 'langues', icone: '🌐', label: 'Langues', route: '/mon-profil/langues' as const },
  { id: 'experiences', icone: '💼', label: 'Expériences professionnelles', route: '/mon-profil/experiences' as const },
];

export default function ProfilAProposScreen() {
  const router = useRouter();
  const { user, profile, role } = useAuth();

  const nomComplet = (profile?.full_name as string | undefined) || 'Utilisateur Facilité';
  const initiale = nomComplet.charAt(0).toUpperCase() || (user?.email || 'F').charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url as string | undefined;
  const headline = (profile?.headline as string | undefined) || '';
  const ville = (profile?.city as string | undefined) || (profile?.location as string | undefined) || '';
  const estVerifie = profile?.recruiter_verified === true;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="relative">
            <View className="h-[130px] bg-[#161b2e] items-center justify-center overflow-hidden">
              <Text className="text-[52px] font-extrabold text-white/[0.12] tracking-widest">CV</Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white items-center justify-center">
              <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
            </Pressable>
            <Pressable
              onPress={() => BIENTOT('Photo de couverture')}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white items-center justify-center">
              <Ionicons name="camera-outline" size={16} color="#1A1A1A" />
            </Pressable>
            <View className="absolute -bottom-8 left-5 w-16 h-16 rounded-full bg-[#0B0D10] border-[3px] border-white overflow-hidden items-center justify-center">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} alt={nomComplet} contentFit="cover" className="w-full h-full" />
              ) : (
                <Text className="text-white text-[22px] font-black">{initiale}</Text>
              )}
            </View>
          </View>

          <View className="px-5 pt-11">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[20px] font-extrabold text-[#1A1A1A]">{nomComplet}</Text>
              {role === 'admin' && <Badge bg="#fee2e2" color="#DC2626" texte="🛡 Administrateur" />}
              {role === 'publisher' && <Badge bg="#dbe8fc" color="#2563EB" texte="💼 Recruteur" />}
              {estVerifie && <Badge bg="#d7f2ea" color="#10B981" texte="✔ Profil Vérifié" />}
            </View>
            {headline ? <Text className="text-[13px] text-[#2563EB] font-semibold mt-1.5">{headline}</Text> : null}
            {(headline || ville) && (
              <View className="flex-row flex-wrap gap-2 mt-3">
                {headline ? <Chip texte={`💼 ${headline}`} /> : null}
                {ville ? <Chip texte={`📍 ${ville}`} /> : null}
              </View>
            )}
          </View>

          <View className="flex-row gap-5 px-5 pt-5 border-b border-black/[0.08] mt-3.5">
            <Text className="text-[14px] font-bold text-[#2563EB] pb-2.5 border-b-2 border-[#2563EB]">À propos</Text>
            <Pressable onPress={() => BIENTOT('Mes documents')}>
              <Text className="text-[14px] font-semibold text-black/50 pb-2.5">Mes documents</Text>
            </Pressable>
            <Pressable onPress={() => BIENTOT('Paramètres')}>
              <Text className="text-[14px] font-semibold text-black/50 pb-2.5">Paramètres</Text>
            </Pressable>
          </View>

          <View className="px-5 pt-4 pb-1">
            <Pressable
              onPress={() => BIENTOT('Scanner Document')}
              className="bg-emerald-500 rounded-full py-2.5 items-center flex-row justify-center gap-2">
              <Text className="text-white text-[12.5px] font-bold">⛶ Scanner Document (CV, CNI, Passeport)</Text>
            </Pressable>
          </View>

          <View className="mx-5 mt-4 mb-6 bg-white rounded-2xl overflow-hidden">
            {RUBRIQUES.map((r, i) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(r.route)}
                className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-black/[0.05]' : ''}`}>
                <View className="w-9 h-9 rounded-[10px] bg-[#eef1fb] items-center justify-center">
                  <Text className="text-[16px]">{r.icone}</Text>
                </View>
                <Text className="flex-1 text-[13.5px] font-bold text-[#2563EB]">{r.label}</Text>
                <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Badge({ texte, bg, color }: { texte: string; bg: string; color: string }) {
  return (
    <View style={{ backgroundColor: bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color }} className="text-[11px] font-semibold">
        {texte}
      </Text>
    </View>
  );
}

function Chip({ texte }: { texte: string }) {
  return (
    <View className="border border-black/10 rounded-full px-2.5 py-1.5">
      <Text className="text-[12px] text-black/55">{texte}</Text>
    </View>
  );
}
