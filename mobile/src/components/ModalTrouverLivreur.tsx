import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { LIBELLES_VEHICULE, type TypeVehicule } from '@/lib/livraison';
import { REGIONS_SENEGAL, zoneDansRegion, type RegionSenegal } from '@/lib/regionsSenegal';
import { supabase } from '@/lib/supabase';
import { contientTousLesMots } from '@/lib/texte';

// « Trouver un livreur » : livreurs accrédités et actifs, filtrés par zone (prénom, véhicule, zone, numéro).
// La liste vient de la fonction lister_livreurs_actifs, lisible seulement par un compte connecté.
const VERT = '#10B981';

type LivreurZone = { prenom: string; type_vehicule: TypeVehicule | null; zone: string | null; telephone: string | null };

const ICONES: Record<string, keyof typeof Ionicons.glyphMap> = { pied: 'walk', velo: 'bicycle', moto: 'bicycle', voiture: 'car' };
const chiffres = (t: string) => t.replace(/[^\d+]/g, '');

export default function ModalTrouverLivreur({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [zone, setZone] = useState('');
  const [region, setRegion] = useState<RegionSenegal | null>(null);
  const [livreurs, setLivreurs] = useState<LivreurZone[] | null>(null);
  const [erreur, setErreur] = useState(false);

  // Tous les livreurs actifs sont chargés une fois ; la région et la zone saisie filtrent ensuite sur place.
  useEffect(() => {
    if (!visible || !user) return;
    let annule = false;
    supabase.rpc('lister_livreurs_actifs', { p_zone: null, p_limite: 100 }).then(({ data, error }) => {
      if (annule) return;
      setErreur(Boolean(error));
      setLivreurs(error ? [] : ((data ?? []) as LivreurZone[]));
    });
    return () => {
      annule = true;
    };
  }, [visible, user]);

  const comptes = REGIONS_SENEGAL.map((r) => (livreurs ?? []).filter((l) => zoneDansRegion(l.zone, r)).length);
  const affiches = (livreurs ?? []).filter((l) => (!region || zoneDansRegion(l.zone, region)) && (!zone.trim() || contientTousLesMots(l.zone ?? '', zone)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onFermer}>
        <Pressable className="rounded-t-[28px] bg-white" style={{ maxHeight: '80%', paddingBottom: 18 }} onPress={() => {}}>
          <View className="flex-row items-center gap-3 px-5 pt-4 pb-2">
            <View className="items-center justify-center rounded-xl" style={{ width: 38, height: 38, backgroundColor: VERT }}>
              <Ionicons name="bicycle" size={20} color="#fff" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[15px] font-black text-[#1A1A1A]">Trouver un livreur</Text>
              <Text className="text-[11.5px] text-black/50">Livreurs accrédités de votre zone</Text>
            </View>
            <Pressable onPress={onFermer} accessibilityLabel="Fermer" hitSlop={8} className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: '#EFEDE7' }}>
              <Ionicons name="close" size={17} color="#1A1A1A" />
            </Pressable>
          </View>

          {!user ? (
            <View className="items-center px-6 py-8 gap-3">
              <Text className="text-[13px] text-black/60 text-center">Connectez-vous pour voir les livreurs de votre zone et les contacter.</Text>
              <Pressable
                onPress={() => {
                  onFermer();
                  router.push('/login' as Href);
                }}
                className="rounded-xl px-5 py-2.5"
                style={{ backgroundColor: VERT }}>
                <Text className="text-white text-[13px] font-black">Se connecter</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View className="px-5 pb-2">
                <TextInput
                  value={zone}
                  onChangeText={setZone}
                  placeholder="Ma zone (ex. Pikine, Thiès, Plateau…)"
                  placeholderTextColor="rgba(0,0,0,0.4)"
                  className="rounded-xl px-3.5 text-[13.5px] text-[#1A1A1A]"
                  style={{ height: 44, backgroundColor: '#F2F0EA' }}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 6 }}>
                {REGIONS_SENEGAL.map((r, i) => {
                  const actif = region?.nom === r.nom;
                  return (
                    <Pressable
                      key={r.nom}
                      onPress={() => setRegion(actif ? null : r)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                      className="rounded-full"
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        backgroundColor: actif ? VERT : comptes[i] > 0 ? '#fff' : '#F7F6F2',
                        borderWidth: 1,
                        borderColor: actif ? VERT : 'rgba(0,0,0,0.15)',
                      }}>
                      <Text className="text-[11.5px] font-extrabold" style={{ color: actif ? '#fff' : comptes[i] > 0 ? '#1A1A1A' : 'rgba(0,0,0,0.35)' }}>
                        {r.nom} · {comptes[i]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {livreurs === null ? (
                <View className="py-10"><ActivityIndicator color={VERT} /></View>
              ) : erreur ? (
                <Text className="text-center text-[12.5px] text-red-600 py-8">Impossible de charger les livreurs pour le moment.</Text>
              ) : affiches.length === 0 ? (
                <Text className="text-center text-[12.5px] text-black/50 py-8 px-6">
                  {region || zone.trim() ? 'Aucun livreur inscrit dans cette zone pour le moment.' : 'Aucun livreur inscrit pour le moment.'}
                </Text>
              ) : (
                <FlatList
                  data={affiches}
                  keyExtractor={(l, i) => `${l.prenom}-${l.telephone}-${i}`}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6, gap: 8 }}
                  renderItem={({ item }) => (
                    <View className="flex-row items-center gap-3 rounded-2xl p-3" style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                      <View className="items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: '#D1FAE5' }}>
                        <Ionicons name={ICONES[item.type_vehicule ?? ''] ?? 'bicycle'} size={19} color="#047857" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[14px] font-black text-[#1A1A1A]" numberOfLines={1}>{item.prenom}</Text>
                        <Text className="text-[11.5px] text-black/50" numberOfLines={1}>
                          {(item.type_vehicule && LIBELLES_VEHICULE[item.type_vehicule]) || 'Livreur'}
                          {item.zone ? ` · ${item.zone}` : ''}
                        </Text>
                      </View>
                      {item.telephone ? (
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={() => Linking.openURL(`tel:${chiffres(item.telephone ?? '')}`).catch(() => {})}
                            accessibilityLabel="Appeler"
                            className="items-center justify-center rounded-full"
                            style={{ width: 38, height: 38, backgroundColor: '#F2F0EA' }}>
                            <Ionicons name="call" size={16} color="#1A1A1A" />
                          </Pressable>
                          <Pressable
                            onPress={() => Linking.openURL(`https://wa.me/${chiffres(item.telephone ?? '').replace(/^\+/, '')}`).catch(() => {})}
                            accessibilityLabel="WhatsApp"
                            className="items-center justify-center rounded-full"
                            style={{ width: 38, height: 38, backgroundColor: VERT }}>
                            <Ionicons name="logo-whatsapp" size={17} color="#fff" />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  )}
                />
              )}
            </>
          )}

          <Pressable
            onPress={() => {
              onFermer();
              router.push('/marketplace/vendre/livreur' as Href);
            }}
            className="items-center pt-3">
            <Text className="text-[12.5px] font-black" style={{ color: '#047857' }}>Vous livrez ? Devenir livreur</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
