import { useFonctionnalites } from '@/lib/featureFlags';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Linking, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { usePaiementsAutorises } from '@/lib/biensNumeriques';
import { contientSansAccent } from '@/lib/texte';
import { SPONTANEOUS_COMPANIES } from '@/lib/spontaneousData';
import { definirUserMode } from '@/lib/userMode';
import { chargerMesBoutiques, type MaBoutique } from '@/lib/vendeur';
import { useT } from '@/lib/i18n';

// Menu « ☰ » (maquettes 01 à 03 du dossier Menu et Publier) : une PAGE (la barre du bas reste visible, « ‹ Menu » revient à
// l'écran d'origine). En haut, sous le titre, le sélecteur FIXE « Facilité | Locaux » qui change les tuiles SANS quitter la
// page ; en dessous, le bloc « Vos espaces » (comptes, Profil, Boutique), DÉPLIÉ à l'ouverture et replié seulement quand on
// fait défiler vers le bas ; puis la grille de tuiles, toutes de la même taille. Mode Locaux : « Espace vendeur » (si le
// compte a une boutique) puis les raccourcis Locaux, aucun élément Facilité. Une seule « Déconnexion », à côté de
// « Paramètres de langue ». Ne figurent PAS dans ce menu : Messages, Offres d'emploi, Aide et assistance (ils sont dans les
// barres et ailleurs). La recherche (02) filtre les tuiles pendant la saisie.
const FOND = '#F2F0EA';
const VERT = '#10B981';
const BLEU = '#2563EB';

type Tag = { texte: string; fond: string; couleur: string };
type Tuile = {
  id: string;
  emoji: string;
  teinte: string;
  titre: string;
  sous: string;
  tag?: Tag;
  /** Route interne ; absente quand `lien` ouvre une adresse externe. */
  route?: string;
  lien?: string;
  // Interrupteur du site (Administration → Fonctionnalités) qui commande cette tuile.
  interrupteur?: string | string[];
  // Page dont le but est un paiement de bien numérique : masquée sur iOS (règle Apple 3.1.1).
  paiementNumerique?: boolean;
};

const NB_ENTREPRISES = SPONTANEOUS_COMPANIES.length;

const TUILES_FACILITE: Tuile[] = [
  { id: 'diagnostic', emoji: '🔍', teinte: '#DCE8FD', titre: 'Diagnostic CV', sous: 'Score ATS & mots-clés', tag: { texte: 'GRATUIT', fond: '#D1FAE5', couleur: '#047857' }, route: '/web/importer-cv', interrupteur: ['feat_diagnostic_cv', 'feat_app_diagnostic_cv'] },
  { id: 'fonctionnalites', emoji: '🛠️', teinte: '#EDE7FB', titre: 'Fonctionnalités', sous: 'Tous les outils & modèles', tag: { texte: 'TOUS', fond: '#E7E5E4', couleur: '#44403C' }, route: '/profil?onglet=fonctionnalites&retour=menu', interrupteur: ['nav_plus_fonctionnalites', 'feat_app_fonctionnalites'] },
  { id: 'candidature', emoji: '🏢', teinte: '#DCE8FD', titre: 'Candidature Spontanée', sous: 'Grandes entreprises', tag: { texte: `${NB_ENTREPRISES} ENTR.`, fond: '#DCE8FD', couleur: '#1E3A8A' }, route: '/candidature-spontanee', interrupteur: 'nav_plus_recrutement_spontane' },
  { id: 'depots', emoji: '📍', teinte: '#EDE7FB', titre: 'Dépôts Physiques', sous: 'Stations & Adresses', route: '/web/recrutement-journalier', interrupteur: 'nav_plus_depots' },
  { id: 'concours', emoji: '🏅', teinte: '#FDEEDC', titre: 'Concours', sous: 'Avis & Examens', tag: { texte: 'PUBLIC', fond: '#FDEEDC', couleur: '#9A3412' }, route: '/web/concours', interrupteur: 'nav_plus_concours' },
  { id: 'formation', emoji: '🎓', teinte: '#D7F2EA', titre: 'Formation', sous: 'Certifications & Cours', tag: { texte: 'PRO', fond: '#D7F2EA', couleur: '#0d3b34' }, route: '/web/formations', interrupteur: 'nav_plus_formation', paiementNumerique: true },
  { id: 'telecharger', emoji: '📲', teinte: '#EDEBE6', titre: "Télécharger l'application", sous: 'Installez Facilité en un geste', tag: { texte: 'NOUVEAU', fond: '#EDEBE6', couleur: '#44403C' }, lien: 'https://ffacilite.com/telecharger-android' },
  { id: 'idees', emoji: '💡', teinte: '#FDF3D0', titre: 'Boîte à idées', sous: 'Vos suggestions', route: '/web/boite-a-idees', interrupteur: ['nav_plus_boite_idees', 'feat_app_boite_idees'] },
  { id: 'faq', emoji: '❓', teinte: '#D7F2EA', titre: 'FAQ & Centre d’aide', sous: 'Questions fréquentes', route: '/web/faq' },
];

