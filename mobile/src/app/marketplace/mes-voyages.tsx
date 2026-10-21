import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import CarteLeaflet, { type MarqueurCarte } from '@/components/CarteLeaflet';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import { useAuth } from '@/context/AuthContext';
import { ZONES_GROUPAGE, type ZoneGroupage } from '@/lib/groupages';
import {
  LIBELLES_STATUT_VOYAGE,
  LIBELLES_VEHICULE_CHAUFFEUR,
  annulerVoyage,
  chargerMesVoyages,
  chargerMonStatutChauffeur,
  demanderDevenirChauffeur,
  demarrerVoyage,
  envoyerDocumentChauffeur,
  envoyerPositionVoyage,
  heureCourte,
  listerReservationsDeMonVoyage,
  publierVoyage,
  repondreReservationVoyage,
  terminerVoyage,
  type Chauffeur,
  type DemandeChauffeur,
  type ReservationDeMonVoyage,
  type TypeVehiculeChauffeur,
  type Voyage,
} from '@/lib/voyages';

// « Mes voyages » (chauffeur) — port de EspaceChauffeur.jsx (web). Pas encore chauffeur :
// demande avec véhicule, plaque, places et au moins deux justificatifs (envoyés dans un
// espace privé), examinée par un administrateur. Chauffeur validé : annoncer un voyage,
// accepter ou refuser les réservations, partir (ta position est alors partagée avec les
// passagers acceptés tant que cet écran reste ouvert), terminer. Les règles sont
// revérifiées en base ; Facilité ne gère aucun argent (le prix par place se règle à la montée).
const VERT = '#10B981';
const COULEUR_STATUT = {
  ouvert: { fond: '#D1FAE5', texte: '#047857' },
  en_route: { fond: '#DBEAFE', texte: '#1D4ED8' },
  termine: { fond: '#F3F4F6', texte: '#4B5563' },
  annule: { fond: '#FEE2E2', texte: '#B91C1C' },
} as const;
const TYPES_DOCUMENT = ['application/pdf', 'image/jpeg', 'image/png'];

type Document = { uri: string; nom: string; type: string };

function Puce({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-full px-3 py-2" style={{ backgroundColor: actif ? '#0d3b34' : '#fff', borderWidth: 1, borderColor: actif ? '#0d3b34' : '#E5E7EB' }}>
      <Text className="text-[12.5px] font-bold" style={{ color: actif ? '#fff' : '#1A1A1A' }}>{libelle}</Text>
    </Pressable>
  );
}

