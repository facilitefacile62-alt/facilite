import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';
import { chargerMesBoutiques, modifierBoutique, type MaBoutique } from '@/lib/vendeur';

// « Boutique — Modifier le profil » — maquette 32 : logo, Prénom/Nom avec
// compteur, WhatsApp, ville avec GPS verrouillé, relevé de position, date
// de naissance et sexe, bouton « ✓ Enregistrer » dans l'en-tête.
//
// Deux contraintes du modèle de données, visibles dans l'écran :
// - La position d'une boutique est posée UNE SEULE FOIS, à la création
//   (creer_ma_boutique l'exige), et plus aucune fonction ne la déplace
//   ensuite : enregistrer_ma_boutique a été supprimée le 02/09/2026
//   (20260902240000_boutiques_multiples.sql) et modifier_ma_boutique ne
//   porte ni latitude ni longitude. Le verrou est délibéré — c'est lui qui
//   rend la distance affichée croyable (20260902220000). L'écran l'affiche
//   donc comme un état, sans bouton de relevé : un bouton appellerait une
//   fonction qui n'existe plus.
// - Le logo est un `avatar_config` (modifier_mon_avatar_boutique), pas une
//   photo téléversée : aucun éditeur mobile n'existe encore, le crayon le
//   dit au lieu d'ouvrir un sélecteur qui n'enregistrerait rien.
const BLEU = '#2563EB';
const VERT = '#10B981';
const MAX_NOM = 20;

function decouperNom(nomComplet: string | null | undefined): { prenom: string; nom: string } {
  const morceaux = (nomComplet ?? '').trim().split(/\s+/).filter(Boolean);
  return { prenom: morceaux[0] ?? '', nom: morceaux.slice(1).join(' ') };
}

