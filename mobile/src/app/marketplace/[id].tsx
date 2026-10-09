import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CommandeRapideModal from '@/components/CommandeRapideModal';
import EnteteMarketplace from '@/components/EnteteMarketplace';
import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { ratioAffichage } from '@/lib/formatImage';
import {
  brouillonArticle,
  enStock,
  libelleCategorie,
  lieuBoutique,
  lienArticle,
  lienWhatsapp,
  obtenirArticle,
  prixLisible,
  type ArticleMarketplace,
} from '@/lib/marketplace';
import { ouvrirConversation } from '@/lib/messages';

// Fiche article — maquette 16 : bande d'en-tête, ligne « ‹ Retour · fil
// d'Ariane · partager · fermer », onglets Article / Commentaires /
// Recommander, galerie avec « En stock », cœur et plein écran, vignettes
// (dont la vidéo), carte de la boutique avec « Boutique → », puis la barre
// fixe cœur · Discuter · WhatsApp · panier.
//
// Ce que la maquette (et la charte §7) prévoit et que la base ne permet pas :
// note ★ et avis, nombre de ventes, prix barré et remise, quantité −/+ sur la
// fiche. Il n'existe ni colonne ni table pour ça ; rien n'est affiché à la
// place. Le choix de la quantité se fait à la commande (CommandeRapideModal).
// L'onglet « Commentaires » dit honnêtement qu'il n'y en a pas encore.
const VERT = '#10B981';
const BORDURE_CARTE = 'rgba(0,0,0,0.06)';

