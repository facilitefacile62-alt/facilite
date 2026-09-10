import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { SITE_URL, WEB_ECRANS, type CleEcranWeb } from '@/lib/webEcrans';

// Écran générique pour les pages web-only lourdes embarquées en WebView
// (voir plan "Écrans WebView pour les pages lourdes web-only"). Point 1 :
// uniquement des cibles publiques (`authRequise: false` dans
// webEcrans.ts) — le pont de session pour les cibles authentifiées
// (/auth/mobile-bridge) arrive au Point 2, pas construit ici.
export default function EcranWeb() {
  const { cle } = useLocalSearchParams<{ cle: string }>();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [peutReculer, setPeutReculer] = useState(false);
  const [cleChargement, setCleChargement] = useState(0);

  const config = WEB_ECRANS[cle as CleEcranWeb];
  // Aucune cible authRequise n'existe encore (Point 2 les ajoutera avec le
  // pont de session) — filet de sécurité si une entrée future est ajoutée
  // à webEcrans.ts sans que ce composant soit mis à jour. Calculé au
  // rendu plutôt que dans un effet : pas de setState à déclencher pour une
  // valeur dérivée directement de `config`.
  const authNonSupportee = config?.authRequise === true;

  const onBackPress = useCallback(() => {
    if (peutReculer) {
      webviewRef.current?.goBack();
      return true;
    }
    return false;
  }, [peutReculer]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onBackPress]);

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    const { url } = request;
    const memeOrigine = url.startsWith(SITE_URL) || url.startsWith('about:');
    if (!memeOrigine) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setPeutReculer(nav.canGoBack);
  }, []);

  if (!config) {
    return (
      <View className="flex-1 bg-white">
        <SafeAreaView className="flex-1 items-center justify-center px-8" edges={['top']}>
          <Text className="text-[13px] text-black/50 text-center">Écran introuvable.</Text>
          <Pressable onPress={() => router.back()} className="mt-4 px-5 py-2.5 rounded-full bg-gray-100">
            <Text className="text-[#1A1A1A] text-[12.5px] font-bold">Retour</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-4 py-3 border-b border-black/[0.06]">
          <Pressable onPress={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
          </Pressable>
          <Text className="flex-1 text-[15px] font-extrabold text-[#1A1A1A]" numberOfLines={1}>
            {config.titre}
          </Text>
          <Pressable
            onPress={() => {
              setErreur(false);
              setCleChargement((n) => n + 1);
            }}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="refresh" size={16} color="#1A1A1A" />
          </Pressable>
        </View>

        <View className="flex-1">
          {authNonSupportee ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-[13px] text-black/50 text-center">
                Cet écran n&apos;est pas encore disponible.
              </Text>
            </View>
          ) : erreur ? (
            <View className="flex-1 items-center justify-center px-8 gap-4">
              <Text className="text-[13px] text-black/50 text-center">
                Impossible de charger cette page pour le moment.
              </Text>
              <Pressable
                onPress={() => {
                  setErreur(false);
                  setCleChargement((n) => n + 1);
                }}
                className="bg-[#2563EB] rounded-full px-5 py-2.5">
                <Text className="text-white text-[13px] font-bold">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              key={cleChargement}
              ref={webviewRef}
              source={{ uri: `${SITE_URL}${config.chemin}` }}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onNavigationStateChange={onNavigationStateChange}
              onLoadStart={() => setChargement(true)}
              onLoadEnd={() => setChargement(false)}
              onError={() => {
                setChargement(false);
                setErreur(true);
              }}
              onHttpError={() => {
                setChargement(false);
                setErreur(true);
              }}
              startInLoadingState={false}
            />
          )}

          {chargement && !erreur && !authNonSupportee && (
            <View className="absolute inset-0 items-center justify-center bg-white">
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
