import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { dataUriAvatarBoutique } from '@/lib/avatarBoutique';
import { libelleCategorieEtablissement } from '@/lib/boutiqueCategories';
import { NOM_JOUR, chargerHoraires, estAujourdhui, type HoraireJour } from '@/lib/horaires';
import { chargerArticles, prixLisible, type ArticleMarketplace } from '@/lib/marketplace';
import { chargerBoutiquePublique, type BoutiquePublique } from '@/lib/vendeur';

// Page d'une boutique vue par un visiteur — même présentation que « Ma boutique » du vendeur
// (maquettes « Boutique » 35 Article, 36 Service, 37 Établissement) : en-tête, retour · NOM, bloc profil
// (avatar, nom, badge BOUTIQUE, contact), onglets ARTICLE · SERVICE · ÉTABLISSEMENT. Lecture seule :
// pas de crayon, pas d'interrupteur « Rendre … visible », pas de « Modifier ». Le propriétaire qui ouvre
// sa propre boutique est renvoyé vers « Ma boutique » (avec ses commandes de gestion).
//
// Les données sont les vraies. Non affichés, faute de donnée : le compteur « 4 K ami(e)s » des maquettes
// (aucun système d'amis). Une rubrique que la boutique n'a pas renseignée le dit au lieu d'inventer.
const VERT = '#10B981';
const BLEU = '#2563EB';
const VIOLET = '#7C3AED';
const FOND = '#F2F0EA';

type Onglet = 'article' | 'service' | 'etablissement';

