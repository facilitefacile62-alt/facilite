import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import {
  LIBELLES_STATUT_GROUPAGE,
  ZONES_GROUPAGE,
  annulerGroupage,
  chargerMesGroupages,
  demarrerGroupage,
  heureLisible,
  listerCommandesDeMonGroupage,
  publierGroupage,
  repondreCommandeGroupage,
  terminerGroupage,
  type CommandeDeGroupage,
  type Groupage,
  type ZoneGroupage,
} from '@/lib/groupages';
import { chargerMonStatutLivreur } from '@/lib/livraison';

// « Mes groupages » (livreur) — port de GroupagesLivreur.jsx (web). Le livreur
// annonce une tournée (départ, destination, heure, places, prix), puis accepte
// ou refuse chaque commande qui demande à la rejoindre, part, et termine.
// Départ et destination se choisissent parmi des zones (l'app n'a pas de
// sélection de point sur la carte) ; « Ma position » donne un départ exact. Nom,
// téléphone et adresse de l'acheteur n'apparaissent qu'après acceptation.
const VERT = '#10B981';
const FOND_STATUT: Record<Groupage['statut'], { fond: string; texte: string }> = {
  ouvert: { fond: '#D1FAE5', texte: '#047857' },
  en_route: { fond: '#DBEAFE', texte: '#1D4ED8' },
  termine: { fond: '#F3F4F6', texte: '#4B5563' },
  annule: { fond: '#FEE2E2', texte: '#B91C1C' },
};

function Puce({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-2"
      style={{ backgroundColor: actif ? '#0d3b34' : '#fff', borderWidth: 1, borderColor: actif ? '#0d3b34' : '#E5E7EB' }}>
      <Text className="text-[12.5px] font-bold" style={{ color: actif ? '#fff' : '#1A1A1A' }}>{libelle}</Text>
    </Pressable>
  );
}

