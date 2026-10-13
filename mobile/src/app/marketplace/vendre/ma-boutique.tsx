import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES_ETABLISSEMENT, METIERS_SERVICE, libelleCategorieEtablissement } from '@/lib/boutiqueCategories';
import { NOM_JOUR, chargerHoraires, estAujourdhui, type HoraireJour } from '@/lib/horaires';
import { prixLisible, urlPhoto } from '@/lib/marketplace';
import {
  chargerMesArticles,
  chargerMesBoutiques,
  definirDisponibiliteBoutique,
  definirVisibiliteBoutique,
  modifierBoutique,
  type MaBoutique,
  type MonArticle,
} from '@/lib/vendeur';

// « Ma boutique » du vendeur — maquettes « Boutique » (35 Article, 36 Service,
// 37 Établissement) : en-tête Marketplace, ligne retour · NOM DE LA BOUTIQUE ·
// crayon, bloc profil (logo, nom, badge BOUTIQUE, « Modifier infos »), onglets
// ARTICLE · SERVICE · ÉTABLISSEMENT et, en tête de chaque onglet,
// l'interrupteur « Rendre … visible ». « Devenir livreur » est dans SERVICE.
//
// Les données sont les vraies (boutique, articles, horaires du vendeur). Ce que
// les maquettes montrent sans source en base n'est pas inventé : le compteur
// « 4 K ami(e)s » (aucun système d'amis) et la photo du logo (aucun champ logo
// sur la boutique) ne sont pas affichés ; le « + » du logo annonce que
// l'envoi arrive plus tard.
const VERT = '#10B981';
const BLEU = '#2563EB';
const VIOLET = '#7C3AED';
const FOND = '#F2F0EA';

type Onglet = 'article' | 'service' | 'etablissement';