const TUILES_LOCAUX: Tuile[] = [
  { id: 'marketplace', emoji: '🏬', teinte: '#DCE8FD', titre: 'Marketplace', sous: 'Sélection du jour & Ventes', tag: { texte: 'NOUVEAU', fond: '#DCE8FD', couleur: '#1E3A8A' }, route: '/marketplace', interrupteur: 'nav_marketplace' },
  { id: 'activite', emoji: '💧', teinte: '#D7F2EA', titre: 'Mon activité', sous: 'Point Wave, pharmacie, clinique', tag: { texte: 'NOUVEAU', fond: '#D7F2EA', couleur: '#0d3b34' }, route: '/web/mon-activite', interrupteur: 'nav_marketplace' },
  { id: 'etablissements', emoji: '🏥', teinte: '#DCE8FD', titre: 'Établissements ouverts', sous: 'Points Wave, pharmacies, cliniques', tag: { texte: 'NOUVEAU', fond: '#DCE8FD', couleur: '#1E3A8A' }, route: '/web/etablissements', interrupteur: 'nav_marketplace' },
];

// Menu ☰ de Locaux réduit à « Réglages » : « Marketplace », « Mon activité », « Établissements ouverts » et l'espace vendeur (« Mes annonces »,
// « Commandes reçues », « Mes livraisons ») ne sont plus proposés ici (ils restent dans le code, rien n'est supprimé). Remettre à false pour les rétablir.
const MENU_LOCAUX_REDUIT = true;
const TUILE_REGLAGES: Tuile = { id: 'reglages', emoji: '⚙️', teinte: '#EDEBE6', titre: 'Réglages', sous: 'Boutique & compte', route: '/marketplace/reglages' };