function heureParDefaut(): Date {
  const d = new Date(Date.now() + 2 * 3600e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

function CarteGroupage({ g, onChange }: { g: Groupage; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [commandes, setCommandes] = useState<CommandeDeGroupage[]>([]);
  const [occupe, setOccupe] = useState(false);
  const actif = g.statut === 'ouvert' || g.statut === 'en_route';
  const styleStatut = FOND_STATUT[g.statut];

  const chargerCommandes = useCallback(async () => {
    try {
      setCommandes(await listerCommandesDeMonGroupage(g.id));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [g.id]);

  async function agir(action: () => Promise<void>, rechargerCommandes: boolean) {
    setOccupe(true);
    try {
      await action();
      onChange();
      if (rechargerCommandes) await chargerCommandes();
    } catch (e) {
      Alert.alert('Action impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setOccupe(false);
    }
  }

  return (
    <View className="bg-white rounded-[20px] p-3.5 gap-2.5">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-[15px] font-black text-[#1A1A1A]">
            {g.depart_libelle} → {g.destination_libelle}
          </Text>
          <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
            {heureLisible(g.heure_depart)} · {g.places_max} place{g.places_max > 1 ? 's' : ''} · {g.frais_par_livraison_xof.toLocaleString('fr-FR')} FCFA par livraison
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: styleStatut.fond }}>
          <Text className="text-[11px] font-extrabold" style={{ color: styleStatut.texte }}>{LIBELLES_STATUT_GROUPAGE[g.statut]}</Text>
        </View>
      </View>

      {actif && (
        <Pressable
          onPress={() => {
            const suivant = !ouvert;
            setOuvert(suivant);
            if (suivant) chargerCommandes();
          }}>
          <Text className="text-[12.5px] font-bold" style={{ color: '#1D4ED8' }}>{ouvert ? 'Masquer les commandes' : 'Voir les commandes'}</Text>
        </Pressable>
      )}

      {ouvert && (
        <View className="gap-2">
          {commandes.length === 0 ? (
            <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucune commande pour l’instant.</Text>
          ) : (
            commandes.map((c) => (
              <View key={c.id} className="rounded-[14px] p-3 gap-1" style={{ backgroundColor: '#F6F4EE' }}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-[13px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>{c.item_titre} × {c.quantite}</Text>
                  <Text className="text-[11px] font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {c.groupage_decision === 'acceptee' ? 'Acceptée' : c.groupage_decision === 'refusee' ? 'Refusée' : 'À accepter'}
                  </Text>
                </View>
                <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.6)' }}>
                  Retrait : {c.boutique_nom}{c.boutique_quartier ? `, ${c.boutique_quartier}` : ''}
                </Text>
                {c.groupage_decision === 'acceptee' ? (
                  <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.6)' }}>
                    {c.acheteur_nom} · {c.acheteur_telephone} · {c.adresse}
                  </Text>
                ) : (
                  <Text className="text-[11px] italic" style={{ color: 'rgba(0,0,0,0.4)' }}>Nom, téléphone et adresse visibles après acceptation.</Text>
                )}
                {g.statut === 'ouvert' && c.groupage_decision === 'en_attente' && (
                  <View className="flex-row gap-2 pt-1">
                    <Pressable onPress={() => agir(() => repondreCommandeGroupage(c.id, true), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 40, backgroundColor: VERT }}>
                      <Text className="text-[13px] font-black text-white">Accepter</Text>
                    </Pressable>
                    <Pressable onPress={() => agir(() => repondreCommandeGroupage(c.id, false), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 40, backgroundColor: '#E5E7EB' }}>
                      <Text className="text-[13px] font-black text-[#1A1A1A]">Refuser</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
          {g.statut === 'en_route' && (
            <Text className="text-[11.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Tes livraisons sont dans « Mes livraisons en cours » : récupère, livre, puis termine le groupage.
            </Text>
          )}
        </View>
      )}

      {g.statut === 'ouvert' && (
        <View className="flex-row gap-2 pt-1">
          <Pressable onPress={() => agir(() => demarrerGroupage(g.id), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 46, backgroundColor: '#0d3b34' }}>
            {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-black text-white">Je pars</Text>}
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('Annuler ce groupage ?', 'Les commandes rattachées redeviennent disponibles pour les autres livreurs.', [
                { text: 'Non', style: 'cancel' },
                { text: 'Oui, annuler', style: 'destructive', onPress: () => agir(() => annulerGroupage(g.id), false) },
              ])
            }
            disabled={occupe}
            className="items-center justify-center rounded-full px-4 disabled:opacity-60"
            style={{ height: 46, backgroundColor: '#F3F4F6' }}>
            <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
          </Pressable>
        </View>
      )}
      {g.statut === 'en_route' && (
        <Pressable onPress={() => agir(() => terminerGroupage(g.id), false)} disabled={occupe} className="items-center justify-center rounded-full disabled:opacity-60" style={{ height: 46, backgroundColor: VERT }}>
          {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-black text-white">Terminer le groupage</Text>}
        </Pressable>
      )}
    </View>
  );
}

export default function MesGroupagesScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const [estLivreur, setEstLivreur] = useState<boolean | null>(null);
  const [groupages, setGroupages] = useState<Groupage[]>([]);
  const [formulaire, setFormulaire] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const [depart, setDepart] = useState<ZoneGroupage | null>(null);
  const [destination, setDestination] = useState<ZoneGroupage | null>(null);
  const [heure, setHeure] = useState<Date>(heureParDefaut);
  const [places, setPlaces] = useState(5);
  const [frais, setFrais] = useState('1000');
  const [rayonDepart, setRayonDepart] = useState(3);
  const [rayonDestination, setRayonDestination] = useState(5);
  const [note, setNote] = useState('');

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const etat = await chargerMonStatutLivreur(userId);
      const actif = etat.livreur?.statut === 'actif';
      setEstLivreur(actif);
      if (actif) setGroupages(await chargerMesGroupages(userId));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  async function maPosition() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Localisation refusée', 'Autorisez la localisation ou choisissez une zone de départ.');
      return;
    }
    const p = await Location.getCurrentPositionAsync({});
    setDepart({ nom: 'Ma position', lat: p.coords.latitude, lng: p.coords.longitude });
  }

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const m: MarqueurCarte[] = [];
    if (depart) m.push({ id: 'A', lat: depart.lat, lng: depart.lng, couleur: '#10B981', libelle: `A · ${depart.nom}` });
    if (destination) m.push({ id: 'B', lat: destination.lat, lng: destination.lng, couleur: '#EF4444', libelle: `B · ${destination.nom}` });
    return m;
  }, [depart, destination]);

  async function publier() {
    if (!depart || !destination) {
      Alert.alert('Départ et destination', 'Choisissez le départ (A) et la destination (B).');
      return;
    }
    setEnCours(true);
    try {
      await publierGroupage({
        departLibelle: depart.nom,
        departLat: depart.lat,
        departLng: depart.lng,
        destinationLibelle: destination.nom,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        heureDepart: heure,
        placesMax: places,
        fraisXof: Number(frais.replace(/\D/g, '')) || 0,
        rayonDepartKm: rayonDepart,
        rayonDestinationKm: rayonDestination,
        note: note.trim(),
      });
      setFormulaire(false);
      setDepart(null);
      setDestination(null);
      setNote('');
      setHeure(heureParDefaut());
      Alert.alert('Groupage annoncé', 'Les acheteurs de la zone peuvent maintenant le rejoindre.');
      await recharger();
    } catch (e) {
      Alert.alert('Annonce impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }

  function contenu() {
    if (!userId) {
      return (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer vos groupages.</Text>
        </View>
      );
    }
    if (estLivreur === null) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      );
    }
    if (!estLivreur) {
      return (
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <Text style={{ fontSize: 40 }}>🛵</Text>
          <Text className="text-[14px] font-bold text-[#1A1A1A] text-center">Réservé aux livreurs actifs</Text>
        </View>
      );
    }
    return (
      <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-3.5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
          Annonce une tournée : les acheteurs qui vont dans ta direction rejoignent ton trajet au lieu de payer une course à part.
        </Text>

        <Pressable onPress={() => setFormulaire((o) => !o)} className="items-center justify-center rounded-full" style={{ height: 50, backgroundColor: '#0d3b34' }}>
          <Text className="text-[15px] font-black text-white">{formulaire ? 'Fermer' : '+ Annoncer un groupage'}</Text>
        </Pressable>

        {formulaire && (
          <View className="bg-white rounded-[20px] p-3.5 gap-3">
            <View className="overflow-hidden" style={{ height: 190, borderRadius: 16, backgroundColor: '#E8E4DA' }}>
              <CarteLeaflet
                centre={{ lat: depart?.lat ?? 14.72, lng: depart?.lng ?? -17.3 }}
                zoom={10}
                marqueurs={marqueurs}
                ajuster
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            </View>

            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Départ (A)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Puce libelle="📍 Ma position" actif={depart?.nom === 'Ma position'} onPress={maPosition} />
              {ZONES_GROUPAGE.map((z) => (
                <Puce key={`a-${z.nom}`} libelle={z.nom} actif={depart?.nom === z.nom} onPress={() => setDepart(z)} />
              ))}
            </ScrollView>

            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Destination (B)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {ZONES_GROUPAGE.map((z) => (
                <Puce key={`b-${z.nom}`} libelle={z.nom} actif={destination?.nom === z.nom} onPress={() => setDestination(z)} />
              ))}
            </ScrollView>

            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Heure de départ : {heureLisible(heure.toISOString())}</Text>
            <View className="flex-row gap-2">
              {[
                { l: '−30 min', d: -30 },
                { l: '+30 min', d: 30 },
                { l: '+1 h', d: 60 },
                { l: '+1 jour', d: 1440 },
              ].map((b) => (
                <Pressable
                  key={b.l}
                  onPress={() => setHeure((h) => new Date(Math.max(Date.now() + 15 * 60e3, h.getTime() + b.d * 60e3)))}
                  className="flex-1 items-center rounded-full py-2"
                  style={{ backgroundColor: '#F3F4F6' }}>
                  <Text className="text-[12px] font-bold text-[#1A1A1A]">{b.l}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-[12.5px] font-black text-[#1A1A1A]">Places : {places}</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setPlaces((p) => Math.max(1, p - 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}>
                  <Ionicons name="remove" size={18} color="#1A1A1A" />
                </Pressable>
                <Pressable onPress={() => setPlaces((p) => Math.min(30, p + 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}>
                  <Ionicons name="add" size={18} color="#1A1A1A" />
                </Pressable>
              </View>
            </View>

            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Prix par livraison (FCFA)</Text>
            <TextInput value={frais} onChangeText={setFrais} keyboardType="number-pad" className="rounded-[14px] px-3.5 text-[14px] text-[#1A1A1A]" style={{ height: 46, backgroundColor: '#F6F4EE' }} />

            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Retrait : boutiques à moins de</Text>
            <View className="flex-row gap-2 flex-wrap">
              {[1, 2, 3, 5, 10].map((k) => <Puce key={`rd-${k}`} libelle={`${k} km`} actif={rayonDepart === k} onPress={() => setRayonDepart(k)} />)}
            </View>
            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Livraison : clients à moins de</Text>
            <View className="flex-row gap-2 flex-wrap">
              {[2, 3, 5, 10, 15].map((k) => <Puce key={`rb-${k}`} libelle={`${k} km`} actif={rayonDestination === k} onPress={() => setRayonDestination(k)} />)}
            </View>

            <TextInput value={note} onChangeText={setNote} placeholder="Note (facultatif) — ex. moto, petits colis" maxLength={200} className="rounded-[14px] px-3.5 text-[14px] text-[#1A1A1A]" style={{ height: 46, backgroundColor: '#F6F4EE' }} />

            <Pressable onPress={publier} disabled={enCours} className="items-center justify-center rounded-full disabled:opacity-60" style={{ height: 50, backgroundColor: VERT }}>
              {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Annoncer ce groupage</Text>}
            </Pressable>
          </View>
        )}

        {groupages.length === 0 ? (
          <View className="items-center py-8 gap-1.5">
            <Text style={{ fontSize: 34 }}>🚚</Text>
            <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucun groupage pour le moment</Text>
          </View>
        ) : (
          groupages.map((g) => <CarteGroupage key={g.id} g={g} onChange={recharger} />)
        )}
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes groupages" sousTitre={estLivreur ? 'Livreur actif' : undefined} />
        {contenu()}
      </View>
    </View>
  );
}
