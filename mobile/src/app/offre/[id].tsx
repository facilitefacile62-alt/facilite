import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import BoutonAudioOffre from '@/components/BoutonAudioOffre';
import { resoudreActionOffre } from '@/lib/actionOffre';
import CandidatureRapide from '@/components/CandidatureRapide';
import { useOffreDetail } from '@/lib/useOffreDetail';
import OfferMediaView from '@/components/OfferMediaView';

// Fiche offre — maquette « Fil d'actualité Android » du 22/10/2026 : fond crème #F2F0EA, boutons ronds / cases / étiquette sur
// #e3dbcc (couleur de la barre de navigation), barre d'actions FIXE au-dessus de la barre du bas.
const FOND = '#F2F0EA';
const BEIGE = '#e3dbcc';
const TEXTE = '#111111';
const TEXTE_DOUX = 'rgba(0,0,0,0.5)';

// Description sans les marques de mise en forme du site (**gras**, lignes de tirets ou de tirets bas).
function descriptionLisible(texte: string): string {
  return String(texte ?? '')
    .replace(/\*\*/g, '')
    .split(/\r?\n/)
    .filter((ligne) => !/^\s*[_\-=]{3,}\s*$/.test(ligne))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function FicheOffreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { offre, erreur } = useOffreDetail(id);
  const insets = useSafeAreaInsets();
  const [sauvegarde, setSauvegarde] = useState(false);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [postulee, setPostulee] = useState(false);

  const urlOffre = `https://ffacilite.com/offres/${id}`;

  // Même décision que le site (resolveOfferAction, portée dans
  // lib/actionOffre.ts) : feuille Candidature Rapide, site officiel ou WhatsApp.
  const action = offre
    ? resoudreActionOffre({
        titre: offre.titre,
        entreprise: offre.entreprise,
        description: offre.description,
        externalLink: offre.externalLink,
        applicationUrl: offre.applicationUrl,
        applicationEmail: offre.applicationEmail,
        contactEmail: offre.contactEmail,
        contactWhatsapp: offre.contactWhatsapp,
      })
    : null;

  // Offres enregistrées : liste d'identifiants gardée sur l'appareil, comme sur le site (clé facilite_saved_jobs).
  useEffect(() => {
    let annule = false;
    AsyncStorage.getItem('facilite_saved_jobs')
      .then((brut) => {
        const liste: unknown = brut ? JSON.parse(brut) : [];
        if (!annule) setSauvegarde(Array.isArray(liste) && liste.map(String).includes(String(id)));
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [id]);

  const basculerSauvegarde = async () => {
    const suivant = !sauvegarde;
    setSauvegarde(suivant);
    try {
      const brut = await AsyncStorage.getItem('facilite_saved_jobs');
      const liste: string[] = (brut ? JSON.parse(brut) : []).map(String).filter((x: string) => x !== String(id));
      if (suivant) liste.push(String(id));
      await AsyncStorage.setItem('facilite_saved_jobs', JSON.stringify(liste));
    } catch {}
  };

  // Un seul bouton de partage (l'icône flèche de l'en-tête), qui ouvre le menu natif du téléphone : c'est LUI
  // qui propose WhatsApp, Facebook, Messages ou toute autre application installée — jamais trois boutons
  // séparés à choisir à l'avance. Avant, trois boutons WhatsApp/LinkedIn/Facebook dans le corps de la page
  // avaient été pris pour des « comptes » déjà connectés (signalé le 25/09/2026) ; ce ne sont pourtant que des
  // raccourcis de partage — supprimés au profit de ce seul bouton, plus proche de ce à quoi l'utilisateur
  // s'attend.
  const partager = async () => {
    if (!offre) return;
    try {
      await Share.share({
        title: offre.titre,
        message: `Découvrez cette offre d'emploi sur Facilité :\n${offre.titre} chez ${offre.entreprise}\n\nPostulez ici : ${urlOffre}`,
        url: urlOffre,
      });
    } catch {}
  };

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {offre === null && !erreur ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" size="large" />
          </View>
        ) : erreur || !offre ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13px] font-medium text-center" style={{ color: TEXTE_DOUX }}>
              Impossible de charger cette offre pour le moment.
            </Text>
            <Pressable onPress={() => router.back()} className="mt-4 px-5 py-2.5 rounded-full" style={{ backgroundColor: BEIGE }}>
              <Text className="text-[12.5px] font-bold" style={{ color: TEXTE }}>Retour</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
            {/* En-tête : retour à gauche, signet à droite, ronds #e3dbcc */}
            <View className="flex-row items-center justify-between px-4 pt-2">
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/offres'))}
                accessibilityLabel="Retour"
                className="items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: BEIGE }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5L8 12L15 19" stroke={TEXTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              <Pressable
                onPress={basculerSauvegarde}
                accessibilityLabel={sauvegarde ? "Retirer l'offre des enregistrées" : "Enregistrer l'offre"}
                className="items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: BEIGE }}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path
                    d="M6 3.5H18V21L12 16.5L6 21V3.5Z"
                    stroke={sauvegarde ? '#10B981' : 'rgba(0,0,0,0.6)'}
                    strokeWidth={1.8}
                    fill={sauvegarde ? '#10B981' : 'none'}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>

            {/* Bloc entreprise : tuile, titre, entreprise en vert, étiquette du contrat */}
            <View className="px-5 pt-4 items-center">
              <View className="w-16 h-16 rounded-[18px] items-center justify-center" style={{ backgroundColor: '#2563EB' }}>
                <Text className="font-black text-[24px]" style={{ color: TEXTE }}>
                  {offre.logo}
                </Text>
              </View>
              <Text className="text-[20px] font-extrabold mt-3.5 text-center leading-7" style={{ color: TEXTE }}>
                {offre.titre}
              </Text>
              <Text className="text-[14px] mt-1 text-center font-bold" style={{ color: '#047857' }}>
                {offre.entreprise} · {offre.localisation}
              </Text>
              <View className="flex-row gap-1.5 mt-3">
                <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: BEIGE }}>
                  <Text className="text-[12px] font-black" style={{ color: TEXTE }}>{offre.contrat}</Text>
                </View>
              </View>
            </View>

            {/* Trois cases : Salaire / Publiée / Candidats */}
            <View className="flex-row gap-2.5 px-5 pt-5">
              <View className="flex-1 rounded-2xl p-3 items-center" style={{ backgroundColor: BEIGE }}>
                <Text className="text-[13px] font-black text-center" style={{ color: '#047857' }}>{offre.salaire}</Text>
                <Text className="text-[11px] mt-0.5" style={{ color: TEXTE_DOUX }}>Salaire</Text>
              </View>
              <View className="flex-1 rounded-2xl p-3 items-center" style={{ backgroundColor: BEIGE }}>
                <Text className="text-[13px] font-black" style={{ color: TEXTE }}>{offre.posted}</Text>
                <Text className="text-[11px] mt-0.5" style={{ color: TEXTE_DOUX }}>Publiée</Text>
              </View>
              <View className="flex-1 rounded-2xl p-3 items-center" style={{ backgroundColor: BEIGE }}>
                <Text className="text-[13px] font-black" style={{ color: '#047857' }}>{offre.applicantsCount}</Text>
                <Text className="text-[11px] mt-0.5" style={{ color: TEXTE_DOUX }}>Candidats</Text>
              </View>
            </View>

            {/* Visuel de l'offre : « Agrandir » en haut à droite, « ffacilite.com » en bas */}
            <View className="px-5 pt-5">
              <OfferMediaView media={offre.rawImage || offre.posterUri} borderRadius={18} dark={false} />
            </View>

            {/* Description complète */}
            <Text className="px-5 pt-5 pb-1.5 text-[15px] font-black" style={{ color: TEXTE }}>Description</Text>
            <Text className="px-5 text-[13.5px] leading-6 font-normal" style={{ color: 'rgba(0,0,0,0.75)' }}>{descriptionLisible(offre.description)}</Text>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Barre d'actions FIXE, juste au-dessus de la barre de navigation du bas : Aide · Audio · Partager · Postuler. Elle reste en
          place pendant qu'on fait défiler la description. */}
      {offre && !erreur && (
        <View
          className="absolute left-0 right-0 bottom-0 flex-row items-center gap-2 px-4 py-2.5"
          style={{ backgroundColor: BEIGE, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
          {/* Aide (remplace « J'aime », décision du 13/10) : vidéo « comment postuler » */}
          <Pressable
            onPress={() =>
              router.push(
                `/aide-video?titre=${encodeURIComponent(offre.titre)}${offre.externalLink ? `&lien=${encodeURIComponent(offre.externalLink)}` : ''}` as Href
              )
            }
            accessibilityLabel="Aide : comment postuler"
            className="items-center justify-center rounded-full bg-white"
            style={{ width: 44, height: 44, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)' }}>
            <Ionicons name="help-circle-outline" size={21} color="rgba(0,0,0,0.55)" />
          </Pressable>
          <BoutonAudioOffre url={offre.audioUrl} />
          <Pressable
            onPress={() => partager()}
            accessibilityLabel="Partager"
            className="items-center justify-center rounded-full bg-white"
            style={{ width: 44, height: 44, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)' }}>
            <Ionicons name="share-social-outline" size={19} color="rgba(0,0,0,0.55)" />
          </Pressable>
          <Pressable
            onPress={() => (action && action.type !== 'facilite' ? Linking.openURL(action.url).catch(() => {}) : setFeuilleOuverte(true))}
            disabled={postulee}
            accessibilityRole="button"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-full"
            style={{
              height: 44,
              paddingHorizontal: 8,
              backgroundColor: postulee ? '#D5F5E6' : action && action.type === 'whatsapp' ? '#25D366' : '#2563EB',
            }}>
            <Ionicons
              name={postulee ? 'checkmark-circle' : action && action.type === 'whatsapp' ? 'logo-whatsapp' : action && action.type === 'externe' ? 'open-outline' : 'paper-plane'}
              size={16}
              color={postulee ? '#047857' : '#FFFFFF'}
            />
            <Text
              className="text-[13.5px] font-black"
              style={{ color: postulee ? '#047857' : '#FFFFFF', flexShrink: 1 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}>
              {postulee ? 'Candidature envoyée' : action && action.type !== 'facilite' ? action.libelle : 'Postuler via Facilité'}
            </Text>
          </Pressable>
        </View>
      )}

      {offre && !erreur ? (
        <CandidatureRapide
          visible={feuilleOuverte}
          offre={{ id: offre.id, titre: offre.titre, entreprise: offre.entreprise, contactEmail: action?.type === 'facilite' ? (action.email ?? undefined) : undefined }}
          onFermer={() => setFeuilleOuverte(false)}
          onEnvoyee={() => setPostulee(true)}
        />
      ) : null}
    </View>
  );
}
