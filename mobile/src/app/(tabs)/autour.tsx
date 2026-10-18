import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteLeaflet, { type CommandesCarte, type MarqueurCarte, type PopupBoutique } from '@/components/CarteLeaflet';
import { calculerItineraire, ligneDroite, type Itineraire } from '@/lib/itineraire';
import { chargerOffresParVille, trouverVille, type GroupeVille, type ResultatAutour } from '@/lib/offresParVille';
import { SPONTANEOUS_COMPANIES } from '@/lib/spontaneousData';
import type { Position } from '@/lib/marketplace';
import { useLocalisation } from '@/lib/useLocalisation';

// « Autour de moi » de Facilité — pas celui de Locaux : ici la carte montre OÙ
// RECRUTENT LES ENTREPRISES. Un rond par ville avec son nombre d'offres ;
// un appui ouvre la liste des offres de cette ville (entreprise + poste).
// Les positions sont celles du CENTRE de chaque ville (les offres n'ont pas de
// GPS précis) et l'écran le dit. Les offres qui ne citent aucune ville connue
// (« Sénégal ») sont comptées à part.
// Refonte du 18/10/2026 : même présentation que la carte Locaux (carte sombre plein écran, ronds à
// pastille, carrousel de villes en bas), sans regroupement.
const BLEU = '#2563EB';
const VERT = '#10B981';
// Dépôts de candidature spontanée : une autre couleur que les offres, jamais mélangés avec elles.
const VIOLET = '#8B5CF6';
const DAKAR: Position = { latitude: 14.7167, longitude: -17.4677 };

// Une couleur par ville (offres), pour les distinguer d'un coup d'œil ; le violet est réservé aux candidatures spontanées.
const COULEURS_VILLES = ['#2563EB', '#F97316', '#14B8A6', '#EF4444', '#EAB308', '#EC4899', '#22C55E', '#0EA5E9'];
const couleurVille = (rang: number) => COULEURS_VILLES[rang % COULEURS_VILLES.length];

const libelleOffres = (n: number) => `${n} offre${n > 1 ? 's' : ''}`;
const libelleSpontanees = (n: number) => `${n} dépôt${n > 1 ? 's' : ''}`;

// Entreprises dont la position exacte est connue (ex. Auchan Yoff) : un marqueur à leur emplacement réel.
const LIEUX = SPONTANEOUS_COMPANIES.filter((e) => e.lat != null && e.lng != null);

type Vue = 'offres' | 'spontanees';
type GroupeSpontane = { ville: string; lat: number; lng: number; entreprises: typeof SPONTANEOUS_COMPANIES };

// Entreprises qui acceptent les candidatures spontanées, rangées par ville citée dans leur localisation
// (même règle que les offres) ; celles qui ne citent aucune ville sont comptées à part.
const { groupesSpontanes, spontanesSansVille } = (() => {
  const parVille = new Map<string, GroupeSpontane>();
  let sansVille = 0;
  for (const e of SPONTANEOUS_COMPANIES) {
    if (e.lat != null && e.lng != null) continue; // posée à son emplacement exact (voir LIEUX)
    const v = trouverVille(e.location);
    if (!v) {
      sansVille += 1;
      continue;
    }
    const g = parVille.get(v.nom) ?? { ville: v.nom, lat: v.lat, lng: v.lng, entreprises: [] };
    g.entreprises.push(e);
    parVille.set(v.nom, g);
  }
  return { groupesSpontanes: [...parVille.values()].sort((a, b) => b.entreprises.length - a.entreprises.length), spontanesSansVille: sansVille };
})();

