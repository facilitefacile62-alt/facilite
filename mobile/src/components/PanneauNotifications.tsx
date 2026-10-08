import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { IconPoints } from '@/components/facilite-icons';
import {
  COULEUR_TYPE,
  chargerNotifications,
  marquerNotificationLue,
  type NotificationFacilite,
} from '@/lib/notifications';
import { invaliderCompteurs } from '@/lib/useCompteursNonLus';

// Panneau Notifications — maquette 42.
//
// Les notifications étaient une liste d'exemple codée en dur (« Votre
// candidature a été vue par le recruteur », « Non lu (28) »...). La table
// `public.notifications` existe pourtant depuis le 14/08/2026, avec RLS par
// destinataire et la fonction `mark_notification_read`. Ce panneau lit
// désormais la vraie table : plus aucun contenu inventé, et le compteur
// « Non lu » est le vrai.

type Filtre = 'tout' | 'non_lu';

/** "il y a 3 h", "2 j." — format court de la maquette, sans dépendre d'Intl. */
function depuis(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  return `${jours} j.`;
}

export default function PanneauNotifications({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [liste, setListe] = useState<NotificationFacilite[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let annule = false;
    // Les deux états ne sont posés que depuis les callbacks : un setState
    // synchrone dans le corps d'un effet déclenche des rendus en cascade.
    chargerNotifications()
      .then((n) => {
        if (annule) return;
        setListe(n);
        setErreur(false);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, [visible]);

  const nonLues = (liste ?? []).filter((n) => !n.lue).length;
  const affichees = (liste ?? []).filter((n) => filtre === 'tout' || !n.lue);

  const ouvrir = (n: NotificationFacilite) => {
    if (n.lue) return;
    // Optimiste : la pastille doit tomber tout de suite. En cas d'échec
    // réseau la ligne sera simplement relue non lue au prochain affichage.
    setListe((actuelle) => (actuelle ?? []).map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
    marquerNotificationLue(n.id)
      .then(() => invaliderCompteurs())
      .catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable onPress={onFermer} className="flex-1 bg-black/40 items-center pt-10 px-6">
        <Pressable onPress={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-h-[78%] overflow-hidden">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2.5">
            <Text className="text-[18px] font-extrabold text-[#1A1A1A]">Notifications</Text>
            <IconPoints size={16} color="#1A1A1A" />
          </View>

          <View className="flex-row gap-5 px-4 pb-2.5 border-b border-black/[0.06]">
            <Pressable onPress={() => setFiltre('tout')} className={filtre === 'tout' ? 'bg-[#e6f0fd] px-3.5 py-1.5 rounded-full' : 'py-1.5'}>
              <Text className={`text-[13px] ${filtre === 'tout' ? 'font-bold text-blue-600' : 'font-semibold text-black/50'}`}>
                Tout
              </Text>
            </Pressable>
            <Pressable onPress={() => setFiltre('non_lu')} className={filtre === 'non_lu' ? 'bg-[#e6f0fd] px-3.5 py-1.5 rounded-full' : 'py-1.5'}>
              <Text className={`text-[13px] ${filtre === 'non_lu' ? 'font-bold text-blue-600' : 'font-semibold text-black/50'}`}>
                Non lu{nonLues > 0 ? ` (${nonLues})` : ''}
              </Text>
            </Pressable>
          </View>

          {liste === null && !erreur ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#2563EB" />
            </View>
          ) : erreur ? (
            <View className="py-10 px-6 items-center">
              <Text className="text-[13px] text-black/50 text-center">
                Impossible de charger vos notifications pour le moment.
              </Text>
            </View>
          ) : affichees.length === 0 ? (
            <View className="py-10 px-6 items-center">
              <Text className="text-[13px] text-black/50 text-center">
                {filtre === 'non_lu' ? 'Aucune notification non lue.' : 'Aucune notification pour le moment.'}
              </Text>
            </View>
          ) : (
            <>
              <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
                <Text className="text-[13px] font-bold text-[#1A1A1A]">Nouveau</Text>
              </View>

              <ScrollView className="px-2 pb-2.5">
                {affichees.map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => ouvrir(n)}
                    className="flex-row gap-2.5 items-start px-2 py-2.5 rounded-xl">
                    <View className="w-[34px] h-[34px] rounded-full border-[1.5px] border-black/50 items-center justify-center relative">
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                        <Circle cx={12} cy={8} r={3.5} stroke="#1A1A1A" strokeWidth={1.8} />
                        <Path d="M4.5 20C5.5 15.8 8.4 14 12 14C15.6 14 18.5 15.8 19.5 20" stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
                      </Svg>
                      <View
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                        style={{ backgroundColor: COULEUR_TYPE[n.type] ?? COULEUR_TYPE.system }}
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className={`text-[12.5px] leading-[17px] text-[#1A1A1A] ${n.lue ? 'font-medium' : 'font-bold'}`}>
                        {n.contenu}
                      </Text>
                      <Text className="text-[11px] text-blue-600 mt-0.5">{depuis(n.creeLe)}</Text>
                    </View>
                    {!n.lue ? <View className="w-[7px] h-[7px] rounded-full bg-blue-600 mt-1" /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
