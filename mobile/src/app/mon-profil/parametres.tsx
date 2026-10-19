import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteModifierInfos from '@/components/EnteteModifierInfos';
import { ecrireTheme, lireLangue, lireTheme, libelleLangue, type CodeLangue, type ThemeChoisi } from '@/lib/preferencesConnexion';
import { useT } from '@/lib/i18n';

// « Modifier infos » > Paramètres — maquette 48 (version du 12/10/2026) : le
// titre « Paramètres », sa phrase d'explication, la carte APPARENCE (Thème) +
// LANGUE (Langue de l'application, ouvre le choix de langue), puis
// CONFIDENTIALITÉ ET SÉCURITÉ (Confidentialité et informations juridiques ;
// Sécurité & Connexion). Ces éléments reviennent avec la nouvelle maquette ;
// les anciennes longues listes de liens restent retirées.
export default function ParametresScreen() {
  const t = useT();
  const tr = t; // « t » est aussi le nom du paramètre de choisirTheme : on garde l'accès à la traduction sous « tr »
  const router = useRouter();
  const [langue, setLangue] = useState<CodeLangue>('fr');
  const [theme, setTheme] = useState<ThemeChoisi>('clair');
  useFocusEffect(
    useCallback(() => {
      lireLangue().then(setLangue);
      lireTheme().then(setTheme);
    }, [])
  );
  const choisirTheme = (t: ThemeChoisi) => {
    setTheme(t);
    ecrireTheme(t);
    if (t !== 'clair') Alert.alert(tr(t === 'sombre' ? 'Thème sombre enregistré' : 'Thème automatique enregistré'), tr("Votre choix est mémorisé. Le rendu sombre n'est pas encore disponible : l'application reste claire pour l'instant."));
  };
  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteModifierInfos actif="parametres" />

        <ScrollView contentContainerClassName="px-4 pt-5 pb-10 gap-5" showsVerticalScrollIndicator={false}>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-[22px] font-black text-[#1A1A1A]">{t('Paramètres')}</Text>
              <Ionicons name="chevron-down" size={15} color="#1A1A1A" />
            </View>
            <Text className="text-[14px] mt-1.5" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {t('Personnalisez votre expérience visuelle et vos préférences.')}
            </Text>
          </View>

          <View className="bg-white" style={{ borderRadius: 18, padding: 16 }}>
            <Text className="text-[12px] font-extrabold" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('APPARENCE')}</Text>
            <View className="flex-row items-center gap-3 mt-3">
              <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#F0EEE8' }}>
                <Ionicons name="contrast-outline" size={20} color="#1A1A1A" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-black text-[#1A1A1A]">{t('Thème')}</Text>
                <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{t('Apparence de Facilité')}</Text>
              </View>
              {/* Trois choix qui répondent : le choix est mémorisé et son bouton s'allume. Seul le rendu clair existe
                  aujourd'hui, ce que l'application dit quand on choisit Auto ou Sombre. */}
              <View className="flex-row items-center" style={{ backgroundColor: '#F0EEE8', borderRadius: 22, padding: 4, gap: 2 }}>
                {([
                  { id: 'clair' as const, icone: 'sunny-outline' as const, nom: 'Thème clair' },
                  { id: 'auto' as const, icone: 'settings-outline' as const, nom: 'Thème automatique' },
                  { id: 'sombre' as const, icone: 'moon-outline' as const, nom: 'Thème sombre' },
                ]).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => choisirTheme(t.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: theme === t.id }}
                    accessibilityLabel={t.nom}
                    className="items-center justify-center"
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme === t.id ? '#fff' : 'transparent' }}>
                    <Ionicons name={t.icone} size={18} color={theme === t.id ? '#1A1A1A' : 'rgba(0,0,0,0.5)'} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginTop: 14 }} />
            <Text className="text-[12px] font-extrabold mt-3.5" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('LANGUE')}</Text>
            <Pressable onPress={() => router.push('/mon-profil/langue' as Href)} className="flex-row items-center gap-3 mt-3" accessibilityRole="button">
              <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0EEE8' }}>
                <Ionicons name="globe-outline" size={20} color="#1A1A1A" />
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-black text-[#1A1A1A]">{t("Langue de l'application")}</Text>
                <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{libelleLangue(langue)}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="rgba(0,0,0,0.4)" />
            </Pressable>
          </View>

          <View>
            <Text className="text-[12px] font-extrabold mb-2 px-1" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>{t('CONFIDENTIALITÉ ET SÉCURITÉ')}</Text>
            <View className="bg-white overflow-hidden" style={{ borderRadius: 18 }}>
              {[
                { icone: 'shield-checkmark-outline' as const, titre: 'Confidentialité et informations juridiques', sous: 'Visibilité du profil, pages légales', route: '/mon-profil/confidentialite' },
                { icone: 'lock-closed-outline' as const, titre: 'Sécurité & Connexion', sous: 'Mot de passe, appareils', route: '/mon-profil/securite' },
              ].map((r, i) => (
                <Pressable
                  key={r.route}
                  onPress={() => router.push(r.route as Href)}
                  className="flex-row items-center gap-3 px-4 py-3.5"
                  style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(0,0,0,0.06)' }}>
                  <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#F0EEE8' }}>
                    <Ionicons name={r.icone} size={19} color="rgba(0,0,0,0.6)" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-black text-[#1A1A1A]">{t(r.titre)}</Text>
                    <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>{t(r.sous)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