export default function AutourFaciliteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { position, activer } = useLocalisation();
  const [resultat, setResultat] = useState<ResultatAutour | null>(null);
  const [erreur, setErreur] = useState(false);
  // Sélection : « Dakar » (offres de la ville) ou « sp:Dakar » (dépôts de candidature spontanée de la ville).
  const [selection, setSelection] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('offres');
  const [carte, setCarte] = useState<CommandesCarte | null>(null);

  useEffect(() => {
    activer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let annule = false;
    chargerOffresParVille()
      .then((r) => {
        if (!annule) setResultat(r);
      })
      .catch(() => {
        if (!annule) setErreur(true);
      });
    return () => {
      annule = true;
    };
  }, []);

  const groupes = useMemo(() => resultat?.groupes ?? [], [resultat]);
  const courant: GroupeVille | null = groupes.find((g) => g.ville === selection) ?? null;
  const lieuSel = selection?.startsWith('lieu:') ? LIEUX.find((e) => `lieu:${e.slug}` === selection) ?? null : null;
  const courantSp: GroupeSpontane | null = selection?.startsWith('sp:') ? groupesSpontanes.find((g) => `sp:${g.ville}` === selection) ?? null : null;

  const marqueurs = useMemo<MarqueurCarte[]>(() => {
    const liste: MarqueurCarte[] = groupes.map((g, rang) => ({
      id: g.ville,
      lat: g.lat,
      lng: g.lng,
      couleur: couleurVille(rang),
      libelle: g.ville,
      avatar: {
        emoji: String(g.offres.length),
        bordure: couleurVille(rang),
        sous: libelleOffres(g.offres.length),
        selectionne: selection === g.ville,
        actif: true,
      },
    }));
    groupesSpontanes.forEach((g) =>
      liste.push({
        id: `sp:${g.ville}`,
        lat: g.lat,
        lng: g.lng,
        couleur: VIOLET,
        libelle: g.ville,
        avatar: {
          emoji: String(g.entreprises.length),
          bordure: VIOLET,
          sous: libelleSpontanees(g.entreprises.length),
          selectionne: selection === `sp:${g.ville}`,
          actif: true,
        },
      })
    );
    LIEUX.forEach((e) =>
      liste.push({
        id: `lieu:${e.slug}`,
        lat: e.lat as number,
        lng: e.lng as number,
        couleur: VIOLET,
        libelle: e.company,
        avatar: { emoji: '🏬', photo: e.image_url ?? undefined, bordure: VIOLET, sous: 'Candidature spontanée', selectionne: selection === `lieu:${e.slug}`, actif: true },
      })
    );
    if (position) {
      liste.push({ id: 'moi', lat: position.latitude, lng: position.longitude, couleur: BLEU, halo: true, libelle: 'Vous êtes ici', avatar: { emoji: '🧑🏾', bordure: '#1877F2', moi: true } });
    }
    return liste;
  }, [groupes, selection, position]);

  // Bulle d'aperçu au-dessus du rond de la ville : ses offres (poste + entreprise), comme celle des boutiques.
  const popup = useMemo<PopupBoutique | null>(() => {
    if (lieuSel) {
      return {
        cle: `lieu:${lieuSel.slug}`,
        lat: lieuSel.lat as number,
        lng: lieuSel.lng as number,
        titre: lieuSel.company,
        sous: lieuSel.location,
        articles: [{ id: `sp-${lieuSel.slug}`, titre: lieuSel.domains, prix: 'Candidature spontanée', photo: lieuSel.image_url ?? undefined, icone: '🏬' }],
        action: { id: `itineraire:${lieuSel.slug}`, libelle: 'Itinéraire' },
      };
    }
    if (courantSp) {
      return {
        cle: `sp:${courantSp.ville}`,
        lat: courantSp.lat,
        lng: courantSp.lng,
        titre: courantSp.ville,
        sous: `${libelleSpontanees(courantSp.entreprises.length)} de candidature spontanée`,
        articles: courantSp.entreprises.map((e) => ({ id: `sp-${e.slug}`, titre: e.domains, prix: e.company, photo: e.image_url ?? undefined, icone: '✉️' })),
      };
    }
    if (!courant) return null;
    return {
      cle: courant.ville,
      lat: courant.lat,
      lng: courant.lng,
      titre: courant.ville,
      sous: `${libelleOffres(courant.offres.length)} · ${courant.entreprises} entreprise${courant.entreprises > 1 ? 's' : ''}`,
      articles: courant.offres.map((o) => ({ id: o.id, titre: o.titre, prix: o.entreprise, photo: o.affiche && !o.affiche.startsWith('data:') ? o.affiche : undefined, icone: '🏢' })),
    };
  }, [courant, courantSp, lieuSel]);

  const origine = position ?? DAKAR;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;

  // Itinéraire vers une entreprise posée à son emplacement exact : ligne droite tout de suite, puis le trajet routier.
  const [trajet, setTrajet] = useState<Itineraire | null>(null);
  const allerAuLieu = (slug: string) => {
    const lieu = LIEUX.find((e) => e.slug === slug);
    if (!lieu) return;
    if (!position) {
      Alert.alert('Position nécessaire', 'Activez votre position pour calculer l’itinéraire.');
      activer();
      return;
    }
    const arrivee = { latitude: lieu.lat as number, longitude: lieu.lng as number };
    setSelection(null);
    setTrajet(ligneDroite(position, arrivee));
    calculerItineraire(position, arrivee).then(setTrajet);
  };

  const choisirVille = (cle: string) => {
    setSelection(cle);
    const lieu = cle.startsWith('lieu:') ? LIEUX.find((e) => `lieu:${e.slug}` === cle) : undefined;
    const sp = cle.startsWith('sp:') || Boolean(lieu);
    setVue(sp ? 'spontanees' : 'offres');
    if (lieu) {
      carte?.centrer(lieu.lat as number, lieu.lng as number, 15, -0.07);
      return;
    }
    const g = sp ? groupesSpontanes.find((x) => `sp:${x.ville}` === cle) : groupes.find((x) => x.ville === cle);
    if (g) carte?.centrer(g.lat, g.lng, 10, -0.07);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#1b2330' }}>
      <CarteLeaflet
        centre={{ lat: origine.latitude, lng: origine.longitude }}
        zoom={7}
        sombre
        marqueurs={marqueurs}
        ajuster={!selection && !trajet}
        focus={selection}
        popup={popup}
        trajet={trajet ? { points: trajet.points, approximatif: trajet.approximatif } : null}
        commandes={setCarte}
        onMarqueur={(id) => {
          if (id === 'moi' || id === 'boutique') return;
          if (id === 'fermer') setSelection(null);
          else if (id.startsWith('itineraire:')) allerAuLieu(id.slice(11));
          else if (id.startsWith('article:sp-')) router.push(`/entreprise/${id.slice(11)}` as Href);
          else if (id.startsWith('article:')) router.push(`/offre/${id.slice(8)}` as Href);
          else choisirVille(id);
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 14 }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: VERT }}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[17px] font-black text-white">Autour de moi</Text>
            <View className="flex-row items-center gap-1.5">
              <View className="rounded-full" style={{ width: 7, height: 7, backgroundColor: VERT }} />
              <Text className="text-[12px] font-semibold" style={{ color: '#6EE7C9' }} numberOfLines={1}>
                {resultat === null
                  ? erreur
                    ? 'Impossible de charger les offres.'
                    : 'Chargement…'
                  : `${totalEntreprises} entreprise${totalEntreprises > 1 ? 's' : ''} recrutent · ${libelleOffres(totalOffres)} · ${groupes.length} ville${groupes.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="Fermer"
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {resultat === null && !erreur ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
        {trajet ? (
          <View className="self-center flex-row items-center gap-2 rounded-full bg-white" style={{ paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
            <Ionicons name={trajet.profil === 'pieton' ? 'walk' : 'car'} size={16} color="#0284C7" />
            <Text className="text-[12.5px] font-extrabold text-[#1A1A1A]">
              {trajet.approximatif ? 'À vol d’oiseau · ' : ''}
              {trajet.distanceKm.toLocaleString('fr-FR')} km{trajet.dureeMin != null ? ` · ${trajet.dureeMin} min` : ''}
            </Text>
            <Pressable onPress={() => setTrajet(null)} accessibilityLabel="Effacer le trajet" hitSlop={8} className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: '#EFEDE7' }}>
              <Ionicons name="close" size={15} color="#1A1A1A" />
            </Pressable>
          </View>
        ) : null}
        <View className="self-center flex-row items-center gap-2 rounded-full" style={{ backgroundColor: courantSp || vue === 'spontanees' ? 'rgba(124,58,237,0.96)' : 'rgba(24,119,242,0.96)', paddingHorizontal: 16, paddingVertical: 9, maxWidth: '100%' }}>
          <Ionicons name={vue === 'spontanees' ? 'mail' : 'briefcase'} size={13} color="#fff" />
          <Text className="text-[12px] font-extrabold text-white" numberOfLines={1}>
            {courantSp
              ? `${libelleSpontanees(courantSp.entreprises.length)} de candidature spontanée à ${courantSp.ville}`
              : courant
                ? `${courant.entreprises} entreprise${courant.entreprises > 1 ? 's' : ''} recrute${courant.entreprises > 1 ? 'nt' : ''} à ${courant.ville}`
                : vue === 'spontanees'
                  ? `${spontanesSansVille} dépôt${spontanesSansVille > 1 ? 's' : ''} ouvert${spontanesSansVille > 1 ? 's' : ''} sur tout le Sénégal`
                  : resultat && resultat.sansVille > 0
                    ? `${libelleOffres(resultat.sansVille)} ouverte${resultat.sansVille > 1 ? 's' : ''} sur tout le Sénégal`
                    : 'Position approximative : le centre de chaque ville'}
          </Text>
        </View>

        <View className="flex-row self-center rounded-full p-1" style={{ backgroundColor: 'rgba(20,24,33,0.9)' }}>
          {([
            { id: 'offres' as const, libelle: 'Offres' },
            { id: 'spontanees' as const, libelle: 'Candidatures spontanées' },
          ]).map((o) => {
            const actif = vue === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  setVue(o.id);
                  setSelection(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                className="rounded-full items-center justify-center"
                style={{ height: 38, paddingHorizontal: 18, backgroundColor: actif ? '#fff' : 'transparent' }}>
                <Text className="text-[13px] font-black" style={{ color: actif ? '#1A1A1A' : 'rgba(255,255,255,0.75)' }}>{o.libelle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="rounded-[22px] py-3" style={{ backgroundColor: 'rgba(20,24,33,0.92)', minHeight: 108 }}>
          {(vue === 'offres' ? groupes.length === 0 : groupesSpontanes.length + LIEUX.length === 0) ? (
            <Text className="text-center text-[12.5px] py-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {resultat === null ? 'Chargement…' : vue === 'offres' ? 'Aucune offre à afficher.' : 'Aucun dépôt à afficher.'}
            </Text>
          ) : (
            <FlatList
              horizontal
              data={vue === 'offres' ? groupes.map((g, rang) => ({ cle: g.ville, ville: g.ville, n: g.offres.length, couleur: couleurVille(rang), texte: libelleOffres(g.offres.length) })) : [...LIEUX.map((e) => ({ cle: `lieu:${e.slug}`, ville: e.company, n: '🏬', couleur: VIOLET, texte: 'Emplacement exact' })), ...groupesSpontanes.map((g) => ({ cle: `sp:${g.ville}`, ville: g.ville, n: g.entreprises.length, couleur: VIOLET, texte: libelleSpontanees(g.entreprises.length) }))]}
              keyExtractor={(g) => g.cle}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => {
                const actif = selection === item.cle;
                return (
                  <Pressable onPress={() => choisirVille(item.cle)} className="items-center" style={{ width: 76 }}>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: actif ? 64 : 56, height: actif ? 64 : 56, backgroundColor: item.couleur, borderWidth: actif ? 3 : 2, borderColor: actif ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                      <Text className="text-[20px] font-black text-white">{item.n}</Text>
                    </View>
                    <Text className="text-[11.5px] font-bold text-white mt-1.5 text-center" numberOfLines={1}>{item.ville}</Text>
                    <Text className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)' }} numberOfLines={1}>{item.texte}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
