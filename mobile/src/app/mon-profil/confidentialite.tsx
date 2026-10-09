import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Confidentialité — maquette 55 : trois interrupteurs puis liens légaux.
//
// Les colonnes show_phone et show_email ont été ajoutées le 09/10/2026
// (migration 20261009090000) à la demande du client, pour séparer les deux
// interrupteurs de la maquette — la base n'avait jusque-là que le drapeau
// de bloc show_contact.
//
// show_contact reste l'interrupteur maître du bloc « coordonnées » côté
// site : on le garde synchronisé ici (vrai dès qu'au moins l'un des deux
// champs est affiché), sinon activer « Afficher mon téléphone » depuis
// l'app ne produirait rien sur la page publique.
const LIENS_LEGAUX = [
  { titre: "Conditions d'utilisation", cle: 'cgu' },
  { titre: 'Politique de confidentialité', cle: 'confidentialite' },
  { titre: 'Mentions légales', cle: 'mentions-legales' },
] as const;

export default function ProfilConfidentialiteScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [enCours, setEnCours] = useState<string | null>(null);
  const montreTelephone = profile?.show_phone === true;
  const montreEmail = profile?.show_email === true;
  const cvVisible = profile?.cv_visible_recruteurs === true;

  type Champ = 'show_phone' | 'show_email' | 'cv_visible_recruteurs';

  async function basculer(champ: Champ, valeur: boolean) {
    if (!user?.id || enCours) return;
    setEnCours(champ);
    try {
      const champs: Record<string, boolean> = { [champ]: valeur };
      // show_contact est l'interrupteur maître du bloc « coordonnées » sur
      // la page publique : il doit être vrai dès qu'un des deux champs est
      // affiché, faux quand les deux sont coupés.
      if (champ === 'show_phone' || champ === 'show_email') {
        const telephone = champ === 'show_phone' ? valeur : montreTelephone;
        const email = champ === 'show_email' ? valeur : montreEmail;
        champs.show_contact = telephone || email;
      }
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
              titre="Afficher mon téléphone"
              sous="Visible sur votre profil public"
              valeur={montreTelephone}
              occupe={enCours === 'show_phone'}
              onChange={(v) => basculer('show_phone', v)}
              premier={false}
            />
            <LigneBascule
              titre="Afficher mon e-mail"
              sous="Visible sur votre profil public"
              valeur={montreEmail}
              occupe={enCours === 'show_email'}
              onChange={(v) => basculer('show_email', v)}
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
