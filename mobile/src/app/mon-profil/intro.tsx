import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteLigne, ListeCartes, PASTILLE_PUBLIC } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';

// « Profil — À propos » / Intro — maquette du 20/10/2026 : même design que le menu. Une carte « Phrase d'accroche »
// (pastille Public), puis une carte par information (nom complet, titre professionnel, ville, pays, téléphone, e-mail),
// puis le bouton blanc pleine largeur « Modifier mon profil Intro ».
//
// Tout vient de `profiles` (bio, full_name, headline, city, country, phone, contact_email) et du compte. Une valeur
// absente s'affiche « Non renseigné » — jamais un exemple inventé.
function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export default function ProfilIntroScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const bio = texte(profile?.bio);
  const lignes: { icone: keyof typeof Ionicons.glyphMap; valeur: string | null; sous: string }[] = [
    { icone: 'person-outline', valeur: texte(profile?.full_name), sous: 'Nom complet' },
    { icone: 'briefcase-outline', valeur: texte(profile?.headline), sous: 'Titre professionnel' },
    { icone: 'location-outline', valeur: texte(profile?.city) ?? texte(profile?.location), sous: 'Ville actuelle' },
    { icone: 'flag-outline', valeur: texte(profile?.country), sous: 'Pays / origine' },
    { icone: 'call-outline', valeur: texte(profile?.phone) ?? texte(profile?.contact_phone), sous: 'Téléphone' },
    { icone: 'mail-outline', valeur: texte(profile?.contact_email) ?? user?.email ?? null, sous: 'E-mail' },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Intro" />

        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
          <ListeCartes>
            <CarteLigne
              alignHaut
              icone="chatbubble-ellipses-outline"
              titre="Phrase d'accroche"
              pastille={PASTILLE_PUBLIC}
              enfants={
                <Text style={{ fontSize: 13, lineHeight: 19.5, color: '#374151', marginTop: 4 }}>
                  {bio ?? "Aucune phrase d'accroche pour le moment."}
                </Text>
              }
            />
            {lignes.map((l) => (
              <CarteLigne key={l.sous} icone={l.icone} titre={l.valeur ?? 'Non renseigné'} sous={l.sous} />
            ))}
          </ListeCartes>

          <Pressable
            onPress={() => router.push('/mon-profil/infos-perso')}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 bg-white"
            style={{ marginHorizontal: 12, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
            <Ionicons name="pencil-outline" size={15} color="#111" />
            <Text className="text-[14px] font-bold text-[#111]">Modifier mon profil Intro</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