export default function MenuScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();
  const ouvert = useFonctionnalites();
  const achatsNumeriquesAutorises = usePaiementsAutorises();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [terme, setTerme] = useState('');
  // Mode affiché (Facilité | Locaux) : on part de la plateforme où l'on se trouve (☰ ouvert depuis Locaux → Locaux, depuis Facilité →
  // Facilité) ; la touche de bascule change ensuite les tuiles sans quitter la page.
  const chemin = usePathname();
  const [mode, setMode] = useState<'facilite' | 'locaux'>(chemin.startsWith('/marketplace') ? 'locaux' : 'facilite');

  // Deux pages côte à côte (Facilité | Locaux), comme les onglets d'un fil : le contenu SUIT le doigt (on voit les deux pages pendant
  // le glissé), la barre sous les onglets se déplace avec lui, et au relâchement la page se cale en douceur (ou revient si le
  // glissé est trop court). Toucher un onglet fait le même déplacement animé.
  const largeur = Dimensions.get('window').width;
  const pageDepart = chemin.startsWith('/marketplace') ? 1 : 0;
  const [position] = useState(() => new Animated.Value(pageDepart));
  const pageCourante = useRef(pageDepart);
  const [largeurOnglets, setLargeurOnglets] = useState(0);
  // « Vos espaces » : déplié à l'ouverture, replié quand on fait défiler vers le bas.
  const [espacesDeplies, setEspacesDeplies] = useState(true);
  const [boutique, setBoutique] = useState<MaBoutique | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let annule = false;
    chargerMesBoutiques(userId)
      .then((l) => {
        if (!annule) setBoutique(l[0] ?? null);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [userId]);

  function aller(index: 0 | 1) {
    pageCourante.current = index;
    setMode(index === 1 ? 'locaux' : 'facilite');
    Animated.spring(position, { toValue: index, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
  }

  const pager = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderMove: (_e, g) => position.setValue(Math.max(-0.12, Math.min(1.12, pageCourante.current - g.dx / largeur))),
        onPanResponderRelease: (_e, g) => {
          let cible: 0 | 1 = pageCourante.current as 0 | 1;
          if (g.dx <= -largeur * 0.2 || g.vx <= -0.4) cible = 1;
          else if (g.dx >= largeur * 0.2 || g.vx >= 0.4) cible = 0;
          aller(cible);
        },
        onPanResponderTerminate: () => aller(pageCourante.current as 0 | 1),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position, largeur]
  );

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // Lignes de « Vos espaces » : y aller change d'univers (accueil Facilité ou fil Locaux).
  function allerEspace(m: 'facilite' | 'locaux') {
    setMode(m);
    definirUserMode(m === 'locaux' ? 'business' : 'facilite').catch(() => {});
    router.replace((m === 'locaux' ? '/marketplace' : '/') as Href);
  }

  function confirmerDeconnexion() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  function ouvrirTuile(tu: Tuile) {
    if (tu.lien) Linking.openURL(tu.lien).catch(() => {});
    else if (tu.route) router.push(tu.route as Href);
  }

  const nom = (profile?.full_name as string | undefined) || 'Mon compte';
  const initiales = nom.slice(0, 2).toUpperCase();

  // Tuiles du mode, filtrées par les interrupteurs puis par la recherche.
  const q = terme.trim();
  const filtre = (liste: Tuile[]) =>
    liste.filter((tu) => ouvert(tu.interrupteur) && (achatsNumeriquesAutorises || !tu.paiementNumerique) && (!q || contientSansAccent(`${t(tu.titre)} ${t(tu.sous)} ${tu.titre} ${tu.sous}`, q)));
  const tuilesFacilite = filtre(TUILES_FACILITE);
  const tuilesLocaux = filtre(MENU_LOCAUX_REDUIT ? [TUILE_REGLAGES] : TUILES_LOCAUX);

  // Espace vendeur (mode Locaux, compte avec boutique) : gestion de la boutique, tuiles de la même taille.
  const commandesOuvertes = ouvert('feat_marketplace_commandes');
  const livraisonOuverte = ouvert('nav_marketplace_livreur');
  const tuilesVendeur: Tuile[] =
    !MENU_LOCAUX_REDUIT && mode === 'locaux' && boutique
      ? [
          { id: 'annonces', emoji: '🏷️', teinte: '#DCE8FD', titre: 'Mes annonces', sous: 'Articles en vente', route: '/marketplace/vendre/annonces' },
          ...(commandesOuvertes ? [{ id: 'commandes', emoji: '📦', teinte: '#FDEEDC', titre: 'Commandes reçues', sous: 'À préparer & envoyer', route: `/marketplace/vendre/commandes-recues?storeId=${boutique.id}` }] : []),
          ...(livraisonOuverte ? [{ id: 'livraisons', emoji: '🛵', teinte: '#D7F2EA', titre: 'Mes livraisons', sous: 'Courses en cours', route: '/marketplace/livraisons' }] : []),
          { id: 'reglages', emoji: '⚙️', teinte: '#EDEBE6', titre: 'Réglages', sous: 'Boutique & compte', route: '/marketplace/reglages' },
        ].filter((tu) => !q || contientSansAccent(`${t(tu.titre)} ${t(tu.sous)} ${tu.titre} ${tu.sous}`, q))
      : [];

  // L'espace où l'on se trouve est toujours en haut, l'autre en dessous.
  const ligneFacilite = (
    <Pressable
      onPress={() => allerEspace('facilite')}
      className="flex-row items-center gap-3"
      style={{ backgroundColor: mode === 'facilite' ? '#F7F5F0' : 'transparent', borderRadius: 14, padding: 10 }}>
      <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#EFEDE7' }}>
        <Text className="text-[14px] font-extrabold" style={{ color: 'rgba(0,0,0,0.35)' }}>{initiales}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={1}>{nom}</Text>
        <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>{t('Espace Candidat & CV')}</Text>
      </View>
      {mode === 'facilite' ? <Ionicons name="checkmark-circle-outline" size={22} color={VERT} /> : <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>{t('Basculer →')}</Text>}
    </Pressable>
  );
  const ligneLocaux = (
    <Pressable
      onPress={() => allerEspace('locaux')}
      className="flex-row items-center gap-3"
      style={{ backgroundColor: mode === 'locaux' ? '#F7F5F0' : 'transparent', borderRadius: 14, padding: 10 }}>
      <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#EFEDE7' }}>
        <Ionicons name="storefront-outline" size={19} color="rgba(0,0,0,0.35)" />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={1}>{t('Locaux')}</Text>
        <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>{t('Espace Vendeur & Locaux')}</Text>
      </View>
      {mode === 'locaux' ? <Ionicons name="checkmark-circle-outline" size={22} color={VERT} /> : <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>{t('↻ Basculer →')}</Text>}
    </Pressable>
  );

  const grille = (liste: Tuile[]) => (
    <View className="flex-row flex-wrap" style={{ gap: 12 }}>
      {liste.map((tu) => (
        <Pressable
          key={tu.id}
          onPress={() => ouvrirTuile(tu)}
          accessibilityRole="button"
          className="bg-white"
          style={{ width: '48%', borderRadius: 18, padding: 14, height: 132, justifyContent: 'space-between' }}>
          <View className="flex-row items-start justify-between">
            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tu.teinte }}>
              <Text style={{ fontSize: 19 }}>{tu.emoji}</Text>
            </View>
            {tu.tag ? (
              <View style={{ backgroundColor: tu.tag.fond, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text className="text-[10px] font-black" style={{ color: tu.tag.couleur }}>{t(tu.tag.texte)}</Text>
              </View>
            ) : null}
          </View>
          <View>
            <Text className="text-[14.5px] font-black text-[#1A1A1A]" numberOfLines={2}>{t(tu.titre)}</Text>
            <Text className="text-[12px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={2}>{t(tu.sous)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <View style={{ paddingTop: insets.top }}>
        {rechercheOuverte ? (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 flex-row items-center gap-2.5 bg-white" style={{ height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#1A1A1A', paddingHorizontal: 16 }}>
              <Ionicons name="search" size={16} color="#1A1A1A" />
              <TextInput
                value={terme}
                onChangeText={setTerme}
                autoFocus
                placeholder="Rechercher dans le menu…"
                placeholderTextColor="rgba(0,0,0,0.45)"
                style={[{ flex: 1, fontSize: 14, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
              />
            </View>
            <Pressable
              onPress={() => {
                setRechercheOuverte(false);
                setTerme('');
              }}>
              <Text className="text-[14px] font-extrabold" style={{ color: '#DC2626' }}>{t('Annuler ×')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={retour} accessibilityLabel="Retour" className="flex-row items-center gap-2">
              <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
              <Text className="text-[20px] font-black text-[#1A1A1A]">{t('Menu')}</Text>
            </Pressable>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => setRechercheOuverte(true)} accessibilityLabel="Rechercher" className="items-center justify-center bg-white" style={{ width: 40, height: 40, borderRadius: 20 }}>
                <Ionicons name="search" size={17} color="#1A1A1A" />
              </Pressable>
              <Pressable onPress={retour} accessibilityLabel="Fermer" className="items-center justify-center bg-white" style={{ width: 40, height: 40, borderRadius: 20 }}>
                <Ionicons name="close" size={19} color="#1A1A1A" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Sélecteur FIXE Facilité | Locaux (pastille d'origine) : le surlignage suit le glissé des pages */}
        <View className="flex-row items-center justify-between bg-white mx-4" style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 }}>
          <Pressable onPress={() => setEspacesDeplies((v) => !v)} accessibilityRole="button" className="flex-row items-center gap-1.5" hitSlop={8}>
            <Text className="text-[11.5px] font-extrabold" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('VOS ESPACES')}</Text>
            <Ionicons name={espacesDeplies ? 'chevron-up' : 'chevron-down'} size={13} color="rgba(0,0,0,0.45)" />
          </Pressable>
          <View className="flex-row" style={{ backgroundColor: '#EFEDE7', borderRadius: 20, padding: 3 }} onLayout={(e) => setLargeurOnglets(e.nativeEvent.layout.width - 6)}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                height: 34,
                width: largeurOnglets / 2,
                borderRadius: 17,
                backgroundColor: mode === 'locaux' ? BLEU : VERT,
                transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, largeurOnglets / 2] }) }],
              }}
            />
            {([
              { id: 0 as const, libelle: 'Facilité' },
              { id: 1 as const, libelle: 'Locaux' },
            ]).map((o) => {
              const actif = (mode === 'locaux' ? 1 : 0) === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => aller(o.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  className="items-center justify-center"
                  style={{ paddingHorizontal: 16, height: 34, borderRadius: 17 }}>
                  <Text className="text-[13px] font-black" style={{ color: actif ? '#fff' : 'rgba(0,0,0,0.6)' }}>{t(o.libelle)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View className="flex-1" style={{ overflow: 'hidden' }} {...pager.panHandlers}>
        <Animated.View
          style={{ flex: 1, width: largeur * 2, flexDirection: 'row', transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, -largeur] }) }] }}>
          {[tuilesFacilite, tuilesLocaux].map((liste, page) => (
            <View key={page} style={{ width: largeur }}>
              <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                {espacesDeplies && !(MENU_LOCAUX_REDUIT && page === 1) ? (
                  <View className="bg-white" style={{ borderRadius: 20, padding: 14, marginTop: 6 }}>
                    {page === 0 ? <>{ligneFacilite}{ligneLocaux}</> : <>{ligneLocaux}{ligneFacilite}</>}
                    <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
                    <View className="flex-row items-center justify-between px-2.5 py-1.5">
                      <Pressable onPress={() => router.navigate('/profil')} className="flex-row items-center gap-2">
                        <Ionicons name="id-card-outline" size={18} color={VERT} />
                        <Text className="text-[15px] font-black" style={{ color: VERT }}>{t('Profil')}</Text>
                      </Pressable>
                      <Pressable onPress={() => router.push('/marketplace/vendre' as Href)} className="flex-row items-center gap-2">
                        <Ionicons name="storefront" size={18} color={BLEU} />
                        <Text className="text-[15px] font-black" style={{ color: BLEU }}>{t('Boutique')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {page === 1 && tuilesVendeur.length > 0 ? (
                  <>
                    <Text className="text-[12px] font-extrabold mt-5 mb-3 ml-1" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('ESPACE VENDEUR')}</Text>
                    {grille(tuilesVendeur)}
                  </>
                ) : null}

                <Text className="text-[12px] font-extrabold mt-5 mb-3 ml-1" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('TOUS LES RACCOURCIS')}</Text>
                {liste.length === 0 ? (
                  <Text className="text-center text-[13px] mt-6" style={{ color: 'rgba(0,0,0,0.45)' }}>Aucun résultat.</Text>
                ) : (
                  grille(liste)
                )}
              </ScrollView>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* « Paramètres de langue » et l'UNIQUE « Déconnexion » : FIXES, juste au-dessus de la barre de navigation */}
      <View className="flex-row px-4 pt-2 pb-2" style={{ gap: 12, backgroundColor: '#F2F0EA' }}>
        <Pressable onPress={() => router.push((chemin.startsWith('/marketplace') ? '/marketplace/langue' : '/mon-profil/langue') as Href)} className="flex-1 bg-white flex-row items-center justify-center gap-2" style={{ borderRadius: 16, paddingVertical: 15 }}>
          <Text className="text-[14px] font-black text-[#1A1A1A]">{t('⚙ Paramètres de langue')}</Text>
        </Pressable>
        <Pressable onPress={confirmerDeconnexion} className="flex-1 bg-white flex-row items-center justify-center gap-2" style={{ borderRadius: 16, paddingVertical: 15 }}>
          <Ionicons name="log-out-outline" size={17} color="#DC2626" />
          <Text className="text-[14px] font-black" style={{ color: '#DC2626' }}>{t('Déconnexion')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
