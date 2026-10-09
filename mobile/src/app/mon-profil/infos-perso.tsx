import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Informations personnelles (maquette 48) : six lignes — Lieu, Quartier,
// Pays / origine, Membre de, Niveau d'études, Genre — chacune avec son
// pictogramme, sa valeur, une aide, une pastille et un crayon qui ouvre la
// modification de la ligne.
//
// Correspondance avec la base (table profiles) : Lieu = city, Quartier =
// quartier, Pays / origine = country, Niveau d'études = education_level,
// Genre = gender. « Membre de » lit les badges du profil (non modifiable ici,
// ils sont attribués par la plateforme).
//
// Les pastilles « Public » / « Privé » reflètent la visibilité du profil
// entier (is_public) : la base n'a pas de visibilité champ par champ.
//
// Le nom, le titre, la biographie et les coordonnées vivent dans « Intro »
// et « Coordonnées » (maquettes 47 et 54). Le lien d'invitation reste en bas.
const SITE_URL = 'https://ffacilite.com';

type Ligne = {
  cle: 'city' | 'quartier' | 'country' | 'membre' | 'education_level' | 'gender';
  emoji: string;
  label: string;
  aide: string;
  bleu?: boolean;
  modifiable: boolean;
};

const LIGNES: Ligne[] = [
  { cle: 'city', emoji: '📍', label: 'LIEU', aide: 'Ville actuelle', bleu: true, modifiable: true },
  { cle: 'quartier', emoji: '📌', label: 'QUARTIER', aide: 'Peut être pré-rempli via "Scanner Document"', modifiable: true },
  { cle: 'country', emoji: '🧭', label: "PAYS / ORIGINE", aide: "Pays d'origine", bleu: true, modifiable: true },
  { cle: 'membre', emoji: '🏢', label: 'MEMBRE DE', aide: 'Organisation certifiée', modifiable: false },
  { cle: 'education_level', emoji: '🎓', label: "NIVEAU D'ÉTUDES", aide: "Utilisé pour vérifier votre éligibilité aux offres d'emploi", modifiable: true },
  { cle: 'gender', emoji: '♂', label: 'GENRE', aide: 'Genre du profil', modifiable: true },
];

export default function ProfilInfosPersoScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [enEdition, setEnEdition] = useState<Ligne['cle'] | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const estPublic = profile?.is_public === true;
  const badges = Array.isArray(profile?.badges) ? (profile?.badges as string[]) : [];
  const lienInvitation = `${SITE_URL}/in/${(profile?.slug as string | undefined) || user?.id || ''}`;

  function valeurDe(l: Ligne): string {
    if (l.cle === 'membre') return badges[0] ? String(badges[0]).replace(/_/g, ' ') : '';
    const v = profile?.[l.cle];
    return typeof v === 'string' ? v.trim() : '';
  }

  function ouvrir(l: Ligne) {
    setSaisie(valeurDe(l));
    setEnEdition(l.cle);
  }

  async function enregistrer() {
    if (!user?.id || !enEdition) return;
    setEnregistrement(true);
    try {
      await enregistrerChampsProfil(user.id, { [enEdition]: saisie.trim() });
      await refreshProfile();
      setEnEdition(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function copierLien() {
    await Clipboard.setStringAsync(lienInvitation);
    Alert.alert('Lien copié', 'Le lien de votre profil public a été copié.');
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Informations personnelles" />

        <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="gap-1">
            {LIGNES.map((l) => {
              const valeur = valeurDe(l);
              const certifie = l.cle === 'membre' && Boolean(valeur);
              const pastille =
                l.cle === 'education_level'
                  ? null
                  : certifie
                    ? { texte: 'Certifié', fond: '#D1FAE5', couleur: '#047857' }
                    : l.cle === 'membre'
                      ? null
                      : estPublic
                        ? { texte: 'Public', fond: '#DBEAFE', couleur: '#2563EB' }
                        : { texte: 'Privé', fond: '#E5E7EB', couleur: '#4B5563' };
              return (
                <View key={l.cle} className="flex-row items-start gap-3" style={{ paddingVertical: 9 }}>
                  <View className="items-center justify-center" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEF1FB' }}>
                    <Text style={{ fontSize: 17 }}>{l.emoji}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[11.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>{l.label}</Text>
                      <View className="flex-row items-center gap-3">
                        {pastille ? (
                          <View style={{ backgroundColor: pastille.fond, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 2 }}>
                            <Text className="text-[11.5px] font-black" style={{ color: pastille.couleur }}>{pastille.texte}</Text>
                          </View>
                        ) : null}
                        {l.modifiable ? (
                          <Pressable onPress={() => ouvrir(l)} accessibilityLabel={`Modifier ${l.label.toLowerCase()}`} hitSlop={8}>
                            <Ionicons name="pencil" size={14} color="rgba(0,0,0,0.45)" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>

                    {enEdition === l.cle ? (
                      <View className="gap-2 mt-1">
                        <TextInput
                          value={saisie}
                          onChangeText={setSaisie}
                          autoFocus
                          placeholder={l.aide}
                          placeholderTextColor="rgba(0,0,0,0.35)"
                          style={[{ height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
                        />
                        <View className="flex-row gap-2">
                          <Pressable onPress={() => setEnEdition(null)} className="flex-1 items-center justify-center bg-white" style={{ height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
                            <Text className="text-[13px] font-black text-[#1A1A1A]">Annuler</Text>
                          </Pressable>
                          <Pressable onPress={enregistrer} disabled={enregistrement} className="flex-1 items-center justify-center" style={{ height: 40, borderRadius: 12, backgroundColor: '#10B981', opacity: enregistrement ? 0.6 : 1 }}>
                            {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-[13px] font-black text-white">Enregistrer</Text>}
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text className="text-[16px] font-black mt-0.5" style={{ color: valeur && l.bleu ? '#2563EB' : '#1A1A1A' }}>
                          {valeur || 'Non renseigné'}
                        </Text>
                        <Text className="text-[12.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.45)' }}>{l.aide}</Text>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View className="flex-row items-center justify-between mt-6">
            <View className="flex-1 min-w-0 pr-3">
              <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.45)' }}>Lien d&apos;invitation</Text>
              <Text className="text-[12.5px] font-bold" style={{ color: '#2563EB' }} numberOfLines={1}>{lienInvitation}</Text>
            </View>
            <Pressable onPress={copierLien} className="flex-row items-center gap-1.5 bg-white" style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
              <Ionicons name="copy-outline" size={14} color="#1A1A1A" />
              <Text className="text-[13px] font-black text-[#1A1A1A]">Copier</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
