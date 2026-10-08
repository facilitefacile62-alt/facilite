import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Confidentialité — maquette 55 : interrupteurs puis liens légaux.
//
// Écart assumé avec la maquette : elle montre « Afficher mon téléphone » et
// « Afficher mon e-mail » comme DEUX interrupteurs. La base n'a qu'un seul
// drapeau pour les coordonnées (profiles.show_contact) ; en afficher deux
// reviendrait à inventer une colonne, ou à présenter deux interrupteurs qui
// pilotent la même valeur. On expose donc les trois drapeaux qui existent
// réellement, avec les mêmes noms et la même règle de couplage que le site
// (src/app/profil/page.js : couper is_public coupe aussi show_contact — on
// ne garde jamais des coordonnées visibles sur un profil masqué).
const LIENS_LEGAUX = [
  { titre: "Conditions d'utilisation", cle: 'cgu' },
  { titre: 'Politique de confidentialité', cle: 'confidentialite' },
  { titre: 'Mentions légales', cle: 'mentions-legales' },
] as const;

export default function ProfilConfidentialiteScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [enCours, setEnCours] = useState<string | null>(null);
  const estPublic = profile?.is_public === true;
  const montreContact = profile?.show_contact === true;
  const cvVisible = profile?.cv_visible_recruteurs === true;

  async function basculer(champ: 'is_public' | 'show_contact' | 'cv_visible_recruteurs', valeur: boolean) {
    if (!user?.id || enCours) return;
    setEnCours(champ);
    try {
      const champs: Record<string, boolean> =
        champ === 'is_public' && valeur === false
          ? { is_public: false, show_contact: false }
          : { [champ]: valeur };
      await enregistrerChampsProfil(user.id, champs);
      await refreshProfile();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Confidentialité" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl px-3.5">
            <LigneBascule
              titre="Profil visible par les recruteurs"
              sous="Les entreprises peuvent voir votre CV"
              valeur={cvVisible}
              occupe={enCours === 'cv_visible_recruteurs'}
              onChange={(v) => basculer('cv_visible_recruteurs', v)}
            />
            <LigneBascule
              titre="Profil public"
              sous="Votre page profil est accessible par son lien"
              valeur={estPublic}
              occupe={enCours === 'is_public'}
              onChange={(v) => basculer('is_public', v)}
              premier={false}
            />
            <LigneBascule
              titre="Afficher mes coordonnées"
              sous={estPublic ? 'Téléphone et e-mail visibles sur votre profil public' : 'Activez d’abord le profil public'}
              valeur={montreContact}
              occupe={enCours === 'show_contact'}
              desactive={!estPublic}
              onChange={(v) => basculer('show_contact', v)}
              premier={false}
            />
          </View>

          <View className="bg-white rounded-2xl mt-3.5 px-3.5">
            {LIENS_LEGAUX.map((l, i) => (
              <Pressable
                key={l.cle}
                onPress={() => router.push(`/web/${l.cle}`)}
                className={`py-4 ${i > 0 ? 'border-t border-black/[0.06]' : ''}`}>
                <Text className="text-[13.5px] font-bold text-[#2563EB]">{l.titre}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LigneBascule({
  titre,
  sous,
  valeur,
  onChange,
  occupe,
  desactive,
  premier = true,
}: {
  titre: string;
  sous: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
  occupe?: boolean;
  desactive?: boolean;
  premier?: boolean;
}) {
  return (
    <View className={`flex-row items-center gap-3 py-4 ${premier ? '' : 'border-t border-black/[0.06]'}`}>
      <View className="flex-1 min-w-0">
        <Text className="text-[13.5px] font-bold text-[#1A1A1A]">{titre}</Text>
        <Text className="text-[11.5px] text-black/45 mt-0.5">{sous}</Text>
      </View>
      <Switch
        value={valeur}
        onValueChange={onChange}
        disabled={occupe || desactive}
        trackColor={{ true: '#10B981' }}
      />
    </View>
  );
}
