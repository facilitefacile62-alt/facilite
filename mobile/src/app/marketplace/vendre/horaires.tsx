import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import {
  NOM_JOUR,
  chargerHoraires,
  enregistrerHoraires,
  estAujourdhui,
  semaineVide,
  type HoraireJour,
} from '@/lib/horaires';
import { chargerMesBoutiques } from '@/lib/vendeur';

// « Programmer des horaires » — les sept jours avec un interrupteur chacun
// (charte §7, maquettes « Boutique — Service » 29 et « Boutique —
// Établissement » 30). Les deux boutons de Ma boutique affichaient
// jusqu'ici « Bientôt disponible » alors que la table
// public.marketplace_horaires et la fonction enregistrer_mes_horaires
// existent depuis longtemps.
const VERT = '#10B981';
const VERT_PROFOND = '#0d3b34';

/** Accepte « 8 », « 08h », « 8:5 »… et renvoie « 08:05 ». */
function normaliserHeure(saisie: string): string | null {
  const chiffres = saisie.replace(/[^0-9]/g, '').slice(0, 4);
  if (chiffres.length === 0) return null;
  const h = Number(chiffres.slice(0, 2));
  const m = chiffres.length > 2 ? Number(chiffres.slice(2).padEnd(2, '0')) : 0;
  if (!Number.isFinite(h) || h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function HorairesBoutiqueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [semaine, setSemaine] = useState<HoraireJour[]>(semaineVide);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let annule = false;
      chargerMesBoutiques(userId)
        .then(async (liste) => {
          const b = liste[0];
          if (!b || annule) return;
          setStoreId(b.id);
          const h = await chargerHoraires(b.id);
          if (!annule) setSemaine(h);
        })
        .catch(() => {})
        .finally(() => {
          if (!annule) setChargement(false);
        });
      return () => {
        annule = true;
      };
    }, [userId])
  );

  function majJour(jour: number, champs: Partial<HoraireJour>) {
    setSemaine((s) => s.map((h) => (h.jour === jour ? { ...h, ...champs } : h)));
  }

  async function enregistrer() {
    if (!storeId || enregistrement) return;
    setEnregistrement(true);
    try {
      await enregistrerHoraires(storeId, semaine);
      Alert.alert('Horaires enregistrés');
      if (router.canGoBack()) router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'enregistrer les horaires.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <MarketplaceHeader />

        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre'))}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-white items-center justify-center">
            <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[16px] font-black text-[#1A1A1A]">Programmer des horaires</Text>
            <Text className="text-[11.5px] text-black/45">Fuseau Africa/Dakar</Text>
          </View>
        </View>

        {chargement ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={VERT} />
          </View>
        ) : !storeId ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-black/50 text-center">
              Créez votre boutique avant de programmer des horaires.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="bg-white rounded-2xl px-3.5">
                {semaine.map((h, i) => (
                  <View key={h.jour} className={`py-3.5 ${i > 0 ? 'border-t border-black/[0.06]' : ''}`}>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[14px] font-bold text-[#1A1A1A]">{NOM_JOUR[h.jour]}</Text>
                      {estAujourdhui(h.jour) ? (
                        <View className="bg-[#D1FAE5] rounded-full px-2 py-0.5">
                          <Text className="text-[9.5px] font-black text-[#047857]">AUJOURD&apos;HUI</Text>
                        </View>
                      ) : null}
                      <View className="flex-1" />
                      <Switch
                        value={!h.ferme}
                        onValueChange={(ouvert) => majJour(h.jour, { ferme: !ouvert })}
                        trackColor={{ true: VERT }}
                      />
                    </View>

                    {h.ferme ? (
                      <Text className="text-[12.5px] font-bold text-red-600 mt-1.5">Fermé</Text>
                    ) : (
                      <View className="flex-row items-center gap-2 mt-2">
                        <ChampHeure
                          valeur={h.ouverture ?? ''}
                          onValider={(v) => majJour(h.jour, { ouverture: v })}
                          libelle="Ouverture"
                        />
                        <Text className="text-[13px] text-black/35">–</Text>
                        <ChampHeure
                          valeur={h.fermeture ?? ''}
                          onValider={(v) => majJour(h.jour, { fermeture: v })}
                          libelle="Fermeture"
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View className="px-4 pb-4 pt-2">
              <Pressable
                onPress={enregistrer}
                disabled={enregistrement}
                className="rounded-2xl py-3.5 items-center"
                style={{ backgroundColor: VERT_PROFOND, opacity: enregistrement ? 0.6 : 1 }}>
                {enregistrement ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-[14.5px] font-bold">Enregistrer les horaires</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function ChampHeure({
  valeur,
  onValider,
  libelle,
}: {
  valeur: string;
  onValider: (v: string) => void;
  libelle: string;
}) {
  const [saisie, setSaisie] = useState(valeur);
  return (
    <TextInput
      value={saisie}
      onChangeText={setSaisie}
      onBlur={() => {
        const propre = normaliserHeure(saisie);
        // Saisie inexploitable : on revient à la valeur connue plutôt que
        // d'enregistrer une heure vide que la base refuserait.
        setSaisie(propre ?? valeur);
        onValider(propre ?? valeur);
      }}
      placeholder="08:00"
      placeholderTextColor="rgba(0,0,0,0.3)"
      keyboardType="number-pad"
      accessibilityLabel={libelle}
      maxLength={5}
      className="border-[1.5px] border-[#0B3D2A] rounded-[12px] px-3 py-2 text-[13.5px] font-bold text-[#1A1A1A] w-[84px] text-center"
    />
  );
}