type Onglet = 'article' | 'commentaires' | 'recommander';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [article, setArticle] = useState<ArticleMarketplace | null | undefined>(undefined);
  const [photoActive, setPhotoActive] = useState(0);
  // Rapport réel (largeur / hauteur) de chaque photo, mesuré au chargement : la galerie prend le format de la photo affichée.
  const [ratiosPhotos, setRatiosPhotos] = useState<Record<string, number>>({});
  const [ouverture, setOuverture] = useState(false);
  const [favori, setFavori] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>('article');
  const [commandeOuverte, setCommandeOuverte] = useState(false);

  useEffect(() => {
    let annule = false;
    obtenirArticle(id).then((a) => {
      if (!annule) setArticle(a);
    });
    return () => {
      annule = true;
    };
  }, [id]);

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/marketplace');
  }

  // Largeur du cadre de la galerie : l'écran moins les marges de la carte.
  const largeurCadre = width - 24;

  function surDefilement(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPhotoActive(Math.round(e.nativeEvent.contentOffset.x / largeurCadre));
  }

  if (article === undefined) {
    return (
      <View className="flex-1 bg-[#F2F0EA] items-center justify-center">
        <ActivityIndicator color={VERT} />
      </View>
    );
  }

  if (article === null) {
    return (
      <View className="flex-1 bg-[#F2F0EA]">
        <EnteteMarketplace titre="Article" onRetour={retour} />
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <Ionicons name="alert-circle-outline" size={42} color="#9CA3AF" />
          <Text className="text-[16px] font-bold text-[#1A1A1A]">Article introuvable</Text>
          <Text className="text-[13px] text-gray-500 text-center">Il a peut-être été retiré par le vendeur.</Text>
        </View>
      </View>
    );
  }

  const estMonArticle = Boolean(user?.id) && article.proprietaireId === user?.id;
  const vendeurConnu = Boolean(article.proprietaireId);
  const discussionPossible = !estMonArticle && vendeurConnu;
  const whatsapp = lienWhatsapp(article);
  const stock = enStock(article);
  const peuRestant = stock && article.quantite > 0 && article.quantite <= 5;
  const nbVignettes = article.photos.length + (article.urlVideo ? 1 : 0);

  async function discuter() {
    if (!article) return;
    if (!user?.id) {
      router.push('/login');
      return;
    }
    if (!article.proprietaireId || ouverture) return;
    setOuverture(true);
    try {
      const conversationId = await ouvrirConversation(user.id, article.proprietaireId);
      if (!conversationId) {
        Alert.alert('Discussion', "Impossible d'ouvrir la discussion pour le moment.");
        return;
      }
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conversationId,
          contexte: 'marketplace',
          nom: article.boutiqueNom,
          brouillon: brouillonArticle(article),
        },
      });
    } finally {
      setOuverture(false);
    }
  }

  function ecrireSurWhatsapp() {
    if (!whatsapp) return;
    Linking.openURL(whatsapp).catch(() => Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp."));
  }

  // Commander : la commande est enregistrée au nom du compte, donc connexion
  // obligatoire. Le formulaire envoie ensuite le message WhatsApp du vendeur.
  function commanderDirect() {
    if (!user?.id) {
      router.push('/login');
      return;
    }
    if (estMonArticle) return;
    setCommandeOuverte(true);
  }

  async function partager() {
    if (!article) return;
    try {
      await Share.share({
        message: `${article.titre} — ${prixLisible(article.prixXof)} FCFA sur Facilité Marketplace\n${lienArticle(article.id)}`,
      });
    } catch {
      /* partage annulé */
    }
  }

  // Photo affichée au format réel ; tant qu'elle n'est pas mesurée, le carré légèrement allongé d'avant.
  const ratioActif = ratiosPhotos[article.photos[photoActive]] ?? 1 / 0.95;
  const hauteurGalerie = largeurCadre / ratioActif;

  const miniature = (indice: number) => {
    const estVideo = indice >= article.photos.length;
    const selectionnee = !estVideo && indice === photoActive;
    return (
      <Pressable
        key={indice}
        onPress={() => {
          if (estVideo) router.push(`/marketplace/photos?id=${article.id}&index=${indice}` as Href);
          else setPhotoActive(indice);
        }}
        accessibilityLabel={estVideo ? 'Voir la vidéo' : `Photo ${indice + 1}`}
        className="rounded-[10px] overflow-hidden items-center justify-center"
        style={{
          width: 62,
          height: 62,
          backgroundColor: estVideo ? '#2D3139' : '#E8E4DA',
          borderWidth: 2,
          borderColor: selectionnee ? '#2563EB' : 'transparent',
        }}>
        {estVideo ? (
          <>
            <Ionicons name="play-circle" size={26} color="#fff" />
            <Text className="text-[10px] font-bold text-white mt-0.5">Vidéo</Text>
          </>
        ) : (
          <Image source={{ uri: article.photos[indice] }} alt={`Photo ${indice + 1}`} style={{ width: 62, height: 62 }} contentFit="cover" />
        )}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      {/* En-tête Marketplace de la maquette 16 (logo, cloche, recherche, menu) */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#e3dbcc' }}>
        <MarketplaceHeader />
      </View>

      {/* Retour · fil d'Ariane · partager · fermer */}
      <View className="flex-row items-center gap-2 bg-white px-3 py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: BORDURE_CARTE }}>
        <Pressable
          onPress={retour}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
          <Ionicons name="arrow-back" size={14} color="#2563EB" />
          <Text className="text-[12.5px] font-extrabold" style={{ color: '#2563EB' }}>Retour</Text>
        </Pressable>
        <Text className="flex-1 text-[12px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>
          Marketplace › <Text className="font-bold text-[#1A1A1A]">{article.titre}</Text>
        </Text>
        <Pressable
          onPress={partager}
          accessibilityLabel="Partager"
          className="items-center justify-center rounded-[10px]"
          style={{ width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
          <Ionicons name="share-social-outline" size={17} color="#1A1A1A" />
        </Pressable>
        <Pressable
          onPress={retour}
          accessibilityLabel="Fermer"
          className="items-center justify-center rounded-[10px]"
          style={{ width: 38, height: 38, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
          <Ionicons name="close" size={18} color="#1A1A1A" />
        </Pressable>
      </View>

      {/* Onglets */}
      <View className="flex-row bg-white" style={{ borderBottomWidth: 1, borderBottomColor: BORDURE_CARTE }}>
        {(
          [
            { id: 'article' as const, libelle: 'Article' },
            { id: 'commentaires' as const, libelle: 'Commentaires', compteur: 0 },
            { id: 'recommander' as const, libelle: 'Recommander' },
          ]
        ).map((o) => {
          const actif = onglet === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setOnglet(o.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
              style={{ borderBottomWidth: 2, borderBottomColor: actif ? '#1A1A1A' : 'transparent' }}>
              <Text className="text-[13.5px] font-extrabold" style={{ color: actif ? '#1A1A1A' : 'rgba(0,0,0,0.5)' }}>
                {o.libelle}
              </Text>
              {typeof o.compteur === 'number' ? (
                <View className="rounded-full px-1.5" style={{ backgroundColor: '#E5E7EB' }}>
                  <Text className="text-[11px] font-black" style={{ color: 'rgba(0,0,0,0.6)' }}>{o.compteur}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}>
        {onglet === 'article' ? (
          <>
            {/* Galerie */}
            <View className="m-3 bg-white rounded-[20px] p-0 overflow-hidden" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
              <View style={{ width: largeurCadre, height: hauteurGalerie }} className="bg-[#F2F0EA] relative">
                {article.photos.length > 0 ? (
                  <FlatList
                    data={article.photos}
                    keyExtractor={(uri, i) => `${i}-${uri}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={surDefilement}
                    extraData={hauteurGalerie}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item }}
                        alt={article.titre}
                        style={{ width: largeurCadre, height: hauteurGalerie }}
                        contentFit="cover"
                        transition={150}
                        onLoad={(e) => {
                          // Bornes de la fiche : au-delà, la photo prendrait tout l'écran.
                          const r = ratioAffichage(e.source.width, e.source.height, 0.6, 1.8);
                          if (r) setRatiosPhotos((prev) => (prev[item] === r ? prev : { ...prev, [item]: r }));
                        }}
                      />
                    )}
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                  </View>
                )}

                {/* « En stock » / « Épuisé » */}
                <View
                  className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: 'rgba(40,40,40,0.82)' }}>
                  <View className="rounded-full" style={{ width: 7, height: 7, backgroundColor: stock ? VERT : '#9CA3AF' }} />
                  <Text className="text-[12px] font-extrabold text-white">{stock ? 'En stock' : 'Épuisé'}</Text>
                </View>

                {/* Cœur et plein écran */}
                <View className="absolute right-3 top-3 gap-2">
                  <Pressable
                    onPress={() => setFavori(!favori)}
                    accessibilityLabel="Ajouter aux favoris"
                    className="items-center justify-center rounded-full bg-white"
                    style={{ width: 40, height: 40 }}>
                    <Ionicons name={favori ? 'heart' : 'heart-outline'} size={19} color={favori ? '#EF4444' : '#1A1A1A'} />
                  </Pressable>
                  {nbVignettes > 0 ? (
                    <Pressable
                      onPress={() => router.push(`/marketplace/photos?id=${article.id}&index=${photoActive}` as Href)}
                      accessibilityLabel="Voir en plein écran"
                      className="items-center justify-center rounded-full bg-white"
                      style={{ width: 40, height: 40 }}>
                      <Ionicons name="scan-outline" size={18} color="#1A1A1A" />
                    </Pressable>
                  ) : null}
                </View>

                {article.photos.length > 0 ? (
                  <View className="absolute bottom-3 self-center rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(40,40,40,0.82)', left: '50%', transform: [{ translateX: -34 }] }}>
                    <Text className="text-[12px] font-extrabold text-white">Photo {photoActive + 1}/{article.photos.length}</Text>
                  </View>
                ) : null}
              </View>

              {nbVignettes > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 10 }}>
                  {Array.from({ length: nbVignettes }).map((_, i) => miniature(i))}
                </ScrollView>
              ) : null}
            </View>

            {/* Boutique */}
            <View className="mx-3 mb-3 flex-row items-center gap-3 rounded-[18px] bg-white p-3.5" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
              <View className="items-center justify-center rounded-[14px]" style={{ width: 48, height: 48, backgroundColor: '#FFE9D6' }}>
                <Ionicons name="storefront-outline" size={22} color="#EA580C" />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-[15px] font-black text-[#1A1A1A]" numberOfLines={1}>{article.boutiqueNom}</Text>
                  {article.boutiqueVerifie ? (
                    <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#E0ECFF' }}>
                      <Ionicons name="checkmark" size={11} color="#2563EB" />
                      <Text className="text-[11px] font-extrabold" style={{ color: '#2563EB' }}>Vérifié</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{lieuBoutique(article)}</Text>
              </View>
              {article.boutiqueId ? (
                <Pressable onPress={() => router.push(`/marketplace/boutique/${article.boutiqueId}` as Href)} hitSlop={8}>
                  <Text className="text-[13.5px] font-extrabold" style={{ color: '#2563EB' }}>Boutique →</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Titre, prix, stock */}
            <View className="mx-3 mb-3 rounded-[18px] bg-white p-4" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
              <Text className="text-[18px] font-black text-[#1A1A1A] leading-[24px]">{article.titre}</Text>
              <Text className="text-[28px] font-black mt-2" style={{ color: '#D97706' }}>
                {prixLisible(article.prixXof)} <Text className="text-[14px] font-extrabold">FCFA</Text>
              </Text>
              {peuRestant ? (
                <Text className="text-[12.5px] font-extrabold mt-1" style={{ color: '#B45309' }}>
                  Quelques articles restants ({article.quantite})
                </Text>
              ) : null}
            </View>

            {/* Caractéristiques : uniquement ce que la base sait */}
            <View className="mx-3 mb-3 rounded-[18px] bg-white p-4" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
              <Text className="text-[14.5px] font-black text-[#1A1A1A] mb-2">Caractéristiques</Text>
              {[
                ['Catégorie', libelleCategorie(article.categorie)],
                ['Disponibilité', stock ? `En stock (${article.quantite})` : 'Épuisé'],
                ['Boutique', article.boutiqueNom],
                ['Lieu', lieuBoutique(article)],
              ].map(([k, v], i) => (
                <View key={k} className="flex-row justify-between py-2" style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(0,0,0,0.06)' }}>
                  <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{k}</Text>
                  <Text className="text-[13px] font-bold text-[#1A1A1A] flex-1 text-right ml-4" numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>

            <View className="mx-3 rounded-[18px] bg-white p-4" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
              <Text className="text-[14.5px] font-black text-[#1A1A1A] mb-2">Description</Text>
              <Text className="text-[13.5px] leading-[21px]" style={{ color: 'rgba(0,0,0,0.7)' }}>
                {article.description || 'Aucune description détaillée renseignée pour cet article.'}
              </Text>
            </View>
          </>
        ) : onglet === 'commentaires' ? (
          <View className="m-3 items-center rounded-[20px] bg-white p-8" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
            <Ionicons name="chatbubbles-outline" size={34} color="#9CA3AF" />
            <Text className="text-[14px] font-black text-[#1A1A1A] mt-2">Aucun commentaire pour le moment</Text>
            <Text className="text-[12.5px] text-center mt-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Pour poser une question au vendeur, utilisez « Discuter ».
            </Text>
          </View>
        ) : (
          <View className="m-3 items-center rounded-[20px] bg-white p-8 gap-3" style={{ borderWidth: 1, borderColor: BORDURE_CARTE }}>
            <Ionicons name="share-social-outline" size={34} color="#2563EB" />
            <Text className="text-[14px] font-black text-[#1A1A1A]">Recommander cet article</Text>
            <Text className="text-[12.5px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Envoyez le lien à un proche : WhatsApp, SMS ou toute autre application.
            </Text>
            <Pressable onPress={partager} className="rounded-full px-6 py-3" style={{ backgroundColor: '#2563EB' }}>
              <Text className="text-white text-[13.5px] font-black">Partager le lien</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Barre fixe : cœur · Discuter · WhatsApp · panier (maquette 16) */}
      <View
        className="absolute left-0 right-0 bg-white px-3 pt-2.5"
        style={{ bottom: 0, paddingBottom: 10, borderTopWidth: 1, borderTopColor: BORDURE_CARTE, zIndex: 20 }}>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setFavori(!favori)}
            accessibilityLabel="Favori"
            className="items-center justify-center rounded-[14px]"
            style={{ width: 50, height: 52, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)' }}>
            <Ionicons name={favori ? 'heart' : 'heart-outline'} size={21} color={favori ? '#EF4444' : '#1A1A1A'} />
          </Pressable>

          <Pressable
            onPress={discuter}
            disabled={!discussionPossible || ouverture}
            accessibilityRole="button"
            className="flex-1 flex-row items-center gap-2 rounded-[14px] px-2"
            style={{ height: 52, backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399', opacity: !discussionPossible ? 0.5 : 1 }}>
            <View className="items-center justify-center rounded-[10px]" style={{ width: 34, height: 34, backgroundColor: '#D7F2EA' }}>
              {ouverture ? <ActivityIndicator size="small" color="#047857" /> : <Ionicons name="chatbubble-outline" size={16} color="#047857" />}
            </View>
            <Text className="text-[14px] font-black text-[#1A1A1A]">Discuter</Text>
          </Pressable>

          <Pressable
            onPress={ecrireSurWhatsapp}
            disabled={estMonArticle || !whatsapp}
            accessibilityRole="button"
            className="flex-1 flex-row items-center gap-2 rounded-[14px] px-2"
            style={{ height: 52, backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399', opacity: estMonArticle || !whatsapp ? 0.5 : 1 }}>
            <View className="items-center justify-center rounded-[10px]" style={{ width: 34, height: 34, backgroundColor: '#D7F2EA' }}>
              <Ionicons name="logo-whatsapp" size={17} color="#047857" />
            </View>
            <Text className="text-[14px] font-black text-[#1A1A1A]">WhatsApp</Text>
          </Pressable>

          <Pressable
            onPress={commanderDirect}
            accessibilityLabel="Commander"
            className="items-center justify-center rounded-[14px]"
            style={{ width: 52, height: 52, backgroundColor: '#111' }}>
            <Ionicons name="cart-outline" size={21} color="#fff" />
          </Pressable>
        </View>
      </View>

      <CommandeRapideModal
        visible={commandeOuverte}
        article={article}
        lienWhatsapp={whatsapp ? whatsapp.split('?')[0] : null}
        onFermer={() => setCommandeOuverte(false)}
      />
    </View>
  );
}