const heureParDefaut = () => {
  const d = new Date(Date.now() + 2 * 3600e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
};

function Champ({ valeur, onChange, placeholder, clavier }: { valeur: string; onChange: (v: string) => void; placeholder: string; clavier?: 'default' | 'phone-pad' | 'number-pad' }) {
  return <TextInput value={valeur} onChangeText={onChange} placeholder={placeholder} keyboardType={clavier ?? 'default'} className="rounded-[14px] px-3.5 text-[14px] text-[#1A1A1A]" style={{ height: 46, backgroundColor: '#F6F4EE' }} />;
}

// ---------------------------------------------------------------------------
function DemandeChauffeurCarte({ userId, demande, onEnvoyee }: { userId: string; demande: DemandeChauffeur | null; onEnvoyee: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [zone, setZone] = useState('');
  const [type, setType] = useState<TypeVehiculeChauffeur>('voiture');
  const [marque, setMarque] = useState('');
  const [plaque, setPlaque] = useState('');
  const [places, setPlaces] = useState(3);
  const [docs, setDocs] = useState<Document[]>([]);
  const [enCours, setEnCours] = useState(false);

  async function ajouterDocument() {
    const r = await DocumentPicker.getDocumentAsync({ type: TYPES_DOCUMENT, copyToCacheDirectory: true });
    const f = r.assets?.[0];
    if (!r.canceled && f) setDocs((d) => [...d, { uri: f.uri, nom: f.name, type: f.mimeType || 'application/octet-stream' }].slice(0, 5));
  }

  async function envoyer() {
    if (!nom.trim() || !tel.trim() || !zone.trim() || !marque.trim() || !plaque.trim()) {
      Alert.alert('Informations manquantes', 'Nom, téléphone, zone, véhicule et plaque sont obligatoires.');
      return;
    }
    if (docs.length < 2) {
      Alert.alert('Justificatifs', 'Joignez au moins deux justificatifs : permis de conduire et assurance.');
      return;
    }
    setEnCours(true);
    try {
      const urls: string[] = [];
      for (const d of docs) {
        const ext = d.nom.includes('.') ? d.nom.split('.').pop()!.toLowerCase() : d.type === 'application/pdf' ? 'pdf' : 'jpg';
        urls.push(await envoyerDocumentChauffeur(d.uri, userId, ext, d.type));
      }
      await demanderDevenirChauffeur({ nomComplet: nom, telephone: tel, villeZone: zone, typeVehicule: type, marqueModele: marque, immatriculation: plaque, placesPassagers: type === 'moto' ? 1 : places, documentUrls: urls });
      setOuvert(false);
      onEnvoyee();
    } catch (e) {
      Alert.alert('Envoi impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }

  if (demande?.status === 'pending') {
    return (
      <View className="rounded-[18px] p-4 gap-1" style={{ backgroundColor: '#FEF3C7' }}>
        <Text className="text-[14px] font-black" style={{ color: '#92400E' }}>Demande de chauffeur en cours d’examen</Text>
        <Text className="text-[12.5px]" style={{ color: '#B45309' }}>Un administrateur vérifie vos justificatifs. Vous serez prévenu dès la décision.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {demande?.status === 'rejected' ? (
        <Text className="text-[12.5px] font-bold text-red-600">Votre dernière demande a été refusée{demande.rejection_reason ? ` : ${demande.rejection_reason}` : ''}. Vous pouvez en déposer une nouvelle.</Text>
      ) : null}
      {!ouvert ? (
        <Pressable onPress={() => setOuvert(true)} className="items-center justify-center rounded-full" style={{ height: 52, backgroundColor: '#0d3b34' }}>
          <Text className="text-[15px] font-black text-white">Devenir chauffeur</Text>
        </Pressable>
      ) : (
        <View className="bg-white rounded-[20px] p-3.5 gap-3">
          <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.55)' }}>Transporter des personnes demande une validation : un administrateur contrôle vos justificatifs avant de vous ouvrir les voyages.</Text>
          <Champ valeur={nom} onChange={setNom} placeholder="Nom complet" />
          <Champ valeur={tel} onChange={setTel} placeholder="Téléphone" clavier="phone-pad" />
          <Champ valeur={zone} onChange={setZone} placeholder="Ville / zone (ex. Dakar)" />
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Véhicule</Text>
          <View className="flex-row gap-2 flex-wrap">
            {(Object.keys(LIBELLES_VEHICULE_CHAUFFEUR) as TypeVehiculeChauffeur[]).map((t) => <Puce key={t} libelle={LIBELLES_VEHICULE_CHAUFFEUR[t]} actif={type === t} onPress={() => { setType(t); if (t === 'moto') setPlaces(1); }} />)}
          </View>
          <Champ valeur={marque} onChange={setMarque} placeholder="Marque et modèle (ex. Toyota Corolla)" />
          <Champ valeur={plaque} onChange={setPlaque} placeholder="Plaque (ex. DK-123-AB)" />
          {type !== 'moto' && (
            <View className="flex-row items-center justify-between">
              <Text className="text-[12.5px] font-black text-[#1A1A1A]">Places passagers : {places}</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setPlaces((p) => Math.max(1, p - 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">−</Text></Pressable>
                <Pressable onPress={() => setPlaces((p) => Math.min(14, p + 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">+</Text></Pressable>
              </View>
            </View>
          )}
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Justificatifs ({docs.length}/2 minimum)</Text>
          {docs.map((d, i) => (
            <Text key={`${d.nom}-${i}`} className="text-[12px]" style={{ color: 'rgba(0,0,0,0.6)' }} numberOfLines={1}>📎 {d.nom}</Text>
          ))}
          <Pressable onPress={ajouterDocument} className="items-center justify-center rounded-full" style={{ height: 44, backgroundColor: '#E8F0FE' }}>
            <Text className="text-[13px] font-black" style={{ color: '#1D4ED8' }}>+ Ajouter un justificatif (permis, assurance…)</Text>
          </Pressable>
          <Pressable onPress={envoyer} disabled={enCours} className="items-center justify-center rounded-full disabled:opacity-60" style={{ height: 50, backgroundColor: VERT }}>
            {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Envoyer ma demande</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
function CarteVoyage({ v, onChange }: { v: Voyage; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [reservations, setReservations] = useState<ReservationDeMonVoyage[]>([]);
  const [occupe, setOccupe] = useState(false);
  const actif = v.statut === 'ouvert' || v.statut === 'en_route';
  const c = COULEUR_STATUT[v.statut];

  const chargerReservations = useCallback(async () => {
    try {
      setReservations(await listerReservationsDeMonVoyage(v.id));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [v.id]);

  async function agir(action: () => Promise<void>, recharger: boolean) {
    setOccupe(true);
    try {
      await action();
      onChange();
      if (recharger) await chargerReservations();
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
          <Text className="text-[15px] font-black text-[#1A1A1A]">{v.depart_libelle} → {v.destination_libelle}</Text>
          <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
            {heureCourte(v.heure_depart)} · {v.places_max} place{v.places_max > 1 ? 's' : ''} · {v.prix_par_place_xof.toLocaleString('fr-FR')} FCFA par place
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.fond }}>
          <Text className="text-[11px] font-extrabold" style={{ color: c.texte }}>{LIBELLES_STATUT_VOYAGE[v.statut]}</Text>
        </View>
      </View>

      {actif && (
        <Pressable onPress={() => { const s = !ouvert; setOuvert(s); if (s) chargerReservations(); }}>
          <Text className="text-[12.5px] font-bold" style={{ color: '#1D4ED8' }}>{ouvert ? 'Masquer les réservations' : 'Voir les réservations'}</Text>
        </Pressable>
      )}

      {ouvert && (
        <View className="gap-2">
          {reservations.length === 0 ? (
            <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucune réservation pour l’instant.</Text>
          ) : (
            reservations.map((r) => (
              <View key={r.id} className="rounded-[14px] p-3 gap-1" style={{ backgroundColor: '#F6F4EE' }}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-[13px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>{r.places} place{r.places > 1 ? 's' : ''} · {r.prise_libelle}</Text>
                  <Text className="text-[11px] font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    {r.statut === 'acceptee' ? 'Acceptée' : r.statut === 'refusee' ? 'Refusée' : r.statut === 'annulee' ? 'Annulée' : 'À accepter'}
                  </Text>
                </View>
                {r.statut === 'acceptee' ? (
                  <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.6)' }}>{r.passager_nom || 'Passager'}{r.passager_telephone ? ` · ${r.passager_telephone}` : ''}</Text>
                ) : (
                  <Text className="text-[11px] italic" style={{ color: 'rgba(0,0,0,0.4)' }}>Nom et téléphone visibles après acceptation.</Text>
                )}
                {v.statut === 'ouvert' && r.statut === 'en_attente' && (
                  <View className="flex-row gap-2 pt-1">
                    <Pressable onPress={() => agir(() => repondreReservationVoyage(r.id, true), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 40, backgroundColor: VERT }}>
                      <Text className="text-[13px] font-black text-white">Accepter</Text>
                    </Pressable>
                    <Pressable onPress={() => agir(() => repondreReservationVoyage(r.id, false), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 40, backgroundColor: '#E5E7EB' }}>
                      <Text className="text-[13px] font-black text-[#1A1A1A]">Refuser</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {v.statut === 'en_route' && (
        <Text className="text-[11.5px] font-bold" style={{ color: '#059669' }}>Ta position est partagée avec les passagers acceptés tant que cet écran reste ouvert.</Text>
      )}

      {v.statut === 'ouvert' && (
        <View className="flex-row gap-2 pt-1">
          <Pressable onPress={() => agir(() => demarrerVoyage(v.id), true)} disabled={occupe} className="flex-1 items-center justify-center rounded-full disabled:opacity-60" style={{ height: 46, backgroundColor: '#0d3b34' }}>
            {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-black text-white">Je pars</Text>}
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Annuler ce voyage ?', 'Les passagers seront prévenus.', [{ text: 'Non', style: 'cancel' }, { text: 'Oui, annuler', style: 'destructive', onPress: () => agir(() => annulerVoyage(v.id), false) }])}
            disabled={occupe}
            className="items-center justify-center rounded-full px-4 disabled:opacity-60"
            style={{ height: 46, backgroundColor: '#F3F4F6' }}>
            <Text className="text-[13px] font-bold text-[#1A1A1A]">Annuler</Text>
          </Pressable>
        </View>
      )}
      {v.statut === 'en_route' && (
        <Pressable onPress={() => agir(() => terminerVoyage(v.id), false)} disabled={occupe} className="items-center justify-center rounded-full disabled:opacity-60" style={{ height: 46, backgroundColor: VERT }}>
          {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-black text-white">Terminer le voyage</Text>}
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
function EspaceVoyages({ userId, chauffeur }: { userId: string; chauffeur: Chauffeur }) {
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [formulaire, setFormulaire] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [depart, setDepart] = useState<ZoneGroupage | null>(null);
  const [destination, setDestination] = useState<ZoneGroupage | null>(null);
  const [heure, setHeure] = useState<Date>(heureParDefaut);
  const [places, setPlaces] = useState(Math.min(3, chauffeur.places_passagers ?? 3));
  const [prix, setPrix] = useState('1000');
  const [rayonPrise, setRayonPrise] = useState(3);
  const [rayonDest, setRayonDest] = useState(5);
  const [note, setNote] = useState('');

  const recharger = useCallback(async () => {
    try {
      setVoyages(await chargerMesVoyages(userId));
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  // Partage de la position pendant un voyage EN ROUTE : seuls les passagers acceptés la voient (RLS).
  const voyageEnRoute = voyages.find((v) => v.statut === 'en_route')?.id ?? null;
  useEffect(() => {
    if (!voyageEnRoute) return;
    let annule = false;
    let abonnement: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      abonnement = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 20 }, (p) => {
        envoyerPositionVoyage(voyageEnRoute, p.coords.latitude, p.coords.longitude).catch(() => {});
      });
      if (annule) abonnement.remove();
    })();
    return () => {
      annule = true;
      abonnement?.remove();
    };
  }, [voyageEnRoute]);

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
      await publierVoyage({
        departLibelle: depart.nom, departLat: depart.lat, departLng: depart.lng,
        destinationLibelle: destination.nom, destinationLat: destination.lat, destinationLng: destination.lng,
        heureDepart: heure, placesMax: places, prixParPlaceXof: Number(prix.replace(/\D/g, '')) || 0,
        rayonPriseKm: rayonPrise, rayonDestinationKm: rayonDest, note: note.trim(),
      });
      setFormulaire(false);
      setDepart(null);
      setDestination(null);
      setNote('');
      setHeure(heureParDefaut());
      Alert.alert('Voyage annoncé', 'Les passagers de la zone peuvent maintenant réserver.');
      await recharger();
    } catch (e) {
      Alert.alert('Annonce impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  }

  const capacite = chauffeur.places_passagers ?? 1;
  return (
    <View className="gap-3.5">
      <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
        Chauffeur validé : {chauffeur.marque_modele} ({chauffeur.immatriculation}), {capacite} place{capacite > 1 ? 's' : ''}. Annonce un trajet : les passagers qui vont dans ta direction réservent une place.
      </Text>
      <Pressable onPress={() => setFormulaire((o) => !o)} className="items-center justify-center rounded-full" style={{ height: 50, backgroundColor: '#0d3b34' }}>
        <Text className="text-[15px] font-black text-white">{formulaire ? 'Fermer' : '+ Annoncer un voyage'}</Text>
      </Pressable>

      {formulaire && (
        <View className="bg-white rounded-[20px] p-3.5 gap-3">
          <View className="overflow-hidden" style={{ height: 190, borderRadius: 16, backgroundColor: '#E8E4DA' }}>
            <CarteLeaflet centre={{ lat: depart?.lat ?? 14.72, lng: depart?.lng ?? -17.3 }} zoom={10} marqueurs={marqueurs} ajuster style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </View>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Départ (A)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Puce libelle="📍 Ma position" actif={depart?.nom === 'Ma position'} onPress={maPosition} />
            {ZONES_GROUPAGE.map((z) => <Puce key={`a-${z.nom}`} libelle={z.nom} actif={depart?.nom === z.nom} onPress={() => setDepart(z)} />)}
          </ScrollView>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Destination (B)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {ZONES_GROUPAGE.map((z) => <Puce key={`b-${z.nom}`} libelle={z.nom} actif={destination?.nom === z.nom} onPress={() => setDestination(z)} />)}
          </ScrollView>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Heure de départ : {heureCourte(heure.toISOString())}</Text>
          <View className="flex-row gap-2">
            {[{ l: '−30 min', d: -30 }, { l: '+30 min', d: 30 }, { l: '+1 h', d: 60 }, { l: '+1 jour', d: 1440 }].map((b) => (
              <Pressable key={b.l} onPress={() => setHeure((h) => new Date(Math.max(Date.now() + 15 * 60e3, h.getTime() + b.d * 60e3)))} className="flex-1 items-center rounded-full py-2" style={{ backgroundColor: '#F3F4F6' }}>
                <Text className="text-[12px] font-bold text-[#1A1A1A]">{b.l}</Text>
              </Pressable>
            ))}
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-[12.5px] font-black text-[#1A1A1A]">Places : {places} (max {capacite})</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setPlaces((p) => Math.max(1, p - 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">−</Text></Pressable>
              <Pressable onPress={() => setPlaces((p) => Math.min(capacite, p + 1))} className="items-center justify-center rounded-full" style={{ width: 38, height: 38, backgroundColor: '#F3F4F6' }}><Text className="text-[18px] font-black">+</Text></Pressable>
            </View>
          </View>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Prix par place (FCFA)</Text>
          <Champ valeur={prix} onChange={setPrix} placeholder="1000" clavier="number-pad" />
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Prise en charge : passagers à moins de</Text>
          <View className="flex-row gap-2 flex-wrap">{[1, 2, 3, 5, 10].map((k) => <Puce key={`rp-${k}`} libelle={`${k} km`} actif={rayonPrise === k} onPress={() => setRayonPrise(k)} />)}</View>
          <Text className="text-[12.5px] font-black text-[#1A1A1A]">Arrivée : destinations à moins de</Text>
          <View className="flex-row gap-2 flex-wrap">{[2, 3, 5, 10, 15].map((k) => <Puce key={`rd-${k}`} libelle={`${k} km`} actif={rayonDest === k} onPress={() => setRayonDest(k)} />)}</View>
          <Champ valeur={note} onChange={setNote} placeholder="Note (facultatif) — ex. climatisé, 1 bagage" />
          <Pressable onPress={publier} disabled={enCours} className="items-center justify-center rounded-full disabled:opacity-60" style={{ height: 50, backgroundColor: VERT }}>
            {enCours ? <ActivityIndicator color="#fff" /> : <Text className="text-[15px] font-black text-white">Annoncer ce voyage</Text>}
          </Pressable>
        </View>
      )}

      {voyages.length === 0 ? (
        <View className="items-center py-8 gap-1.5">
          <Text style={{ fontSize: 34 }}>🚗</Text>
          <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Aucun voyage pour le moment</Text>
        </View>
      ) : (
        voyages.map((v) => <CarteVoyage key={v.id} v={v} onChange={recharger} />)
      )}
    </View>
  );
}

export default function MesVoyagesScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const [etat, setEtat] = useState<{ chauffeur: Chauffeur | null; demande: DemandeChauffeur | null } | null>(null);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setVersion((n) => n + 1);
    }, [])
  );

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    chargerMonStatutChauffeur(userId)
      .then((e) => !annule && setEtat(e))
      .catch(() => !annule && setEtat({ chauffeur: null, demande: null }));
    return () => {
      annule = true;
    };
  }, [userId, version]);

  function contenu() {
    if (!userId) {
      return <Text className="text-[13.5px] text-gray-500 text-center">Connectez-vous pour gérer vos voyages.</Text>;
    }
    if (!etat) return <ActivityIndicator color={VERT} />;
    if (etat.chauffeur?.statut === 'actif') return <EspaceVoyages userId={userId} chauffeur={etat.chauffeur} />;
    if (etat.chauffeur?.statut === 'suspendu') {
      return <Text className="text-[13px] font-bold text-red-600">Votre compte chauffeur est suspendu{etat.chauffeur.motif_suspension ? ` : ${etat.chauffeur.motif_suspension}` : ''}. Contactez-nous.</Text>;
    }
    return <DemandeChauffeurCarte userId={userId} demande={etat.demande} onEnvoyee={() => setVersion((n) => n + 1)} />;
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <View className="flex-1">
        <EnteteMarketplace titre="Mes voyages" sousTitre={etat?.chauffeur?.statut === 'actif' ? 'Chauffeur validé' : undefined} />
        <ScrollView contentContainerClassName="px-4 pt-4 pb-10" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {contenu()}
        </ScrollView>
      </View>
    </View>
  );
}
