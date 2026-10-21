import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useFonctionnalite } from '@/lib/featureFlags';
import { LIBELLES_VEHICULE, type TypeVehicule } from '@/lib/livraison';
import { normaliserWhatsapp } from '@/lib/marketplace';
import { REGIONS_SENEGAL, zoneDansRegion, type RegionSenegal } from '@/lib/regionsSenegal';
import { supabase } from '@/lib/supabase';

// « Trouver un livreur » (maquette 07), ouvert par le bouton « + » du fil Locaux : en-tête #e3dbcc (retour ‹, titre,
// sous-titre), une carte blanche par livreur — rond à l'initiale, nom, véhicule · zone, « ● Disponible » en vert — et le
// bouton vert WhatsApp « Contacter » (ouvre WhatsApp avec le numéro du livreur). Seuls les livreurs accrédités et actifs
// sont listés (fonction lister_livreurs_actifs, comptes connectés seulement). Non reproduits, faute de donnée réelle :
// la photo du livreur (rond à l'initiale à la place) et la distance (la liste n'est pas triée par distance).
// Les 14 régions restent visibles en puces pour filtrer par zone.
const VERT = '#10B981';
const WHATSAPP = '#25D366';

type LivreurZone = { prenom: string; type_vehicule: TypeVehicule | null; zone: string | null; telephone: string | null };
const ICONES: Record<string, keyof typeof Ionicons.glyphMap> = { pied: 'walk', velo: 'bicycle', moto: 'bicycle', voiture: 'car' };

export default function TrouverLivreurScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const livreurOuvert = useFonctionnalite('nav_marketplace_livreur');
  const [livreurs, setLivreurs] = useState<LivreurZone[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [region, setRegion] = useState<RegionSenegal | null>(null);

  useEffect(() => {
    if (!user || !livreurOuvert) return;
    let annule = false;
    supabase.rpc('lister_livreurs_actifs', { p_zone: null, p_limite: 100 }).then(({ data, error }) => {
      if (annule) return;
      setErreur(Boolean(error));
      setLivreurs(error ? [] : ((data ?? []) as LivreurZone[]));
    });
    return () => {
      annule = true;
    };
  }, [user, livreurOuvert]);

  const comptes = REGIONS_SENEGAL.map((r) => (livreurs ?? []).filter((l) => zoneDansRegion(l.zone, r)).length);
  const affiches = (livreurs ?? []).filter((l) => !region || zoneDansRegion(l.zone, region));

  const contacter = (telephone: string | null) => {
    const numero = normaliserWhatsapp(telephone);
    if (numero) Linking.openURL(`https://wa.me/${numero.replace(/^\+/, '')}`).catch(() => {});
  };

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 py-3" style={{ backgroundColor: '#e3dbcc' }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace' as Href))}
            accessibilityLabel="Retour"
            className="items-center justify-center rounded-full bg-white"
            style={{ width: 46, height: 46 }}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-[19px] font-black text-[#111]">Trouver un livreur</Text>
            <Text className="text-[12.5px]" style={{ color: '#6B7280' }} numberOfLines={1}>Livreurs disponibles{region ? ` · ${region.nom}` : ''}</Text>
          </View>
        </View>

        {!livreurOuvert ? (
          <Text className="text-center text-[13px] px-8 mt-12" style={{ color: '#6B7280' }}>Cette fonctionnalité arrive dans une prochaine mise à jour.</Text>
        ) : !user ? (
          <View className="items-center px-8 mt-12 gap-3">
            <Text className="text-[13.5px] text-center" style={{ color: '#6B7280' }}>Connectez-vous pour voir les livreurs de votre zone et les contacter.</Text>
            <Pressable onPress={() => router.push('/login' as Href)} className="rounded-xl px-5 py-2.5" style={{ backgroundColor: VERT }}>
              <Text className="text-white text-[13px] font-black">Se connecter</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
              {REGIONS_SENEGAL.map((r, i) => {
                const actif = region?.nom === r.nom;
                return (
                  <Pressable
                    key={r.nom}
                    onPress={() => setRegion(actif ? null : r)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    className="rounded-full"
                    style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: actif ? VERT : comptes[i] > 0 ? '#fff' : '#F7F6F2', borderWidth: 1, borderColor: actif ? VERT : 'rgba(0,0,0,0.15)' }}>
                    <Text className="text-[11.5px] font-extrabold" style={{ color: actif ? '#fff' : comptes[i] > 0 ? '#1A1A1A' : 'rgba(0,0,0,0.35)' }}>
                      {r.nom} · {comptes[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {livreurs === null ? (
              <View className="py-12"><ActivityIndicator color={VERT} /></View>
            ) : erreur ? (
              <Text className="text-center text-[13px] text-red-600 mt-10">Impossible de charger les livreurs pour le moment.</Text>
            ) : affiches.length === 0 ? (
              <Text className="text-center text-[13px] px-8 mt-10" style={{ color: '#6B7280' }}>
                {region ? 'Aucun livreur inscrit dans cette zone pour le moment.' : 'Aucun livreur inscrit pour le moment.'}
              </Text>
            ) : (
              <FlatList
                data={affiches}
                keyExtractor={(l, i) => `${l.prenom}-${l.telephone}-${i}`}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
                renderItem={({ item }) => (
                  <View className="flex-row items-center gap-3 bg-white rounded-[20px] px-4 py-3.5">
                    <View className="items-center justify-center rounded-full" style={{ width: 46, height: 46, backgroundColor: '#D1FAE5' }}>
                      <Text className="text-[17px] font-black" style={{ color: '#047857' }}>{item.prenom.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[16px] font-black text-[#111]" numberOfLines={1}>{item.prenom}</Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Ionicons name={ICONES[item.type_vehicule ?? ''] ?? 'bicycle'} size={13} color="#6B7280" />
                        <Text className="text-[13px]" style={{ color: '#6B7280' }} numberOfLines={1}>
                          {(item.type_vehicule && LIBELLES_VEHICULE[item.type_vehicule]) || 'Livreur'}
                          {item.zone ? ` · ${item.zone}` : ''}
                        </Text>
                      </View>
                      <Text className="text-[12.5px] font-black mt-0.5" style={{ color: '#059669' }}>● Disponible</Text>
                    </View>
                    {item.telephone ? (
                      <Pressable
                        onPress={() => contacter(item.telephone)}
                        accessibilityRole="button"
                        accessibilityLabel={`Contacter ${item.prenom} sur WhatsApp`}
                        className="items-center justify-center rounded-full"
                        style={{ height: 46, paddingHorizontal: 18, backgroundColor: WHATSAPP }}>
                        <Text className="text-white text-[14px] font-black">Contacter</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