export default function ModifierBoutiqueScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const userId = user?.id;

  const connu = decouperNom(profile?.full_name as string | undefined);
  const [prenom, setPrenom] = useState(connu.prenom);
  const [nom, setNom] = useState(connu.nom);
  const [whatsapp, setWhatsapp] = useState('');
  const [ville, setVille] = useState('');
  const [naissance, setNaissance] = useState(typeof profile?.birth_date === 'string' ? profile.birth_date : '');
  const [sexe, setSexe] = useState(typeof profile?.gender === 'string' ? profile.gender : '');
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(() => {
    if (!userId) return;
    chargerMesBoutiques(userId)
      .then((liste) => {
        const b = liste[0] ?? null;
        setBoutique(b);
        if (b) {
          setWhatsapp(b.telephone_whatsapp ?? '');
          setVille(b.ville ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, [userId]);

  useFocusEffect(charger);

  const positionConnue = boutique?.latitude != null && boutique?.longitude != null;

  async function enregistrer() {
    if (!userId || enregistrement) return;
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Informations manquantes', 'Le prénom et le nom sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrerChampsProfil(userId, {
        full_name: `${prenom.trim()} ${nom.trim()}`.trim(),
        birth_date: naissance.trim() || null,
        gender: sexe.trim() || null,
      });
      if (boutique) {
        await modifierBoutique(boutique.id, {
          nom: boutique.nom,
          quartier: boutique.quartier,
          ville: ville.trim() || null,
          telephoneWhatsapp: whatsapp.trim() || null,
        });
      }
      await refreshProfile();
      Alert.alert('Profil enregistré');
      if (router.canGoBack()) router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <MarketplaceHeader />

        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06]">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            className="flex-row items-center gap-1.5 bg-[#EEF2FF] rounded-full px-3 py-2">
            <Ionicons name="arrow-back" size={14} color={BLEU} />
            <Text className="text-[12.5px] font-bold" style={{ color: BLEU }}>
              Retour
            </Text>
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Modifier le profil</Text>
            <Text className="text-[11px] font-bold" style={{ color: VERT }}>
              Informations &amp; Localisation
            </Text>
          </View>
          <Pressable
            onPress={enregistrer}
            disabled={enregistrement}
            className="flex-row items-center gap-1.5 rounded-xl px-3 py-2.5"
            style={{ borderWidth: 1.5, borderColor: '#34D399', backgroundColor: '#F3FBF7', opacity: enregistrement ? 0.6 : 1 }}>
            {enregistrement ? (
              <ActivityIndicator color="#047857" size="small" />
            ) : (
              <Ionicons name="checkmark" size={14} color="#047857" />
            )}
            <Text className="text-[12.5px] font-bold text-[#047857]">Enregistrer</Text>
          </Pressable>
        </View>

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={VERT} />
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-4 py-5 gap-3" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="items-center mb-1">
              <Pressable
                onPress={() =>
                  Alert.alert('Logo de la boutique', "La personnalisation du logo arrive dans une prochaine mise à jour.")
                }
                className="w-[110px] h-[110px] rounded-full items-center justify-center"
                style={{ borderWidth: 2, borderColor: '#A7E8D2', borderStyle: 'dashed', backgroundColor: '#E8E4DA' }}>
                <Ionicons name="image-outline" size={26} color="rgba(0,0,0,0.3)" />
                <Text className="text-[11px] text-black/40 mt-1">Logo</Text>
                <View className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white items-center justify-center">
                  <Ionicons name="pencil" size={12} color="#1A1A1A" />
                </View>
              </Pressable>
            </View>

            <ChampEncadre libelle="Prénom*" valeur={prenom} onChange={setPrenom} max={MAX_NOM} />
            <ChampEncadre libelle="Nom*" valeur={nom} onChange={setNom} max={MAX_NOM} />
            <ChampEncadre
              libelle="Numéro WhatsApp*"
              valeur={whatsapp}
              onChange={setWhatsapp}
              indication="Contact direct"
              clavier="phone-pad"
            />

            <View className="bg-white rounded-[14px] px-3.5 py-3.5 flex-row items-center gap-2" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
              <Ionicons name="location" size={14} color="#EF4444" />
              <TextInput
                value={ville}
                onChangeText={setVille}
                placeholder="Ville"
                placeholderTextColor="rgba(0,0,0,0.3)"
                className="flex-1 text-[14px] text-[#1A1A1A]"
              />
              {positionConnue ? (
                <View className="bg-[#D1FAE5] rounded-full px-2.5 py-1">
                  <Text className="text-[10.5px] font-bold text-[#047857]">GPS Verrouillé</Text>
                </View>
              ) : null}
            </View>

            <View className="bg-white rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="navigate-outline" size={15} color="#1A1A1A" />
                  <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Positionner ma boutique</Text>
                </View>
              </View>
              <Text className="text-[11.5px] text-black/45 mt-1.5">
                {positionConnue
                  ? 'Position relevée à la création de la boutique. Elle est figée : c’est ce qui rend la distance affichée aux acheteurs crédible.'
                  : 'Aucune position enregistrée pour cette boutique.'}
              </Text>
              <View
                className="rounded-xl py-3 items-center justify-center flex-row gap-2 mt-3"
                style={{ backgroundColor: '#EEF2FF' }}>
                <Ionicons name={positionConnue ? 'lock-closed' : 'alert-circle-outline'} size={14} color={BLEU} />
                <Text className="text-[13px] font-bold" style={{ color: BLEU }}>
                  {positionConnue ? 'Position verrouillée' : 'Position non définie'}
                </Text>
              </View>
            </View>

            <ChampEncadre libelle="Date de naissance" valeur={naissance} onChange={setNaissance} indication="aaaa-mm-jj" />
            <ChampEncadre libelle="Sexe" valeur={sexe} onChange={setSexe} indication="Femme / Homme" />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Champ de la maquette : libellé vert posé sur la bordure, compteur à droite. */
function ChampEncadre({
  libelle,
  valeur,
  onChange,
  max,
  indication,
  clavier,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  max?: number;
  indication?: string;
  clavier?: 'phone-pad' | 'default';
}) {
  return (
    <View className="bg-white rounded-[14px] px-3.5 pt-2.5 pb-3" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>
          {libelle}
        </Text>
        {max ? (
          <Text className="text-[11px] text-black/35">
            {valeur.length} / {max}
          </Text>
        ) : indication ? (
          <Text className="text-[11px] text-black/35">{indication}</Text>
        ) : null}
      </View>
      <TextInput
        value={valeur}
        onChangeText={(v) => onChange(max ? v.slice(0, max) : v)}
        keyboardType={clavier ?? 'default'}
        className="text-[14.5px] text-[#1A1A1A] mt-1 p-0"
      />
    </View>
  );
}
