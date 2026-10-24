import { useFonctionnalite } from '@/lib/featureFlags';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { achatsNumeriquesAutorises } from '@/lib/biensNumeriques';
import { CATEGORIES_ETABLISSEMENT, METIERS_SERVICE, libelleCategorieEtablissement } from '@/lib/boutiqueCategories';
import { NOM_JOUR, chargerHoraires, estAujourdhui, type HoraireJour } from '@/lib/horaires';
import { prixLisible, urlPhoto } from '@/lib/marketplace';
import {
  chargerMesArticles,
  chargerMesBoutiques,
  choisirEtEnvoyerPhotoBoutique,
  definirCouvertureBoutique,
  definirDisponibiliteBoutique,
  definirLogoBoutique,
  definirVisibiliteBoutique,
  envoyerPhotoArticle,
  modifierBoutique,
  retirerArticle,
  type MaBoutique,
  type MonArticle,
} from '@/lib/vendeur';

// « Ma boutique » du vendeur. Depuis le 18/10/2026 elle a EXACTEMENT l'aspect de l'onglet Profil
// de Facilité (src/app/(tabs)/profil.tsx), à la demande du propriétaire : même bloc d'en-tête (photo
// ronde avec son « + », nom, lieu, « Modifier infos »), mêmes onglets à bordure, même bouton
// « + Ajouter … » et mêmes cartes à vignette et petites actions. Le contenu reste celui des maquettes
// « Boutique » (Article, Service, Établissement, interrupteur « Rendre … visible »). « Devenir
// livreur » est dans SERVICE.
//
// Les données sont les vraies (boutique, articles, horaires du vendeur). Le logo est une vraie photo
// choisie par le vendeur (colonne logo_photo, fonction definir_logo_ma_boutique). Le compteur
// « 4 K ami(e)s » des maquettes n'est pas affiché : aucun système d'amis.
const VERT = '#10B981';
const BLEU = '#2563EB';
const VIOLET = '#7C3AED';
const FOND = '#F2F0EA';
// Mêmes valeurs que l'onglet Profil (src/app/(tabs)/profil.tsx) : la boutique et le profil ont le même aspect.
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const STYLE_CARTE = { borderRadius: 16, backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE } as const;

type Onglet = 'article' | 'service' | 'etablissement';

