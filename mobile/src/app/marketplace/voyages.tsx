import * as Location from 'expo-location';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { ZONES_GROUPAGE, type ZoneGroupage } from '@/lib/groupages';
import { supabase } from '@/lib/supabase';
import {
  annulerReservationVoyage,
  chargerMesReservationsVoyage,
  chargerVoyagesParIds,
  heureCourte,
  infosChauffeurDeMaReservation,
  rechercherVoyages,
  reserverVoyage,
  type InfosChauffeur,
  type InfoVoyage,
  type MaReservationVoyage,
  type VoyagePropose,
} from '@/lib/voyages';

// « Voyages » (passager) — port de VoyagesPassager.jsx (web). Chercher un voyage de chauffeur
// qui fait mon trajet (départ A et destination B choisis parmi des zones, ou « Ma position »),
// réserver des places, suivre mes réservations ; une fois acceptée je vois le chauffeur (nom,
// téléphone, véhicule, plaque) et, quand le voyage est parti, je le suis en direct. Les règles
// (distance, places, une réservation active par voyage) sont revérifiées en base.
const VERT = '#10B981';
const LIBELLE_STATUT = { en_attente: 'En attente du chauffeur', acceptee: 'Acceptée', refusee: 'Refusée', annulee: 'Annulée' } as const;
const COULEUR_STATUT = {
  en_attente: { fond: '#FEF3C7', texte: '#B45309' },
  acceptee: { fond: '#D1FAE5', texte: '#047857' },
  refusee: { fond: '#FEE2E2', texte: '#B91C1C' },
  annulee: { fond: '#F3F4F6', texte: '#4B5563' },
} as const;

function Puce({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-full px-3 py-2" style={{ backgroundColor: actif ? '#0d3b34' : '#fff', borderWidth: 1, borderColor: actif ? '#0d3b34' : '#E5E7EB' }}>
      <Text className="text-[12.5px] font-bold" style={{ color: actif ? '#fff' : '#1A1A1A' }}>{libelle}</Text>
    </Pressable>
  );
}