export default function MaBoutiqueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [boutique, setBoutique] = useState<MaBoutique | null | undefined>(undefined); // undefined = chargement
  const [articles, setArticles] = useState<MonArticle[]>([]);
  const [horaires, setHoraires] = useState<HoraireJour[]>([]);
  const [onglet, setOnglet] = useState<Onglet>('article');
  const [basculeEnCours, setBasculeEnCours] = useState(false);

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

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/marketplace/profil'));

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

  const lieu = [boutique.quartier, boutique.ville].filter(Boolean).join(' · ') || 'Sénégal';

  const blocDisponibilite = (
    <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
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
    <View className="flex-row items-center justify-between bg-white px-4 py-3.5" style={{ borderRadius: 18 }}>
      <View className="flex-1 pr-3">
        <Text className="text-[13.5px] font-black text-[#111]">{libelle}</Text>
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

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Retour · NOM · crayon */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8E4DA' }}>
            <Ionicons name="arrow-back" size={19} color={BLEU} />
          </Pressable>
          <Text className="flex-1 text-center text-[13px] font-black" style={{ letterSpacing: 1.4 }} numberOfLines={1}>
            {boutique.nom.toUpperCase()}
          </Text>
          <Pressable onPress={() => router.push('/marketplace/vendre/modifier-boutique' as Href)} accessibilityLabel="Modifier la boutique" className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8E4DA' }}>
            <Ionicons name="pencil" size={16} color="#1A1A1A" />
          </Pressable>
        </View>

        {/* Profil */}
        <View className="flex-row gap-3 px-4">
          <Pressable
            onPress={() => Alert.alert('Logo de la boutique', "L'envoi du logo arrive dans une prochaine mise à jour.")}
            accessibilityLabel="Changer le logo"
            style={{ width: 72, height: 72 }}>
            <View className="items-center justify-center" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D9D2C3' }}>
              <Ionicons name="storefront" size={26} color="#0d3b34" />
            </View>
            <View className="absolute items-center justify-center" style={{ right: -2, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: BLEU, borderWidth: 2, borderColor: FOND }}>
              <Ionicons name="add" size={15} color="#fff" />
            </View>
          </Pressable>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2">
              <Ionicons name="storefront-outline" size={14} color="#D97706" />
              <Text className="text-[15px] font-black text-[#111] shrink" numberOfLines={1}>{boutique.nom}</Text>
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: VIOLET }}>
                <Text className="text-[9px] font-black text-white" style={{ letterSpacing: 0.5 }}>BOUTIQUE</Text>
              </View>
              <Pressable
                onPress={() => router.push('/marketplace/vendre/modifier-boutique' as Href)}
                className="flex-row items-center gap-1 bg-white rounded-full ml-auto"
                style={{ height: 30, paddingHorizontal: 10 }}>
                <Ionicons name="pencil" size={11} color="#1A1A1A" />
                <Text className="text-[11px] font-black text-[#111]">Modifier infos</Text>
              </Pressable>
            </View>
            <Text className="text-[12px] mt-1.5" style={{ color: 'rgba(0,0,0,0.6)' }}>Boutique officielle partenaire sur Facilité Sénégal</Text>
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
            <>
              {interrupteur('Rendre mes articles visibles')}
              {articles.length === 0 ? (
                <View className="items-center py-10 gap-2">
                  <Ionicons name="pricetags-outline" size={34} color="#9CA3AF" />
                  <Text className="text-[13px] text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>Aucun article publié pour l&apos;instant.</Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  {articles.map((a) => {
                    const photo = a.photos[0] ? urlPhoto(a.photos[0]) : null;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() =>
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
                          )
                        }
                        className="bg-white overflow-hidden"
                        style={{ width: '47.5%', borderRadius: 16 }}>
                        <View className="items-center justify-center" style={{ height: 110, backgroundColor: '#EDE9E1' }}>
                          {photo ? (
                            <Image source={{ uri: photo }} alt={a.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          ) : (
                            <Ionicons name="image-outline" size={26} color="rgba(0,0,0,0.35)" />
                          )}
                          <View className="absolute rounded" style={{ top: 8, left: 8, backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text className="text-[9px] font-black text-white">LIVE</Text>
                          </View>
                        </View>
                        <View className="p-2.5">
                          <Text className="text-[12.5px] font-black text-[#111]" numberOfLines={1}>{a.titre}</Text>
                          <Text className="text-[13px] font-black text-[#111] mt-1">{prixLisible(a.prix_xof)} CFA</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          {onglet === 'service' ? (
            <>
              {interrupteur('Rendre mon service visible')}

              <View className="p-3.5 gap-2" style={{ borderRadius: 18, backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#D5E4FB' }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="construct-outline" size={15} color="#1A1A1A" />
                    <Text className="text-[12.5px] font-black text-[#111]">Métier / Prestation</Text>
                  </View>
                  {!editionMetier ? (
                    <Pressable
                      onPress={() => {
                        setMetierSaisi(boutique.metier ?? '');
                        setDescriptionSaisie(boutique.description_prestation ?? '');
                        setEditionMetier(true);
                      }}
                      hitSlop={8}
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: '#DCE8FB' }}>
                      <Text className="text-[11px] font-black" style={{ color: BLEU }}>✎ Modifier</Text>
                    </Pressable>
                  ) : null}
                </View>
                {editionMetier ? (
                  <View className="gap-2.5">
                    <View className="flex-row flex-wrap gap-1.5">
                      {METIERS_SERVICE.map((m) => (
                        <Pressable key={m} onPress={() => setMetierSaisi(m)} className="rounded-full px-2.5 py-1.5" style={{ backgroundColor: metierSaisi === m ? BLEU : '#fff' }}>
                          <Text className="text-[11px] font-bold" style={{ color: metierSaisi === m ? '#fff' : '#374151' }}>{m}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={metierSaisi}
                      onChangeText={setMetierSaisi}
                      placeholder="Autre (précisez)"
                      placeholderTextColor="rgba(0,0,0,0.4)"
                      className="bg-white text-[13px] text-[#111]"
                      style={{ height: 44, borderRadius: 12, paddingHorizontal: 12 }}
                    />
                    <TextInput
                      value={descriptionSaisie}
                      onChangeText={setDescriptionSaisie}
                      placeholder="Spécialités, zone d'intervention…"
                      placeholderTextColor="rgba(0,0,0,0.4)"
                      multiline
                      className="bg-white text-[13px] text-[#111]"
                      style={{ minHeight: 64, borderRadius: 12, paddingHorizontal: 12, paddingTop: 10, textAlignVertical: 'top' }}
                    />
                    <View className="flex-row gap-2">
                      <Pressable onPress={() => setEditionMetier(false)} className="flex-1 items-center justify-center bg-white" style={{ height: 44, borderRadius: 12 }}>
                        <Text className="text-[12.5px] font-black" style={{ color: 'rgba(0,0,0,0.6)' }}>Annuler</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => enregistrerRubrique({ metier: metierSaisi, descriptionPrestation: descriptionSaisie, typeBoutique: 'service' })}
                        disabled={enregistrement}
                        className="flex-1 items-center justify-center"
                        style={{ height: 44, borderRadius: 12, backgroundColor: BLEU, opacity: enregistrement ? 0.6 : 1 }}>
                        {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-[12.5px] font-black text-white">Enregistrer</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text className="text-[14.5px] font-black" style={{ color: BLEU }}>{boutique.metier || 'Non renseigné'}</Text>
                    <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.55)' }}>{boutique.description_prestation || 'Prestation de service sur mesure.'}</Text>
                  </>
                )}
              </View>

              {blocDisponibilite}

              <Pressable
                onPress={() => router.push('/marketplace/vendre/horaires' as Href)}
                className="flex-row items-center justify-center gap-2 bg-white"
                style={{ height: 48, borderRadius: 14 }}>
                <Ionicons name="calendar-outline" size={16} color={BLEU} />
                <Text className="text-[13px] font-black text-[#111]">Programmer des horaires</Text>
              </Pressable>

              <BoutonAction titre="Devenir livreur" sousTitre="Livrez les commandes autour de vous" icone="bicycle-outline" onPress={() => router.push('/marketplace/vendre/livreur')} />
            </>
          ) : null}

          {onglet === 'etablissement' ? (
            <>
              {interrupteur('Rendre mon établissement visible')}

              <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
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

              <View className="bg-white p-3.5 gap-2.5" style={{ borderRadius: 18 }}>
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
