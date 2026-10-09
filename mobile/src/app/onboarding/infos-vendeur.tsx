import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import SelecteurDepartement from '@/components/SelecteurDepartement';
import { useAuth } from '@/context/AuthContext';
import { creerBoutique, enregistrerIdentiteVendeur } from '@/lib/vendeur';
import { useLocalisation } from '@/lib/useLocalisation';
import type { Position } from '@/lib/marketplace';

// Onboarding — Infos vendeur (maquette « Onboarding — Infos vendeur ») :
// identité et boutique réunies en un seul écran, à la différence du parcours
// « Devenir Vendeur » en 2 étapes utilisé plus tard depuis le profil.
export default function OnboardingInfosVendeurScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { activer } = useLocalisation();
  const connu = (profile?.full_name as string | undefined) ?? '';

  const [prenom, setPrenom] = useState(connu.split(' ')[0] ?? '');
  const [nom, setNom] = useState(connu.split(' ').slice(1).join(' '));
  const [whatsapp, setWhatsapp] = useState((profile?.phone as string | undefined) ?? '');
  const [nomBoutique, setNomBoutique] = useState('');
  const [ville, setVille] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [relevePosition, setRelevePosition] = useState<'aucun' | 'en_cours' | 'ok' | 'echec'>('aucun');
  const [enregistrement, setEnregistrement] = useState(false);

  async function releverPosition() {
    setRelevePosition('en_cours');
    const { position: releve } = await activer().catch(() => ({ position: null }));
    setPosition(releve);
    setRelevePosition(releve ? 'ok' : 'echec');
  }

  async function creer() {
    if (!user?.id) return;
    if (!prenom.trim() || !nom.trim() || !whatsapp.trim() || !nomBoutique.trim()) {
      Alert.alert('Informations manquantes', 'Prénom, nom, WhatsApp et nom de la boutique sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrerIdentiteVendeur(user.id, { prenom, nom, telephone: whatsapp, email: '' });
      await creerBoutique(user.id, { nom: nomBoutique, ville, quartier: null, telephoneWhatsapp: whatsapp, position });
      router.replace('/marketplace/vendre');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer votre boutique.');
    } finally {
      setEnregistrement(false);
    }
  }

  const champ = { height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff', paddingHorizontal: 20, fontSize: 16, color: '#1A1A1A', outlineStyle: 'none' } as object;
  const etiquette = 'text-[13px] font-black text-[#111] mb-1.5';

  return (
    <View className="flex-1 bg-[#FAF6F1]">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerClassName="px-5 pt-3 pb-10" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between mb-3">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding/role' as never))}
              accessibilityLabel="Retour"
              className="items-center justify-center bg-white"
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
              <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
            </Pressable>
            <View className="flex-row items-center gap-1">
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#111' }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#111' }} />
              <View style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: '#111' }} />
            </View>
          </View>

          <Text className="text-[22px] font-black text-[#111]">Informations Vendeur &amp; Boutique</Text>
          <Text className="text-[14px] mt-1 mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>Ces informations apparaîtront sur votre boutique.</Text>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className={etiquette}>Prénom</Text>
              <TextInput value={prenom} onChangeText={setPrenom} placeholder="Prénom" placeholderTextColor="rgba(0,0,0,0.35)" style={champ} />
            </View>
            <View className="flex-1">
              <Text className={etiquette}>Nom</Text>
              <TextInput value={nom} onChangeText={setNom} placeholder="Nom" placeholderTextColor="rgba(0,0,0,0.35)" style={champ} />
            </View>
          </View>

          <Text className={etiquette + ' mt-4'}>Téléphone / WhatsApp</Text>
          <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="+221 77 000 00 00" placeholderTextColor="rgba(0,0,0,0.35)" keyboardType="phone-pad" style={champ} />

          <Text className={etiquette + ' mt-4'}>Nom de la boutique</Text>
          <TextInput value={nomBoutique} onChangeText={setNomBoutique} placeholder="Ex. Moïse Couture" placeholderTextColor="rgba(0,0,0,0.35)" style={champ} />

          <Text className={etiquette + ' mt-4'}>Ville</Text>
          <SelecteurDepartement valeur={ville} onChoisir={setVille} />

          <View className="mt-5 rounded-[18px] p-3.5 bg-white" style={{ borderWidth: 1.5, borderColor: '#34D399', borderStyle: 'dashed' }}>
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#D7F2EA' }}>
                <Ionicons name="location-outline" size={22} color="#0d3b34" />
              </View>
              <View className="flex-1">
                <Text className="text-[14.5px] font-black text-[#111]">Position géographique GPS de la boutique</Text>
                <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>Aidez les acheteurs proches à vous trouver.</Text>
              </View>
            </View>
            <View className="mt-3">
              <BoutonAction
                titre={relevePosition === 'ok' ? 'Position relevée' : relevePosition === 'echec' ? 'Position indisponible, réessayez' : 'Relever ma position actuelle'}
                sousTitre="Position GPS de la boutique"
                icone="locate-outline"
                onPress={releverPosition}
                chargement={relevePosition === 'en_cours'}
              />
            </View>
          </View>

          <View className="mt-4">
            <BoutonAction titre="Créer ma boutique et continuer" sousTitre="Accéder à mon espace vendeur" icone="storefront-outline" onPress={creer} chargement={enregistrement} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
