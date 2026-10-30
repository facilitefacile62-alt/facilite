import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteMenu, GroupeCartes } from '@/components/CarteMenu';
import EnteteModifierInfos from '@/components/EnteteModifierInfos';
import GlisserEntreOnglets from '@/components/GlisserEntreOnglets';
import { useThemeApp } from '@/context/ThemeApp';
import { viderCache } from '@/lib/cacheImages';
import { lireLangue, libelleLangue, type CodeLangue, type ThemeChoisi } from '@/lib/preferencesConnexion';
import { useT } from '@/lib/i18n';

// « Modifier infos » > Paramètres : les ÉLÉMENTS de Facilité (Thème, Langue de l'application, Confidentialité et informations juridiques,
// Sécurité & Connexion) présentés dans le DESIGN des réglages de Locaux (cartes séparées à icône verte, comme « À propos » et les
// Réglages de Locaux) — décision du 23/10/2026 : même forme, éléments propres à chaque plateforme.
export default function ParametresScreen() {
  const t = useT();
  const router = useRouter();
  const [langue, setLangue] = useState<CodeLangue>('fr');
  const { theme, appliquer } = useThemeApp();
  // « Vider le cache » : images et listes gardées sur le téléphone (rien du compte n'est touché).
  const [cacheEtat, setCacheEtat] = useState<'repos' | 'en-cours' | 'vide' | 'echec'>('repos');
  const vider = async () => {
    setCacheEtat('en-cours');
    setCacheEtat((await viderCache()) ? 'vide' : 'echec');
  };
  useFocusEffect(
    useCallback(() => {
      lireLangue().then(setLangue);
    }, [])
  );
  // Le thème s'applique tout de suite à toute l'application (clair, sombre, ou automatique = celui du téléphone).
  const choisirTheme = (choix: ThemeChoisi) => {
    appliquer(choix);
  };
  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif="parametres" />

        {/* Glisser vers la droite ouvre « À propos », comme toucher l'onglet. */}
        <GlisserEntreOnglets versGauche={'/mon-profil/a-propos' as Href}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }}>
          <View className="px-4 mb-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-[22px] font-black text-[#1A1A1A]">{t('Paramètres')}</Text>
              <Ionicons name="chevron-down" size={15} color="#1A1A1A" />
            </View>
            <Text className="text-[14px] mt-1.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {t('Personnalisez votre expérience visuelle et vos préférences.')}
            </Text>
          </View>

          <View className="px-4">
            <GroupeCartes>
              <CarteMenu
                icone="contrast-outline"
                titre={t('Thème')}
                sous={t('Apparence de Facilité')}
                onPress={() => {}}
                droite={
                  <View className="flex-row items-center" style={{ backgroundColor: '#F0EEE8', borderRadius: 22, padding: 4, gap: 2 }}>
                    {([
                      { id: 'clair' as const, icone: 'sunny-outline' as const, nom: 'Thème clair' },
                      { id: 'auto' as const, icone: 'settings-outline' as const, nom: 'Thème automatique' },
                      { id: 'sombre' as const, icone: 'moon-outline' as const, nom: 'Thème sombre' },
                    ]).map((o) => (
                      <Pressable
                        key={o.id}
                        onPress={() => choisirTheme(o.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: theme === o.id }}
                        accessibilityLabel={o.nom}
                        className="items-center justify-center"
                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme === o.id ? '#fff' : 'transparent' }}>
                        <Ionicons name={o.icone} size={17} color={theme === o.id ? '#1A1A1A' : 'rgba(0,0,0,0.5)'} />
                      </Pressable>
                    ))}
                  </View>
                }
              />
              <CarteMenu
                icone="language-outline"
                titre={t("Langue de l'application")}
                sous={libelleLangue(langue)}
                onPress={() => router.push('/mon-profil/langue' as Href)}
              />
            </GroupeCartes>

            <GroupeCartes>
              <CarteMenu
                icone="shield-checkmark-outline"
                titre={t('Confidentialité et informations juridiques')}
                sous={t('Visibilité du profil, pages légales')}
                onPress={() => router.push('/mon-profil/confidentialite' as Href)}
              />
              <CarteMenu
                icone="call-outline"
                titre={t('Coordonnées')}
                sous={t('Téléphone et e-mail du compte')}
                onPress={() => router.push('/mon-profil/coordonnees' as Href)}
              />
              <CarteMenu
                icone="id-card-outline"
                titre={t('Informations du compte')}
                sous={t("Changer ou retirer le téléphone et l'e-mail")}
                onPress={() => router.push('/mon-profil/informations-compte' as Href)}
              />
              <CarteMenu
                icone="lock-closed-outline"
                titre={t('Sécurité & Connexion')}
                sous={t('Mot de passe, appareils')}
                onPress={() => router.push('/mon-profil/securite' as Href)}
              />
            </GroupeCartes>

            <GroupeCartes>
              <CarteMenu
                icone="trash-outline"
                titre={t('Vider le cache')}
                sous={
                  cacheEtat === 'en-cours'
                    ? t('Nettoyage en cours…')
                    : cacheEtat === 'vide'
                      ? t('Cache vidé')
                      : cacheEtat === 'echec'
                        ? t('Impossible de vider le cache')
                        : t('Images et listes gardées sur ce téléphone')
                }
                onPress={vider}
                sansFleche
              />
            </GroupeCartes>
          </View>
        </ScrollView>
        </GlisserEntreOnglets>
      </SafeAreaView>
    </View>
  );
}