export default function MaBoutiqueScreen() {
  const router = useRouter();
  const livreurOuvert = useFonctionnalite('nav_marketplace_livreur');
  const { user } = useAuth();
  const userId = user?.id;
  const [boutique, setBoutique] = useState<MaBoutique | null | undefined>(undefined); // undefined = chargement
  const [articles, setArticles] = useState<MonArticle[]>([]);
  const [horaires, setHoraires] = useState<HoraireJour[]>([]);
  const [onglet, setOnglet] = useState<Onglet>('article');
  const [basculeEnCours, setBasculeEnCours] = useState(false);
  const [envoiLogo, setEnvoiLogo] = useState(false);
  // Couverture : bloc repliable. Replié, seule une barre avec l'icône photo est visible ; un toucher déplie la photo, un toucher sur la photo la replie.
  const [couvertureOuverte, setCouvertureOuverte] = useState(false);
  const [envoiCouverture, setEnvoiCouverture] = useState(false);

  const [editionMetier, setEditionMetier] = useState(false);
  const [metierSaisi, setMetierSaisi] = useState('');
  const [descriptionSaisie, setDescriptionSaisie] = useState('');
  const [editionEtablissement, setEditionEtablissement] = useState(false);
  const [categorieSaisie, setCategorieSaisie] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const active = (await chargerMesBoutiques(userId))[0] ?? null;
      setBoutique(active);
      if (active) {
        const [a, h] = await Promise.all([chargerMesArticles(active.id), chargerHoraires(active.id).catch(() => [])]);
        setArticles(a);
        setHoraires(h);
      }
    } catch (e) {
      setBoutique(null);
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  async function basculerVisibilite(valeur: boolean) {
    if (!boutique || basculeEnCours) return;
    setBasculeEnCours(true);
    try {
      await definirVisibiliteBoutique(boutique.id, valeur);
      setBoutique({ ...boutique, actif: valeur });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de changer la visibilité.');
    } finally {
      setBasculeEnCours(false);
    }
  }

  async function basculerDisponibilite(valeur: boolean) {
    if (!boutique || basculeEnCours) return;
    setBasculeEnCours(true);
    try {
      await definirDisponibiliteBoutique(boutique.id, valeur);
      setBoutique({ ...boutique, disponible_manuel: valeur });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de changer la disponibilité.');
    } finally {
      setBasculeEnCours(false);
    }
  }

  async function enregistrerRubrique(champs: { metier?: string; descriptionPrestation?: string; categorieEtablissement?: string; typeBoutique: 'service' | 'etablissement' }) {
    if (!boutique) return;
    setEnregistrement(true);
    try {
      await modifierBoutique(boutique.id, {
        nom: boutique.nom,
        quartier: boutique.quartier,
        ville: boutique.ville,
        telephoneWhatsapp: boutique.telephone_whatsapp,
        ...champs,
      });
      setEditionMetier(false);
      setEditionEtablissement(false);
      await recharger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  }

  // Logo de la boutique : photo choisie dans la galerie, recadrée en carré, envoyée dans le bucket des photos.
  async function changerLogo() {
    if (!boutique || !userId || envoiLogo) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Facilité a besoin d’accéder à vos photos pour choisir le logo de la boutique.');
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] });
    if (resultat.canceled) return;
    const a = resultat.assets[0];
    setEnvoiLogo(true);
    try {
      const chemin = await envoyerPhotoArticle(a.uri, { width: a.width, height: a.height }, userId);
      await definirLogoBoutique(boutique.id, chemin);
      setBoutique({ ...boutique, logo_photo: chemin });
    } catch (e) {
      Alert.alert('Logo impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnvoiLogo(false);
    }
  }

  async function changerCouverture() {
    if (!boutique || !userId || envoiCouverture) return;
    setEnvoiCouverture(true);
    try {
      const chemin = await choisirEtEnvoyerPhotoBoutique(userId, [16, 7]);
      if (!chemin) return;
      await definirCouvertureBoutique(boutique.id, chemin);
      setBoutique({ ...boutique, cover_photo: chemin });
    } catch (e) {
      Alert.alert('Couverture impossible', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    } finally {
      setEnvoiCouverture(false);
    }
  }

  async function retirerCouverture() {
    if (!boutique || !boutique.cover_photo) return;
    try {
      await definirCouvertureBoutique(boutique.id, null);
      setBoutique({ ...boutique, cover_photo: null });
    } catch (e) {
      Alert.alert('Couverture', e instanceof Error ? e.message : 'Réessayez dans un instant.');
    }
  }

  function ouvrirModification(a: MonArticle) {
    router.push(
      `/marketplace/vendre/modifier-article?${new URLSearchParams({
        id: a.id,
        titre: a.titre,
        categorie: a.categorie,
        prix: String(a.prix_xof),
        quantite: String(a.quantite),
        description: a.description || '',
        photos: JSON.stringify(a.photos),
      }).toString()}` as Href
    );
  }

  function confirmerRetrait(a: MonArticle) {
    Alert.alert('Retirer cet article ?', `« ${a.titre} » ne sera plus visible par les acheteurs.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          retirerArticle(a.id)
            .then(() => setArticles((liste) => liste.filter((x) => x.id !== a.id)))
            .catch((e: Error) => Alert.alert('Retrait impossible', e.message));
        },
      },
    ]);
  }

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/marketplace'));

  if (boutique === undefined) {
    return (
      <View className="flex-1" style={{ backgroundColor: FOND }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#e3dbcc' }}>
          <MarketplaceHeader />
        </SafeAreaView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      </View>
    );
  }

  if (boutique === null) {
    return (
      <View className="flex-1" style={{ backgroundColor: FOND }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#e3dbcc' }}>
          <MarketplaceHeader />
        </SafeAreaView>
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-[14px] text-center" style={{ color: 'rgba(0,0,0,0.55)' }}>Tu n&apos;as pas encore de boutique.</Text>
          <BoutonAction titre="Devenir actif" sousTitre="Créer ma boutique" icone="storefront-outline" onPress={() => router.replace('/marketplace/vendre')} />
        </View>
      </View>
    );
  }

  const lieuVirgule = [boutique.quartier, boutique.ville].filter(Boolean).join(', ') || 'Boutique sur Facilité';

  const blocDisponibilite = (
    <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
      <View className="flex-row items-center gap-2">
        <View style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: VERT }} />
        <Text className="text-[13px] font-black text-[#111]">Disponibilité</Text>
      </View>
      <View className="flex-row gap-2">
        {[
          { valeur: true, libelle: 'Disponible maintenant', icone: 'flash' as const },
          { valeur: false, libelle: 'Indisponible', icone: 'pause' as const },
        ].map((o) => {
          const actif = boutique.disponible_manuel === o.valeur;
          return (
            <Pressable
              key={o.libelle}
              onPress={() => basculerDisponibilite(o.valeur)}
              disabled={basculeEnCours}
              className="flex-1 flex-row items-center justify-center gap-1.5"
              style={{ height: 44, borderRadius: 12, backgroundColor: actif ? (o.valeur ? VERT : '#374151') : '#EFEDE7' }}>
              <Ionicons name={o.icone} size={13} color={actif ? '#fff' : o.valeur ? '#F59E0B' : 'rgba(0,0,0,0.5)'} />
              <Text className="text-[12px] font-black" style={{ color: actif ? '#fff' : '#1A1A1A' }}>{o.libelle}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const interrupteur = (libelle: string) => (
    <View className="flex-row items-center justify-between px-3 py-3" style={STYLE_CARTE}>
      <View className="flex-1 pr-2">
        <Text className="text-[12.5px] font-black text-[#111]">{libelle}</Text>
        <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
          {boutique.actif ? 'Visible par les utilisateurs' : 'Masqué aux utilisateurs'}
        </Text>
      </View>
      <Switch value={boutique.actif} onValueChange={basculerVisibilite} disabled={basculeEnCours} trackColor={{ true: VERT, false: '#D1D5DB' }} thumbColor="#fff" />
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#e3dbcc' }}>
        <MarketplaceHeader />
      </SafeAreaView>

      {/* Bandeau de la boutique : la PHOTO DE COUVERTURE est l'arrière-plan de la barre retour · NOM · crayon (Réglages de la boutique).
          Compact par défaut (les articles restent visibles dessous) ; l'icône photo, dans le bandeau, déplie la photo en grand, un
          toucher sur la photo la replie. « Changer » / « Retirer » sont posés sur la photo dépliée. À défaut de couverture de boutique, */}
      {(() => {
        const uriCouverture = boutique.cover_photo ? urlPhoto(boutique.cover_photo) : null;
        return (
          <View style={couvertureOuverte ? { width: '100%', aspectRatio: 16 / 7, backgroundColor: '#E8E4DA' } : { width: '100%', height: 96, backgroundColor: '#E8E4DA' }}>
            {uriCouverture ? (
              <Image source={{ uri: uriCouverture }} alt="Couverture de la boutique" style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
            ) : null}
            <Pressable
              onPress={() => setCouvertureOuverte((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: couvertureOuverte }}
              accessibilityLabel={couvertureOuverte ? 'Replier la photo de couverture' : 'Afficher la photo de couverture en grand'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View className="flex-row items-center px-4 pt-3" pointerEvents="box-none">
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace' as Href))}
                accessibilityLabel="Retour"
                className="items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17,17,17,0.9)' }}>
                <Ionicons name="arrow-back" size={19} color="#FFFFFF" />
              </Pressable>
              <View className="flex-1 items-center px-2" pointerEvents="none">
                <Text className="text-[14px] font-black tracking-widest text-white rounded-full px-3 py-1.5 overflow-hidden" style={{ backgroundColor: 'rgba(17,17,17,0.9)' }} numberOfLines={1}>{boutique.nom.toUpperCase()}</Text>
              </View>
              <Pressable
                onPress={() => router.push('/marketplace/reglages' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Réglages de la boutique"
                className="items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17,17,17,0.9)' }}>
                <Ionicons name="pencil" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
            <View className="absolute items-center justify-center rounded-full bg-white" style={{ right: 12, bottom: 6, width: 30, height: 30 }} pointerEvents="none">
              <Ionicons name={couvertureOuverte ? 'chevron-up' : 'image'} size={16} color="#1A1A1A" />
            </View>
            {couvertureOuverte ? (
              <View className="absolute flex-row items-center gap-2" style={{ left: 10, bottom: 8 }}>
                <Pressable onPress={changerCouverture} disabled={envoiCouverture} className="flex-row items-center gap-1.5 rounded-full bg-white px-3" style={{ height: 34 }}>
                  {envoiCouverture ? <ActivityIndicator size="small" color={VERT} /> : <Ionicons name="camera" size={15} color="#047857" />}
                  <Text className="text-[12.5px] font-black" style={{ color: '#047857' }}>{boutique.cover_photo ? 'Changer' : 'Ajouter'}</Text>
                </Pressable>
                {boutique.cover_photo ? (
                  <Pressable onPress={retirerCouverture} className="flex-row items-center gap-1.5 rounded-full bg-white px-3" style={{ height: 34 }}>
                    <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    <Text className="text-[12.5px] font-black" style={{ color: '#DC2626' }}>Retirer</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })()}

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* En-tête : photo ronde + « + », nom, lieu, Modifier infos — comme l'onglet Profil */}
        <View className="px-4 pt-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={changerLogo}
              disabled={envoiLogo}
              accessibilityLabel="Changer le logo de la boutique"
              className="w-[72px] h-[72px] rounded-full bg-[#E8E4DA] items-center justify-center">
              {envoiLogo ? (
                <ActivityIndicator color={VERT} />
              ) : boutique.logo_photo ? (
                <Image source={{ uri: urlPhoto(boutique.logo_photo) ?? undefined }} alt="Logo de la boutique" style={{ width: 72, height: 72, borderRadius: 36 }} contentFit="cover" />
              ) : (
                <Ionicons name="storefront" size={28} color="rgba(0,0,0,0.3)" />
              )}
              <View
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full items-center justify-center border-2 border-[#F2F0EA]"
                style={{ backgroundColor: VERT }}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </Pressable>

            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="storefront" size={15} color="#B45309" />
                <Text className="text-[16px] font-black text-[#1A1A1A] shrink" numberOfLines={1}>
                  {boutique.nom}
                </Text>
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: '#7C3AED' }}>
                  <Text className="text-[9.5px] font-black text-white tracking-wider">BOUTIQUE</Text>
                </View>
              </View>
              <Text className="text-[12px] text-black/50 mt-1" numberOfLines={2}>
                {lieuVirgule}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/marketplace/vendre/modifier-boutique' as Href)}
              className="flex-row items-center gap-1.5 bg-white rounded-xl px-3 py-2.5"
              style={{ borderWidth: 1, borderColor: BORDURE }}>
              <Ionicons name="pencil" size={13} color="#1A1A1A" />
              <Text className="text-[12px] font-bold text-[#1A1A1A]">Modifier infos</Text>
            </Pressable>
          </View>
        </View>

        {/* Page de facturation : jetons et mise en avant (Premium) de la boutique. Masquée sur iOS (biens numériques, règle Apple 3.1.1). */}
        {achatsNumeriquesAutorises ? (
          <View className="px-4 mt-3">
            <BoutonAction
              titre="Page de facturation"
              sousTitre="Jetons et mise en avant de la boutique"
              icone="ribbon-outline"
              iconeCouronne
              onPress={() => router.push('/marketplace/vendre/facturation' as Href)}
            />
          </View>
        ) : null}

        {/* Onglets Article / Service / Établissement — même style que Documents / Fonctionnalités */}
        <View className="flex-row gap-2.5 px-4 mt-3">
          {(
            [
              { id: 'article' as const, label: 'Article', icone: 'pricetag-outline' as const },
              { id: 'service' as const, label: 'Service', icone: 'construct-outline' as const },
              // « Établissement » est masqué pour le moment (18/10/2026) : le code de la rubrique est conservé.
            ]
          ).map((o) => {
            const actif = onglet === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => setOnglet(o.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3"
                style={{ backgroundColor: CARTE, borderWidth: actif ? 1.5 : 1, borderColor: actif ? '#1A1A1A' : BORDURE }}>
                <Ionicons name={o.icone} size={14} color="#1A1A1A" />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} className={`text-[13px] ${actif ? 'font-black' : 'font-semibold'} text-[#1A1A1A] shrink`}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="px-4 mt-3 gap-3">
          {onglet === 'article' ? (
            <>
              {/* Interrupteur de visibilité et « Ajouter un article » partagent la même ligne (gain de place). */}
              <View className="flex-row gap-2.5">
                <View style={{ flex: 1 }}>{interrupteur('Rendre mes articles visibles')}</View>
                <Pressable
                  onPress={() => router.push('/marketplace/vendre/publier' as Href)}
                  className="rounded-2xl px-2 items-center justify-center flex-row gap-1.5"
                  style={{ flex: 1, backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
                  <Ionicons name="add" size={16} color={BLEU} />
                  <Text className="text-[13.5px] font-bold" style={{ color: BLEU }}>Ajouter un article</Text>
                </Pressable>
              </View>

              {articles.length === 0 ? (
                <View className="py-10 px-6 items-center">
                  <Ionicons name="pricetags-outline" size={32} color="rgba(0,0,0,0.25)" />
                  <Text className="text-[13px] text-black/50 text-center mt-2">Aucun article publié pour l&apos;instant.</Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  {articles.map((a) => (
                    <CarteArticle
                      key={a.id}
                      article={a}
                      onVoir={() => router.push(`/marketplace/${a.id}` as Href)}
                      onModifier={() => ouvrirModification(a)}
                      onRetirer={() => confirmerRetrait(a)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}

          {onglet === 'service' ? (
            <>
              {/* Rubrique Service : pour le moment, seul « Devenir livreur » est proposé (18/10/2026). */}
              {livreurOuvert ? (
                <BoutonAction titre="Devenir livreur" sousTitre="Livrez les commandes autour de vous" icone="bicycle-outline" onPress={() => router.push('/marketplace/vendre/livreur')} />
              ) : (
                <View className="items-center py-10 px-6">
                  <Ionicons name="bicycle-outline" size={32} color="rgba(0,0,0,0.25)" />
                  <Text className="text-[13px] text-black/50 text-center mt-2">Cette rubrique n&apos;est pas disponible pour le moment.</Text>
                </View>
              )}
            </>
          ) : null}

          {onglet === 'etablissement' ? (
            <>
              {interrupteur('Rendre mon établissement visible')}

              <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
                <Text className="text-[13px] font-black text-[#111]">Catégorie de l&apos;établissement :</Text>
                {editionEtablissement ? (
                  <View className="gap-2.5">
                    <View className="flex-row flex-wrap gap-1.5">
                      {CATEGORIES_ETABLISSEMENT.map((c) => (
                        <Pressable key={c.id} onPress={() => setCategorieSaisie(c.id)} className="rounded-full px-3 py-1.5" style={{ backgroundColor: categorieSaisie === c.id ? BLEU : '#EFEDE7' }}>
                          <Text className="text-[11px] font-bold" style={{ color: categorieSaisie === c.id ? '#fff' : '#374151' }}>{c.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable onPress={() => setEditionEtablissement(false)} className="flex-1 items-center justify-center" style={{ height: 44, borderRadius: 12, backgroundColor: '#EFEDE7' }}>
                        <Text className="text-[12.5px] font-black" style={{ color: 'rgba(0,0,0,0.6)' }}>Annuler</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => categorieSaisie && enregistrerRubrique({ categorieEtablissement: categorieSaisie, typeBoutique: 'etablissement' })}
                        disabled={enregistrement || !categorieSaisie}
                        className="flex-1 items-center justify-center"
                        style={{ height: 44, borderRadius: 12, backgroundColor: BLEU, opacity: enregistrement || !categorieSaisie ? 0.6 : 1 }}>
                        {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-[12.5px] font-black text-white">Enregistrer</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#D1FAE5' }}>
                      <Text className="text-[10.5px] font-black" style={{ color: '#047857', letterSpacing: 0.4 }}>
                        {libelleCategorieEtablissement(boutique.categorie_etablissement).toUpperCase()}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setCategorieSaisie(boutique.categorie_etablissement ?? null);
                        setEditionEtablissement(true);
                      }}
                      accessibilityLabel="Modifier la catégorie"
                      hitSlop={8}
                      className="items-center justify-center rounded-full"
                      style={{ width: 26, height: 26, backgroundColor: '#D1FAE5' }}>
                      <Ionicons name="pencil" size={12} color="#047857" />
                    </Pressable>
                  </View>
                )}
              </View>

              {blocDisponibilite}

              <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
                <View className="flex-row items-center gap-2">
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: VIOLET }} />
                  <Text className="text-[13px] font-black text-[#111]">Horaires d&apos;ouverture</Text>
                  <Pressable
                    onPress={() => router.push('/marketplace/vendre/horaires' as Href)}
                    className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: '#E6EEFD' }}>
                    <Ionicons name="calendar-outline" size={11} color={BLEU} />
                    <Text className="text-[11px] font-black" style={{ color: BLEU }}>Programmer</Text>
                  </Pressable>
                  <Text className="text-[10px] ml-auto" style={{ color: 'rgba(0,0,0,0.4)' }}>Africa/Dakar</Text>
                </View>
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  {horaires.map((h, i) => {
                    const aujourdhui = estAujourdhui(h.jour);
                    return (
                      <View
                        key={h.jour}
                        className="flex-row items-center justify-between px-3 py-3"
                        style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: aujourdhui ? '#F6FAF8' : '#fff' }}>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-[13px] font-black text-[#111]">{NOM_JOUR[h.jour]}</Text>
                          {aujourdhui ? (
                            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: '#E6EEFD' }}>
                              <Text className="text-[8.5px] font-black" style={{ color: BLEU }}>AUJOURD&apos;HUI</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text className="text-[13px] font-black" style={{ color: h.ferme ? '#DC2626' : aujourdhui ? '#059669' : '#111' }}>
                          {h.ferme ? 'Fermé' : `${h.ouverture ?? '--:--'} – ${h.fermeture ?? '--:--'}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Carte d'un article : même cadre que les cartes de documents du Profil (vignette, nom, détail, trois actions). */
function CarteArticle({
  article,
  onVoir,
  onModifier,
  onRetirer,
}: {
  article: MonArticle;
  onVoir: () => void;
  onModifier: () => void;
  onRetirer: () => void;
}) {
  const photo = article.photos[0] ? urlPhoto(article.photos[0]) : null;
  return (
    <View className="rounded-2xl overflow-hidden" style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
      <Pressable onPress={onModifier} className="w-full aspect-square bg-[#E8E4DA] items-center justify-center">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <>
            <Ionicons name="image-outline" size={30} color="rgba(0,0,0,0.3)" />
            <Text className="text-[11px] font-bold mt-1" style={{ color: 'rgba(0,0,0,0.45)' }}>Photo produit</Text>
          </>
        )}
        {article.quantite > 0 ? (
          <View className="absolute top-2 left-2 rounded px-1.5 py-0.5" style={{ backgroundColor: '#DC2626' }}>
            <Text className="text-white text-[9px] font-black">LIVE</Text>
          </View>
        ) : null}
      </Pressable>
      <View className="p-2.5">
        <Text className="text-[12px] font-bold text-[#1A1A1A]" numberOfLines={1}>
          {article.titre}
        </Text>
        <Text className="text-[12px] font-black text-[#1A1A1A] mt-0.5">{prixLisible(article.prix_xof)} CFA</Text>
        <View className="flex-row gap-2 mt-2">
          <Pressable onPress={onVoir} accessibilityLabel="Voir" className="w-8 h-8 rounded-lg bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="eye-outline" size={14} color="#1A1A1A" />
          </Pressable>
          <Pressable onPress={onModifier} accessibilityLabel="Modifier" className="w-8 h-8 rounded-lg bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="pencil-outline" size={14} color="#1A1A1A" />
          </Pressable>
          <Pressable onPress={onRetirer} accessibilityLabel="Retirer" className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center">
            <Ionicons name="trash-outline" size={14} color="#dc2626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
