import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useOffreDetail } from '@/lib/useOffreDetail';
import OfferMediaView from '@/components/OfferMediaView';

export default function FicheOffreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { offre, erreur } = useOffreDetail(id);
  const insets = useSafeAreaInsets();
  const [sauvegarde, setSauvegarde] = useState(false);
  const [logoErreur, setLogoErreur] = useState(false);

  const urlOffre = `https://ffacilite.com/offres/${id}`;

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

  const partager = async (plateforme?: string) => {
    if (!offre) return;
    const message = `Découvrez cette offre d'emploi sur Facilité :\n${offre.titre} chez ${offre.entreprise}\n\nPostulez ici : ${urlOffre}`;

    if (plateforme === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => {});
      return;
    }
    if (plateforme === 'linkedin') {
      Linking.openURL(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlOffre)}`).catch(() => {});
      return;
    }
    if (plateforme === 'facebook') {
      Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlOffre)}`).catch(() => {});
      return;
    }

    try {
      await Share.share({
        title: offre.titre,
        message,
        url: urlOffre,
      });
    } catch {}
  };

  return (
    <View className="flex-1 bg-[#0B0D10]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {offre === null && !erreur ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#10B981" size="large" />
          </View>
        ) : erreur || !offre ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[13px] text-[#F5F6F7]/50 font-medium text-center">
              Impossible de charger cette offre pour le moment.
            </Text>
            <Pressable onPress={() => router.back()} className="mt-4 px-5 py-2.5 rounded-full bg-[#15181D]">
              <Text className="text-[#F5F6F7] text-[12.5px] font-bold">Retour</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-36">
            {/* Header barre navigation */}
            <View className="flex-row items-center justify-between px-4 pt-2">
              <Pressable
                onPress={() => router.back()}
                className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 5L8 12L15 19" stroke="#F5F6F7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => partager()}
                  className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
                  <Ionicons name="share-social-outline" size={18} color="#F5F6F7" />
                </Pressable>
                <Pressable
                  onPress={basculerSauvegarde}
                  className="w-[38px] h-[38px] rounded-full bg-[#15181D] items-center justify-center">
                  <Svg width={18} height={18} viewBox="0 0 24 24">
                    <Path
                      d="M6 3.5H18V21L12 16.5L6 21V3.5Z"
                      stroke={sauvegarde ? '#10B981' : '#F5F6F7'}
                      strokeWidth={1.8}
                      fill={sauvegarde ? '#10B981' : 'none'}
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
              </View>
            </View>

            {/* En-tête Entreprise & Titre */}
            <View className="px-5 pt-4 items-center">
              {offre.posterUri && !logoErreur ? (
                <Image
                  source={{ uri: offre.posterUri }}
                  alt={offre.entreprise}
                  style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#15181D' }}
                  contentFit="cover"
                  transition={150}
                  onError={() => setLogoErreur(true)}
                />
              ) : (
                <View
                  className="w-16 h-16 rounded-[18px] items-center justify-center shadow-sm"
                  style={{ backgroundColor: offre.logoBg }}>
                  <Text className="text-white font-black text-[22px]">{offre.logo}</Text>
                </View>
              )}
              <Text className="text-[20px] font-extrabold text-[#F5F6F7] mt-3.5 text-center leading-7">
                {offre.titre}
              </Text>
              <Text className="text-[14px] text-[#F5F6F7]/60 mt-1 text-center font-medium">
                {offre.entreprise} · {offre.localisation}
              </Text>
              <View className="flex-row gap-1.5 mt-3">
                <View className="px-3 py-1.5 rounded-full bg-white/[0.08]">
                  <Text className="text-[12px] font-bold text-[#F5F6F7]">{offre.contrat}</Text>
                </View>
              </View>
            </View>

            {/* Métriques Clés */}
            <View className="flex-row gap-2.5 px-5 pt-5">
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center border border-white/5">
                <Text className="text-[13px] font-bold text-[#10B981]">{offre.salaire}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Salaire</Text>
              </View>
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center border border-white/5">
                <Text className="text-[13px] font-bold text-[#F5F6F7]">{offre.posted}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Publiée</Text>
              </View>
              <View className="flex-1 bg-[#15181D] rounded-2xl p-3 items-center border border-white/5">
                <Text className="text-[13px] font-bold text-[#F5F6F7]">{offre.applicantsCount}</Text>
                <Text className="text-[11px] text-[#F5F6F7]/45 mt-0.5">Candidats</Text>
              </View>
            </View>

            {/* Affiche réelle de l'offre */}
            <View className="px-5">
              <OfferMediaView
                media={offre.rawImage || offre.posterUri}
                borderRadius={18}
                dark={true}
              />
            </View>

            {/* Description */}
            <Text className="px-5 pt-5 pb-1.5 text-[15px] font-bold text-[#F5F6F7]">Description de l&apos;offre</Text>
            <Text className="px-5 text-[13.5px] leading-6 text-[#F5F6F7]/75 font-normal">{offre.description}</Text>

            {/* Partage Social Universel */}
            <View className="px-5 pt-5">
              <Text className="text-[12px] font-bold text-gray-400 mb-2.5 uppercase tracking-wider">
                Partager cette opportunité
              </Text>
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={() => partager('whatsapp')}
                  className="flex-1 py-2.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 items-center justify-center flex-row gap-2">
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text className="text-[#25D366] text-[12px] font-bold">WhatsApp</Text>
                </Pressable>
                <Pressable
                  onPress={() => partager('linkedin')}
                  className="flex-1 py-2.5 rounded-xl bg-[#0077B5]/20 border border-[#0077B5]/40 items-center justify-center flex-row gap-2">
                  <Ionicons name="logo-linkedin" size={16} color="#0077B5" />
                  <Text className="text-[#0077B5] text-[12px] font-bold">LinkedIn</Text>
                </Pressable>
                <Pressable
                  onPress={() => partager('facebook')}
                  className="flex-1 py-2.5 rounded-xl bg-[#1877F2]/20 border border-[#1877F2]/40 items-center justify-center flex-row gap-2">
                  <Ionicons name="logo-facebook" size={16} color="#1877F2" />
                  <Text className="text-[#1877F2] text-[12px] font-bold">Facebook</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Barre d'action FIXE : le bouton Postuler reste visible pendant qu'on lit la description
          (même principe que la barre du bas de la fiche article Marketplace). */}
      {offre && !erreur && (
        <View
          className="absolute left-0 right-0 bottom-0 flex-row items-center gap-3 px-4 pt-3 border-t border-white/10 bg-[#0B0D10]"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <Pressable
            onPress={basculerSauvegarde}
            accessibilityLabel={sauvegarde ? "Retirer l'offre des enregistrées" : "Enregistrer l'offre"}
            className="w-12 h-12 rounded-full bg-[#15181D] border border-white/10 items-center justify-center">
            <Ionicons name={sauvegarde ? 'bookmark' : 'bookmark-outline'} size={20} color={sauvegarde ? '#10B981' : '#F5F6F7'} />
          </Pressable>
          {offre.externalLink ? (
            <Pressable
              onPress={() => Linking.openURL(offre.externalLink!).catch(() => {})}
              className="flex-1 h-12 rounded-full bg-blue-600 active:bg-blue-700 flex-row items-center justify-center gap-2">
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text className="text-white text-[15px] font-black">Postuler sur le site du recruteur</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push({ pathname: '/web/[cle]', params: { cle: 'offre', id: String(id) } })}
              className="flex-1 h-12 rounded-full bg-[#10B981] active:opacity-90 flex-row items-center justify-center gap-2">
              <Ionicons name="paper-plane" size={17} color="#0B0D10" />
              <Text className="text-[#0B0D10] text-[15px] font-black">Postuler via Facilité</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
