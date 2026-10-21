import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CarteLeaflet, { type CommandesCarte, type MarqueurCarte, type PopupBoutique } from '@/components/CarteLeaflet';
import { chargerOffresParVille, trouverVille, type GroupeVille, type ResultatAutour } from '@/lib/offresParVille';
import { SPONTANEOUS_COMPANIES } from '@/lib/spontaneousData';
import type { Position } from '@/lib/marketplace';
import { sansAccent } from '@/lib/texte';
import { useLocalisation } from '@/lib/useLocalisation';

// « Autour de moi » de Facilité — pas celui de Locaux : ici la carte montre OÙ
// RECRUTENT LES ENTREPRISES. Un rond par ville avec son nombre d'offres ;
// un appui ouvre la liste des offres de cette ville (entreprise + poste).
// Les positions sont celles du CENTRE de chaque ville (les offres n'ont pas de
// GPS précis) et l'écran le dit. Les offres qui ne citent aucune ville connue
// (« Sénégal ») sont comptées à part.
// Refonte du 18/10/2026 : même présentation que la carte Locaux (carte sombre plein écran, ronds à
// pastille, carrousel de villes en bas), sans regroupement.
// Mise à jour du 20/10/2026 : MÊME carte et même fonctionnement que Locaux — barre de recherche crème, filtres, boutons de
// carte (recentrer, jour/nuit, zoom), bascule Entreprises / Offres et carrousel. Seules les informations changent.
const BLEU = '#2563EB';
const CREME_RECHERCHE = '#E8DFCF';
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
  const [saisie, setSaisie] = useState('');
  const [recherche, setRecherche] = useState('');
  // Carte sombre (défaut) ou claire : bouton lune des commandes de carte, comme dans Locaux.
  const [sombre, setSombre] = useState(true);
  // Carrousel du bas : entreprises (une pastille par entreprise) ou offres (une carte par offre).
  const [onglet, setOnglet] = useState<'entreprises' | 'offres'>('entreprises');

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

  // Recherche (titre du poste, entreprise ou ville, sans accents) : ne garde que les offres qui correspondent.
  const groupes = useMemo(() => {
    const base = resultat?.groupes ?? [];
    const terme = sansAccent(recherche.trim());
    if (!terme) return base;
    return base
      .map((g) => {
        const offres = g.offres.filter((o) => sansAccent(`${o.titre} ${o.entreprise} ${g.ville}`).includes(terme));
        return { ...g, offres, entreprises: new Set(offres.map((o) => o.entreprise.toLowerCase())).size };
      })
      .filter((g) => g.offres.length > 0);
  }, [resultat, recherche]);
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
        // Site externe : le bouton « Postuler » ouvre le canal de candidature de l'entreprise (pas d'itinéraire).
        action: { id: `postuler:${lieuSel.slug}`, libelle: 'Postuler' },
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

  // Recadrage de la carte : seulement quand la liste affichée change, jamais à la fermeture d'une bulle.
  const cleListe = `${groupes.map((g) => g.ville).join(',')}|${resultat === null ? 'chargement' : 'pret'}`;
  const [cleAjustee, setCleAjustee] = useState('');
  useEffect(() => {
    if (!selection && cleListe !== cleAjustee) queueMicrotask(() => setCleAjustee(cleListe));
  }, [selection, cleListe, cleAjustee]);

  // Carrousel « Entreprises » : une pastille par entreprise (initiales, nombre d'offres), la ville est celle de sa première offre.
  const entreprisesListe = useMemo(() => {
    const m = new Map<string, { cle: string; ville: string; n: number; couleur: string; texte: string; cleVille: string }>();
    groupes.forEach((g, rang) =>
      g.offres.forEach((o) => {
        const cle = o.entreprise.toLowerCase();
        const e = m.get(cle) ?? { cle: g.ville, ville: o.entreprise, n: 0, couleur: couleurVille(rang), texte: '', cleVille: g.ville };
        e.n += 1;
        e.texte = `${libelleOffres(e.n)} · ${e.cleVille}`;
        m.set(cle, e);
      })
    );
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [groupes]);

  const origine = position ?? DAKAR;
  const totalOffres = groupes.reduce((n, g) => n + g.offres.length, 0);
  const totalEntreprises = new Set(groupes.flatMap((g) => g.offres.map((o) => o.entreprise.toLowerCase()))).size;

  // « Postuler » : même canal que la fiche de l'entreprise (site officiel, sinon e-mail).
  const postuler = (slug: string) => {
    const e = LIEUX.find((x) => x.slug === slug);
    if (!e) return;
    if (e.contactType === 'url' && e.externalLink) Linking.openURL(e.externalLink).catch(() => {});
    else if (e.email) Linking.openURL(`mailto:${e.email}?subject=${encodeURIComponent(`Candidature - ${e.company}`)}`).catch(() => {});
    else router.push(`/entreprise/${e.slug}` as Href);
  };

  const lancerRecherche = () => {
    setRecherche(saisie);
    setSelection(null);
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
        sombre={sombre}
        regions
        marqueurs={marqueurs}
        ajuster={!selection && cleListe !== cleAjustee}
        focus={selection}
        popup={popup}
        commandes={setCarte}
        onMarqueur={(id) => {
          if (id === 'moi' || id === 'boutique') return;
          if (id === 'fermer') setSelection(null);
          else if (id.startsWith('postuler:')) postuler(id.slice(9));
          else if (id.startsWith('article:sp-')) router.push(`/entreprise/${id.slice(11)}` as Href);
          else if (id.startsWith('article:')) router.push(`/offre/${id.slice(8)}` as Href);
          else choisirVille(id);
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 14, gap: 10 }}>
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
                  : `${totalEntreprises} ${totalEntreprises > 1 ? 'offres & entreprises' : 'offre & entreprise'}`}
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

        <View className="flex-row items-center gap-2 rounded-[18px] pl-4 pr-1.5" style={{ height: 52, backgroundColor: CREME_RECHERCHE }}>
          <TextInput
            value={saisie}
            onChangeText={setSaisie}
            onSubmitEditing={lancerRecherche}
            returnKeyType="search"
            placeholder="Rechercher une offre, une entreprise..."
            placeholderTextColor="rgba(0,0,0,0.45)"
            className="flex-1 text-[13.5px] text-[#1A1A1A]"
          />
          <Pressable
            onPress={lancerRecherche}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-[14px]"
            style={{ height: 40, paddingHorizontal: 14, backgroundColor: VERT }}>
            <Ionicons name="search" size={15} color="#fff" />
            <Text className="text-white text-[13.5px] font-black">Rechercher</Text>
          </Pressable>
        </View>

        {/* Filtres : Toutes les offres · Candidatures spontanées · Autour de moi */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 14 }}>
          {([
            { id: 'offres' as const, libelle: 'Toutes les offres', icone: 'briefcase' as const, couleur: BLEU },
            { id: 'spontanees' as const, libelle: 'Candidatures spontanées', icone: 'mail' as const, couleur: VIOLET },
          ]).map((f) => {
            const actif = vue === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  setVue(f.id);
                  setSelection(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                className="flex-row items-center gap-1.5 rounded-full"
                style={{ height: 38, paddingHorizontal: 14, backgroundColor: actif ? '#fff' : 'rgba(20,24,33,0.92)', borderWidth: actif ? 0 : 1, borderColor: 'rgba(75,85,99,0.8)' }}>
                <Ionicons name={f.icone} size={14} color={f.couleur} />
                <Text className="text-[12.5px] font-black" style={{ color: actif ? '#1A1A1A' : '#fff' }}>{f.libelle}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => position && carte?.centrer(position.latitude, position.longitude, 15)}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-full"
            style={{ height: 38, paddingHorizontal: 14, backgroundColor: 'rgba(20,24,33,0.92)', borderWidth: 1, borderColor: 'rgba(75,85,99,0.8)' }}>
            <Ionicons name="locate" size={14} color="#34D399" />
            <Text className="text-[12.5px] font-black text-white">Autour de moi</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Commandes de carte : recentrer, jour / nuit, zoom */}
      <View style={{ position: 'absolute', right: 14, top: insets.top + 196, gap: 10 }}>
        {[
          { icone: 'locate' as const, nom: 'Recentrer', action: () => position && carte?.centrer(position.latitude, position.longitude, 15), couleur: BLEU },
          { icone: (sombre ? 'moon' : 'sunny') as 'moon' | 'sunny', nom: sombre ? 'Carte claire' : 'Carte sombre', action: () => setSombre((v) => !v), couleur: '#FBBF24' },
          { icone: 'add' as const, nom: 'Zoom avant', action: () => carte?.zoomer(1), couleur: '#fff' },
          { icone: 'remove' as const, nom: 'Zoom arrière', action: () => carte?.zoomer(-1), couleur: '#fff' },
        ].map((c) => (
          <Pressable
            key={c.nom}
            onPress={c.action}
            accessibilityLabel={c.nom}
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: 'rgba(20,24,33,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Ionicons name={c.icone} size={20} color={c.couleur} />
          </Pressable>
        ))}
      </View>

      {resultat === null && !erreur ? (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
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

        {vue === 'offres' ? (
          <View className="flex-row self-center rounded-full p-1" style={{ backgroundColor: 'rgba(20,24,33,0.9)' }}>
            {([
              { id: 'entreprises' as const, libelle: 'Entreprises' },
              { id: 'offres' as const, libelle: 'Offres' },
            ]).map((o) => {
              const actif = onglet === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setOnglet(o.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  className="rounded-full items-center justify-center"
                  style={{ height: 38, paddingHorizontal: 22, backgroundColor: actif ? '#fff' : 'transparent' }}>
                  <Text className="text-[13.5px] font-black" style={{ color: actif ? '#1A1A1A' : 'rgba(255,255,255,0.75)' }}>{o.libelle}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View className="rounded-[22px] py-3" style={{ backgroundColor: 'rgba(20,24,33,0.92)', minHeight: 108 }}>
          {(vue === 'offres' ? groupes.length === 0 : groupesSpontanes.length + LIEUX.length === 0) ? (
            <Text className="text-center text-[12.5px] py-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {resultat === null ? 'Chargement…' : vue === 'offres' ? 'Aucune offre à afficher.' : 'Aucun dépôt à afficher.'}
            </Text>
          ) : vue === 'offres' && onglet === 'offres' ? (
            <FlatList
              horizontal
              data={groupes.flatMap((g) => g.offres.map((o) => ({ ...o, ville: g.ville })))}
              keyExtractor={(o) => o.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => router.push(`/offre/${item.id}` as Href)} style={{ width: 124 }}>
                  <View className="rounded-[14px] overflow-hidden items-center justify-center" style={{ width: 124, height: 70, backgroundColor: '#E4DED2' }}>
                    {item.affiche && !item.affiche.startsWith('data:') ? (
                      <Image source={{ uri: item.affiche }} alt={item.titre} style={{ width: 124, height: 70 }} contentFit="cover" />
                    ) : (
                      <Ionicons name="briefcase-outline" size={22} color="rgba(0,0,0,0.3)" />
                    )}
                  </View>
                  <Text className="text-[11.5px] font-bold text-white mt-1.5" numberOfLines={1}>{item.titre}</Text>
                  <Text className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.55)' }} numberOfLines={1}>{item.entreprise} · {item.ville}</Text>
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              horizontal
              data={vue === 'offres' ? entreprisesListe : [...LIEUX.map((e) => ({ cle: `lieu:${e.slug}`, ville: e.company, n: '🏬', couleur: VIOLET, texte: 'Emplacement exact' })), ...groupesSpontanes.map((g) => ({ cle: `sp:${g.ville}`, ville: g.ville, n: g.entreprises.length, couleur: VIOLET, texte: libelleSpontanees(g.entreprises.length) }))]}
              keyExtractor={(g) => `${g.cle}|${g.ville}`}
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