function Chercher({ onReserve }: { onReserve: () => void }) {
  const [prise, setPrise] = useState<ZoneGroupage | null>(null);
  const [dest, setDest] = useState<ZoneGroupage | null>(null);
  const [voyages, setVoyages] = useState<VoyagePropose[] | null>(null);
  const [choisi, setChoisi] = useState<VoyagePropose | null>(null);
  const [places, setPlaces] = useState(1);
  const [lieu, setLieu] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!prise || !dest) return;
    let annule = false;
    rechercherVoyages(prise, dest)
      .then((l) => {
        if (annule) return;
        setVoyages(l);
        setChoisi((c) => (c && l.some((v) => v.id === c.id) ? c : null));
      })
      .catch((e: unknown) => {
        if (!annule) Alert.alert('Erreur', e instanceof Error ? e.message : 'Recherche impossible.');
      });
    return () => {
      annule = true;
    };
  }, [prise, dest]);

  async function maPosition() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Localisation refusée', 'Autorisez la localisation ou choisissez une zone de départ.');
      return;
    }
    const p = await Location.getCurrentPositionAsync({});
    setPrise({ nom: 'Ma position', lat: p.coords.latitude, lng: p.coords.longitude });
    if (!lieu) setLieu('Ma position');
  }

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const m: MarqueurCarte[] = [];
    if (prise) m.push({ id: 'A', lat: prise.lat, lng: prise.lng, couleur: '#10B981', libelle: `A · ${prise.nom}` });
    if (dest) m.push({ id: 'B', lat: dest.lat, lng: dest.lng, couleur: '#EF4444', libelle: `B · ${dest.nom}` });
    if (choisi) {
      m.push({ id: 'va', lat: choisi.depart_lat, lng: choisi.depart_lng, couleur: '#2563EB', rayon: 7, libelle: `Départ · ${choisi.depart_libelle}` });
      m.push({ id: 'vb', lat: choisi.destination_lat, lng: choisi.destination_lng, couleur: '#2563EB', rayon: 7, libelle: `Arrivée · ${choisi.destination_libelle}` });
    }
    return m;
  }, [prise, dest, choisi]);

  async function reserver() {
    if (!choisi || !prise || !dest) return;
    setEnCours(true);
    try {
      await reserverVoyage({ voyageId: choisi.id, places, priseLibelle: lieu.trim() || prise.nom, prise, dest });
      Alert.alert('Demande envoyée', 'Le chauffeur doit l’accepter : tu seras prévenu.');
      setChoisi(null);
      onReserve();
    } catch (e) {
      Alert.alert('Réservation impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View className="gap-3">
      <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
        Dis d’où tu pars (A) et où tu vas (B) : tu vois les chauffeurs qui font ce trajet et tu réserves une place.
      </Text>
      <View className="overflow-hidden" style={{ height: 210, borderRadius: 20, backgroundColor: '#E8E4DA' }}>
        <CarteLeaflet centre={{ lat: prise?.lat ?? 14.72, lng: prise?.lng ?? -17.3 }} zoom={10} marqueurs={marqueurs} ajuster style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      </View>

      <Text className="text-[12.5px] font-black text-[#1A1A1A]">Je pars de (A)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        <Puce libelle="📍 Ma position" actif={prise?.nom === 'Ma position'} onPress={maPosition} />
        {ZONES_GROUPAGE.map((z) => <Puce key={`a-${z.nom}`} libelle={z.nom} actif={prise?.nom === z.nom} onPress={() => { setPrise(z); if (!lieu) setLieu(z.nom); }} />)}
      </ScrollView>
      <Text className="text-[12.5px] font-black text-[#1A1A1A]">Je vais à (B)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {ZONES_GROUPAGE.map((z) => <Puce key={`b-${z.nom}`} libelle={z.nom} actif={dest?.nom === z.nom} onPress={() => setDest(z)} />)}
      </ScrollView>

      {!prise || !dest ? (
        <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Choisis ton départ et ta destination pour voir les voyages.</Text>
      ) : voyages === null ? (
        <ActivityIndicator color={VERT} />
      ) : voyages.length === 0 ? (
        <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>Aucun voyage ne fait ce trajet pour l’instant. Reviens plus tard : les chauffeurs en annoncent régulièrement.</Text>
      ) : (
        voyages.map((v) => {
          const sel = choisi?.id === v.id;
          const ok = v.dans_la_zone && v.places_restantes > 0;
          return (
            <Pressable key={v.id} onPress={() => setChoisi(v)} className="bg-white rounded-[18px] p-3.5 gap-1" style={{ borderWidth: 2, borderColor: sel ? '#2563EB' : 'transparent' }}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-[14px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>{v.depart_libelle} → {v.destination_libelle}</Text>
                <Text className="text-[12.5px] font-black text-[#1A1A1A]">{v.prix_par_place_xof.toLocaleString('fr-FR')} FCFA / place</Text>
              </View>
              <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Départ {heureCourte(v.heure_depart)} · {v.places_restantes} place{v.places_restantes > 1 ? 's' : ''} restante{v.places_restantes > 1 ? 's' : ''}
                {v.chauffeur_prenom ? ` · ${v.chauffeur_prenom}` : ''}
                {v.type_vehicule ? ` (${v.type_vehicule})` : ''}
              </Text>
              <Text className="text-[11.5px] font-black" style={{ color: ok ? '#059669' : '#D97706' }}>
                {v.places_restantes === 0 ? 'Complet' : v.dans_la_zone ? 'Fait ton trajet ✓' : `Départ à ${String(v.distance_prise_km).replace('.', ',')} km de toi, arrivée à ${String(v.distance_destination_km).replace('.', ',')} km de ta destination : hors zone`}
              </Text>
              {v.note ? <Text className="text-[11px] italic" style={{ color: 'rgba(0,0,0,0.5)' }}>{v.note}</Text> : null}
            </Pressable>
          );
        })
      )}

      {choisi && (
        <View className="rounded-[18px] p-3.5 gap-2.5" style={{ backgroundColor: '#fff' }}>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Où le chauffeur te prend</Text>
          <TextInput value={lieu} onChangeText={setLieu} placeholder="Ex. Devant la poste du Plateau" maxLength={80} className="rounded-[14px] px-3.5 text-[14px] text-[#1A1A1A]" style={{ height: 46, backgroundColor: '#F6F4EE' }} />
          <View className="flex-row items-center justify-between">
            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Places : {places}</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setPlaces((p) => Math.max(1, p - 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">−</Text></Pressable>
              <Pressable onPress={() => setPlaces((p) => Math.min(4, Math.max(1, choisi.places_restantes), p + 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">+</Text></Pressable>
            </View>
          </View>
          <Pressable onPress={reserver} disabled={enCours || !(choisi.dans_la_zone && choisi.places_restantes > 0)} className="items-center justify-center rounded-full disabled:opacity-50" style={{ height: 52, backgroundColor: '#0d3b34' }}>
            {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Réserver {places} place{places > 1 ? 's' : ''} · {(choisi.prix_par_place_xof * places).toLocaleString('fr-FR')} FCFA</Text>}
          </Pressable>
          <Text className="text-[11px]" style={{ color: 'rgba(0,0,0,0.4)' }}>Le prix se règle directement au chauffeur à la montée.</Text>
        </View>
      )}
    </View>
  );
}

function MesReservations({ userId, declencheur }: { userId: string; declencheur: number }) {
  const router = useRouter();
  const [liste, setListe] = useState<MaReservationVoyage[]>([]);
  const [voyages, setVoyages] = useState<Record<string, InfoVoyage>>({});
  const [chauffeurs, setChauffeurs] = useState<Record<string, InfosChauffeur | null>>({});
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);
  const [occupee, setOccupee] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setVersion((n) => n + 1);
    }, [])
  );

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const l = await chargerMesReservationsVoyage(userId);
        const vs = await chargerVoyagesParIds(l.map((r) => r.voyage_id));
        const acceptees = l.filter((r) => r.statut === 'acceptee');
        const infos = await Promise.all(acceptees.map((r) => infosChauffeurDeMaReservation(r.id).catch(() => null)));
        if (annule) return;
        setListe(l);
        setVoyages(vs);
        setChauffeurs(Object.fromEntries(acceptees.map((r, i) => [r.id, infos[i]])));
      } catch (e) {
        if (!annule) Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, declencheur, version]);

  // Une réservation qui change (acceptée, refusée…) met la liste à jour sans rouvrir l'écran.
  useEffect(() => {
    const canal = supabase
      .channel(`mes-reservations-voyage-${userId}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'voyages_reservations', filter: `passager_id=eq.${userId}` }, () => setVersion((n) => n + 1))
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId]);

  async function annuler(id: string) {
    setOccupee(id);
    try {
      await annulerReservationVoyage(id);
      setVersion((n) => n + 1);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Annulation impossible.');
    } finally {
      setOccupee(null);
    }
  }

  if (chargement) return <ActivityIndicator color={VERT} />;
  if (liste.length === 0) return <Text className="text-[13px] text-center py-6" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucune réservation pour l’instant.</Text>;
  return (
    <View className="gap-3">
      {liste.map((r) => {
        const v = voyages[r.voyage_id];
        const ch = chauffeurs[r.id];
        const c = COULEUR_STATUT[r.statut];
        const actif = r.statut === 'en_attente' || r.statut === 'acceptee';
        return (
          <View key={r.id} className="bg-white rounded-[18px] p-3.5 gap-1.5">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 min-w-0">
                <Text className="text-[14px] font-black text-[#1A1A1A]">{v ? `${v.depart_libelle} → ${v.destination_libelle}` : 'Voyage terminé ou annulé'}</Text>
                <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  {r.places} place{r.places > 1 ? 's' : ''} · prise en charge : {r.prise_libelle}{v ? ` · départ ${heureCourte(v.heure_depart)}` : ''}
                </Text>
              </View>
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.fond }}>
                <Text className="text-[11px] font-extrabold" style={{ color: c.texte }}>{LIBELLE_STATUT[r.statut]}</Text>
              </View>
            </View>
            {r.statut === 'acceptee' && v ? (
              <Text className="text-[12px] text-[#1A1A1A]">{(v.prix_par_place_xof * r.places).toLocaleString('fr-FR')} FCFA à régler au chauffeur à la montée.</Text>
            ) : null}
            {ch ? (
              <View className="rounded-[12px] p-2.5 gap-0.5" style={{ backgroundColor: '#ECFDF5' }}>
                <Text className="text-[12px] font-black text-[#1A1A1A]">{ch.chauffeur_nom || 'Chauffeur'}{ch.telephone ? ` · ${ch.telephone}` : ''}</Text>
                <Text className="text-[12px] text-[#1A1A1A]">{ch.marque_modele} · plaque {ch.immatriculation}</Text>
                <Text className="text-[10.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Vérifie la plaque avant de monter.</Text>
              </View>
            ) : null}
            {r.statut === 'acceptee' && v && v.statut === 'en_route' ? (
              <Pressable onPress={() => router.push({ pathname: '/marketplace/voyage-suivi', params: { voyageId: v.id } } as Href)} className="items-center justify-center rounded-full" style={{ height: 46, backgroundColor: '#2563EB' }}>
                <Text className="text-[14px] font-black text-white">Suivre le chauffeur</Text>
              </Pressable>
            ) : null}
            {actif && v && v.statut === 'ouvert' ? (
              <Pressable onPress={() => annuler(r.id)} disabled={occupee === r.id} hitSlop={6} className="self-start py-0.5 disabled:opacity-60">
                <Text className="text-[12.5px] font-bold text-red-600">Annuler ma réservation</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function VoyagesScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const [onglet, setOnglet] = useState<'chercher' | 'reservations'>('chercher');
  const [declencheur, setDeclencheur] = useState(0);

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Voyages" />
        {!userId ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour chercher et réserver un voyage.</Text>
          </View>
        ) : (
          <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-3.5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="flex-row gap-2">
              {([['chercher', 'Chercher un voyage'], ['reservations', 'Mes réservations']] as const).map(([id, libelle]) => (
                <Pressable key={id} onPress={() => setOnglet(id)} className="flex-1 items-center rounded-full py-2.5" style={{ backgroundColor: onglet === id ? '#0d3b34' : '#fff' }}>
                  <Text className="text-[13px] font-black" style={{ color: onglet === id ? '#fff' : '#1A1A1A' }}>{libelle}</Text>
                </Pressable>
              ))}
            </View>
            {onglet === 'chercher' ? <Chercher onReserve={() => setDeclencheur((n) => n + 1)} /> : <MesReservations userId={userId} declencheur={declencheur} />}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
