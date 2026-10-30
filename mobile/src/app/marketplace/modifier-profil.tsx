import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import BoutonAction from '@/components/BoutonAction';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import EnteteMarketplace from '@/components/EnteteMarketplace';

// Modifier le profil (visiteur), maquette « Marketplace — Modifier profil
// visiteur » : juste prénom et nom, à la différence du profil vendeur
// (boutique, WhatsApp, position…).
function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

// Le formulaire est remonté quand le profil arrive : ouvert directement par un
// lien, il se remplit quand même avec le prénom et le nom du compte.
export default function ModifierProfilVisiteurScreen() {
  return <FormulaireProfilVisiteur />;
}

/** `integre` : page « Modifier profil » du glisseur « Modifier infos » (sans en-tête propre). */
export function FormulaireProfilVisiteur({ integre = false }: { integre?: boolean }) {
  const { profile } = useAuth();
  return <Formulaire key={(profile?.id as string | undefined) ?? 'chargement'} integre={integre} />;
}

function Formulaire({ integre }: { integre: boolean }) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const connu = decouperNom(profile?.full_name as string | undefined);
  const [prenom, setPrenom] = useState(connu.prenom);
  const [nom, setNom] = useState(connu.nom);
  const [enregistrement, setEnregistrement] = useState(false);

  async function enregistrer() {
    if (!user?.id) return;
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: `${prenom.trim()} ${nom.trim()}`.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        {integre ? null : <EnteteMarketplace titre="Modifier le profil" />}

        <View className="px-5 pt-2 gap-3.5">
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Prénom</Text>
            <TextInput
              value={prenom}
              onChangeText={setPrenom}
              placeholder="Votre prénom"
              placeholderTextColor="#9CA3AF"
              className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
            />
          </View>
          <View className="gap-1.5">
            <Text className="text-[12.5px] font-bold text-gray-700">Nom</Text>
            <TextInput
              value={nom}
              onChangeText={setNom}
              placeholder="Votre nom"
              placeholderTextColor="#9CA3AF"
              className="border border-[#0B3D2A] rounded-xl px-3.5 py-3.5 text-[14px] text-[#1A1A1A]"
            />
          </View>

          <View className="mt-2">
            <BoutonAction titre="Enregistrer" sousTitre="Prénom et nom" icone="checkmark" onPress={enregistrer} chargement={enregistrement} />
          </View>
        </View>
      </View>
    </View>
  );
}