export default function BoutiquePubliqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [boutique, setBoutique] = useState<BoutiquePublique | null | undefined>(undefined); // undefined = chargement
  const [articles, setArticles] = useState<ArticleMarketplace[] | null>(null);
  const [horaires, setHoraires] = useState<HoraireJour[]>([]);
  const [onglet, setOnglet] = useState<Onglet>('article');
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!id) return;
    let annule = false;
    Promise.all([chargerBoutiquePublique(id), chargerArticles({ boutiqueId: id, limite: 60 }), chargerHoraires(id).catch(() => [])])
      .then(([b, a, h]) => {
        if (annule) return;
        setBoutique(b);
        setArticles(a);
        setHoraires(h);
      })
      .catch(() => {
        if (!annule) {
          setErreur(true);
          setBoutique(null);
        }
      });
    return () => {
      annule = true;
    };
  }, [id]);

  // Le propriétaire retrouve sa page de gestion.
  useEffect(() => {
    if (boutique && user?.id && boutique.owner_id === user.id) router.replace('/marketplace/vendre/ma-boutique' as Href);
  }, [boutique, user?.id, router]);

  const configAvatar = boutique?.avatar_config ?? null;
  const avatar = useMemo(() => {
    if (!configAvatar) return null;
    try {
      return dataUriAvatarBoutique(configAvatar, 144);
    } catch {
      return null;
    }
  }, [configAvatar]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/marketplace'));

  const entete = (
    <SafeAreaView edges={['top']} style={{ backgroundColor: '#e3dbcc' }}>
      <MarketplaceHeader />
    </SafeAreaView>
  );

  if (boutique === undefined) {
    return (
      <View className="flex-1" style={{ backgroundColor: FOND }}>
        {entete}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={VERT} />
        </View>
      </View>
    );
  }

  if (boutique === null) {
    return (
      <View className="flex-1" style={{ backgroundColor: FOND }}>
        {entete}
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Ionicons name="storefront-outline" size={36} color="#9CA3AF" />
          <Text className="text-[13.5px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
            {erreur ? 'Impossible de charger cette boutique pour le moment.' : "Cette boutique n'est pas disponible."}
          </Text>
          <Pressable onPress={retour} className="rounded-full px-5 py-2.5 bg-white">
            <Text className="text-[13px] font-black text-[#111]">Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const lieu = [boutique.quartier, boutique.ville].filter(Boolean).join(' · ') || 'Sénégal';
  const numero = (boutique.telephone_whatsapp ?? '').replace(/[^\d]/g, '');
  const contacter = () => {
    if (!numero) return;
    Linking.openURL(`https://wa.me/${numero}`).catch(() => Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp."));
  };

  const statutDispo = (
    <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
      <View className="flex-row items-center gap-2">
        <View style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: VERT }} />
        <Text className="text-[13px] font-black text-[#111]">Disponibilité</Text>
      </View>
      <View className="flex-row items-center gap-2 self-start rounded-full px-3 py-2" style={{ backgroundColor: boutique.disponible_manuel ? '#D1FAE5' : '#EFEDE7' }}>
        <Ionicons name={boutique.disponible_manuel ? 'flash' : 'pause'} size={13} color={boutique.disponible_manuel ? '#047857' : 'rgba(0,0,0,0.5)'} />
        <Text className="text-[12px] font-black" style={{ color: boutique.disponible_manuel ? '#047857' : '#1A1A1A' }}>
          {boutique.disponible_manuel ? 'Disponible maintenant' : 'Indisponible'}
        </Text>
      </View>
    </View>
  );

  const rubriqueVide = (texte: string) => (
    <View className="items-center py-10 gap-2 px-6">
      <Ionicons name="information-circle-outline" size={32} color="#9CA3AF" />
      <Text className="text-[13px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>{texte}</Text>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      {entete}

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Retour · NOM */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8E4DA' }}>
            <Ionicons name="arrow-back" size={19} color={BLEU} />
          </Pressable>
          <Text className="flex-1 text-center text-[13px] font-black" style={{ letterSpacing: 1.4 }} numberOfLines={1}>
            {boutique.nom.toUpperCase()}
          </Text>
          <View style={{ width: 44, height: 44 }} />
        </View>

        {/* Profil */}
        <View className="flex-row gap-3 px-4">
          <View className="items-center justify-center overflow-hidden" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D9D2C3' }}>
            {avatar ? (
              <Image source={{ uri: avatar }} alt={boutique.nom} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <Ionicons name="storefront" size={26} color="#0d3b34" />
            )}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Ionicons name="storefront-outline" size={14} color="#D97706" />
              <Text className="text-[15px] font-black text-[#111] shrink" numberOfLines={1}>{boutique.nom}</Text>
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: VIOLET }}>
                <Text className="text-[9px] font-black text-white" style={{ letterSpacing: 0.5 }}>BOUTIQUE</Text>
              </View>
              {numero ? (
                <Pressable onPress={contacter} className="flex-row items-center gap-1 bg-white rounded-full ml-auto" style={{ height: 30, paddingHorizontal: 10 }}>
                  <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                  <Text className="text-[11px] font-black text-[#111]">Contacter</Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="text-[12px] mt-1.5" style={{ color: 'rgba(0,0,0,0.6)' }}>Boutique officielle partenaire sur Facilité Sénégal · Vente d&apos;articles &amp; livraison express</Text>
            <Text className="text-[12px] font-black mt-0.5 text-[#111]">{lieu}</Text>
          </View>
        </View>

        {/* Onglets */}
        <View className="flex-row bg-white mx-4 mt-4 p-1.5" style={{ borderRadius: 22 }}>
          {(['article', 'service', 'etablissement'] as const).map((o) => {
            const actif = onglet === o;
            return (
              <Pressable
                key={o}
                onPress={() => setOnglet(o)}
                accessibilityRole="tab"
                accessibilityState={{ selected: actif }}
                className="flex-1 items-center justify-center"
                style={{ height: 44, borderRadius: 18, backgroundColor: actif ? '#111' : 'transparent' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-[11.5px] font-black" style={{ letterSpacing: 0.6, color: actif ? '#fff' : '#374151' }}>
                  {o === 'article' ? 'ARTICLE' : o === 'service' ? 'SERVICE' : 'ÉTABLISSEMENT'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="px-4 mt-3 gap-3">
          {onglet === 'article' ? (
            articles === null || articles.length === 0 ? (
              rubriqueVide("Cette boutique n'a aucun article en vente pour l'instant.")
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {articles.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/marketplace/${a.id}` as Href)}
                    className="bg-white overflow-hidden"
                    style={{ width: '47.5%', borderRadius: 16 }}>
                    <View className="items-center justify-center" style={{ height: 110, backgroundColor: '#EDE9E1' }}>
                      {a.photos[0] ? (
                        <Image source={{ uri: a.photos[0] }} alt={a.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <Ionicons name="image-outline" size={26} color="rgba(0,0,0,0.35)" />
                      )}
                      {a.quantite > 0 ? (
                        <View className="absolute rounded" style={{ top: 8, left: 8, backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text className="text-[9px] font-black text-white">LIVE</Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="p-2.5">
                      <Text className="text-[12.5px] font-black text-[#111]" numberOfLines={1}>{a.titre}</Text>
                      <Text className="text-[13px] font-black text-[#111] mt-1">{prixLisible(a.prixXof)} CFA</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          ) : null}

          {onglet === 'service' ? (
            boutique.metier || boutique.description_prestation ? (
              <>
                <View className="p-3.5 gap-2" style={{ borderRadius: 18, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#D5E4FB' }}>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="construct-outline" size={15} color="#1A1A1A" />
                    <Text className="text-[12.5px] font-black text-[#111]">Métier / Prestation</Text>
                  </View>
                  <Text className="text-[14.5px] font-black" style={{ color: BLEU }}>{boutique.metier || 'Non renseigné'}</Text>
                  <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.55)' }}>{boutique.description_prestation || 'Prestation de service sur mesure.'}</Text>
                </View>
                {statutDispo}
              </>
            ) : (
              rubriqueVide("Cette boutique ne propose pas de service pour l'instant.")
            )
          ) : null}

          {onglet === 'etablissement' ? (
            boutique.categorie_etablissement ? (
              <>
                <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
                  <Text className="text-[13px] font-black text-[#111]">Catégorie de l&apos;établissement :</Text>
                  <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: '#D1FAE5' }}>
                    <Text className="text-[10.5px] font-black" style={{ color: '#047857', letterSpacing: 0.4 }}>
                      {libelleCategorieEtablissement(boutique.categorie_etablissement).toUpperCase()}
                    </Text>
                  </View>
                </View>
                {statutDispo}
                <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
                  <View className="flex-row items-center gap-2">
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: VIOLET }} />
                    <Text className="text-[13px] font-black text-[#111]">Horaires d&apos;ouverture</Text>
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
            ) : (
              rubriqueVide("Cette boutique n'est pas un établissement.")
            )
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
