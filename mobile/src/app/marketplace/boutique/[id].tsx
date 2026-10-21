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
import { chargerArticles, prixLisible, urlPhoto, type ArticleMarketplace } from '@/lib/marketplace';
import { chargerBoutiquePublique, type BoutiquePublique } from '@/lib/vendeur';

// Page d'une boutique vue par un visiteur — même aspect que « Ma boutique » du vendeur, lui-même identique
// à l'onglet Profil de Facilité : photo ronde, nom, lieu, bouton « Contacter » à la place de « Modifier
// infos », onglets Article · Service · Établissement, cartes à vignette. Lecture seule : pas de « + » sur la
// photo, pas d'interrupteur « Rendre … visible », pas de modification. Le propriétaire qui ouvre sa propre
// boutique est renvoyé vers « Ma boutique » (avec ses commandes de gestion).
//
// Les données sont les vraies. Non affichés, faute de donnée : le compteur « 4 K ami(e)s » des maquettes
// (aucun système d'amis). Une rubrique que la boutique n'a pas renseignée le dit au lieu d'inventer.
const VERT = '#10B981';
const BLEU = '#2563EB';
const VIOLET = '#7C3AED';
const FOND = '#F2F0EA';
// Mêmes valeurs que l'onglet Profil (src/app/(tabs)/profil.tsx).
const CARTE = '#FFFFFF';
const BORDURE = 'rgba(0,0,0,0.06)';
const STYLE_CARTE = { borderRadius: 16, backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE } as const;

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

  const lieuVirgule = [boutique.quartier, boutique.ville].filter(Boolean).join(', ') || 'Boutique sur Facilité';
  const logo = boutique.logo_photo ? urlPhoto(boutique.logo_photo) : null;
  const numero = (boutique.telephone_whatsapp ?? '').replace(/[^\d]/g, '');
  const contacter = () => {
    if (!numero) return;
    Linking.openURL(`https://wa.me/${numero}`).catch(() => Alert.alert('WhatsApp', "Impossible d'ouvrir WhatsApp."));
  };

  const statutDispo = (
    <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
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
        {/* Retour */}
        <View className="px-4 pt-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8E4DA' }}>
            <Ionicons name="arrow-back" size={18} color={BLEU} />
          </Pressable>
        </View>

        {/* En-tête : photo ronde, nom, lieu, Contacter — comme l'onglet Profil */}
        <View className="px-4 pt-3">
          <View className="flex-row items-center gap-3">
            <View className="w-[72px] h-[72px] rounded-full bg-[#E8E4DA] items-center justify-center overflow-hidden">
              {logo ? (
                <Image source={{ uri: logo }} alt={boutique.nom} style={{ width: 72, height: 72 }} contentFit="cover" />
              ) : avatar ? (
                <Image source={{ uri: avatar }} alt={boutique.nom} style={{ width: 72, height: 72 }} contentFit="cover" />
              ) : (
                <Ionicons name="storefront" size={28} color="rgba(0,0,0,0.3)" />
              )}
            </View>

            <View className="flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="storefront" size={15} color="#B45309" />
                <Text className="text-[16px] font-black text-[#1A1A1A] flex-1" numberOfLines={1}>
                  {boutique.nom}
                </Text>
              </View>
              <Text className="text-[12px] text-black/50 mt-1" numberOfLines={2}>
                {lieuVirgule}
              </Text>
            </View>

            {numero ? (
              <Pressable
                onPress={contacter}
                className="flex-row items-center gap-1.5 bg-white rounded-xl px-3 py-2.5"
                style={{ borderWidth: 1, borderColor: BORDURE }}>
                <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                <Text className="text-[12px] font-bold text-[#1A1A1A]">Contacter</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Onglets Article / Service / Établissement — même style que Documents / Fonctionnalités */}
        <View className="flex-row gap-2.5 px-4 mt-4">
          {(
            [
              { id: 'article' as const, label: 'Article', icone: 'pricetag-outline' as const },
              { id: 'service' as const, label: 'Service', icone: 'construct-outline' as const },
              { id: 'etablissement' as const, label: 'Établissement', icone: 'storefront-outline' as const },
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
            articles === null || articles.length === 0 ? (
              rubriqueVide("Cette boutique n'a aucun article en vente pour l'instant.")
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {articles.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/marketplace/${a.id}` as Href)}
                    className="rounded-2xl overflow-hidden"
                    style={{ width: '47.5%', backgroundColor: CARTE, borderWidth: 1, borderColor: BORDURE }}>
                    <View className="w-full aspect-square bg-[#E8E4DA] items-center justify-center">
                      {a.photos[0] ? (
                        <Image source={{ uri: a.photos[0] }} alt={a.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <Ionicons name="image-outline" size={30} color="rgba(0,0,0,0.3)" />
                      )}
                      {a.quantite > 0 ? (
                        <View className="absolute top-2 left-2 rounded px-1.5 py-0.5" style={{ backgroundColor: '#DC2626' }}>
                          <Text className="text-white text-[9px] font-black">LIVE</Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="p-2.5">
                      <Text className="text-[12px] font-bold text-[#1A1A1A]" numberOfLines={1}>{a.titre}</Text>
                      <Text className="text-[12px] font-black text-[#1A1A1A] mt-0.5">{prixLisible(a.prixXof)} CFA</Text>
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
                <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
                  <Text className="text-[13px] font-black text-[#111]">Catégorie de l&apos;établissement :</Text>
                  <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: '#D1FAE5' }}>
                    <Text className="text-[10.5px] font-black" style={{ color: '#047857', letterSpacing: 0.4 }}>
                      {libelleCategorieEtablissement(boutique.categorie_etablissement).toUpperCase()}
                    </Text>
                  </View>
                </View>
                {statutDispo}
                <View className="p-3.5 gap-2.5" style={STYLE_CARTE}>
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
