import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewSource } from 'react-native-webview/lib/WebViewTypes';

import { supabase } from '@/lib/supabase';
import { SITE_URL, WEB_ECRANS, type CleEcranWeb } from '@/lib/webEcrans';

// Écran générique pour les pages web-only lourdes embarquées en WebView
// (voir plan "Écrans WebView pour les pages lourdes web-only"). Pour une
// cible authRequise (ex. creer-cv), la WebView charge d'abord
// POST /auth/mobile-bridge avec les jetons de la session déjà ouverte dans
// l'app — la redirection serveur qui suit amène la WebView sur la page
// réelle déjà connectée, sans reconnexion demandée à l'utilisateur.
export default function EcranWeb() {
  const { cle, template, id } = useLocalSearchParams<{ cle: string; template?: string; id?: string }>();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [detailErreur, setDetailErreur] = useState('');
  // undefined = lecture en cours, null = aucune session. Les jetons sont relus JUSTE avant d'ouvrir la page :
  // getSession() renouvelle un jeton expiré, alors que l'état du contexte peut dater de la dernière ouverture
  // de l'app (le pont refuse un jeton expiré : 401).
  const [jetons, setJetons] = useState<{ acces: string; renouvellement: string } | null | undefined>(undefined);
  const [peutReculer, setPeutReculer] = useState(false);
  const [cleChargement, setCleChargement] = useState(0);

  const config = WEB_ECRANS[cle as CleEcranWeb];
  // Seuls des écrans déjà protégés par l'app (session déjà vérifiée avant
  // d'arriver ici) mènent à une cible authRequise : l'absence de session est
  // donc un cas anormal, pas le chemin attendu — affiché plutôt que de
  // poster des jetons vides vers le serveur.
  const authRequise = config?.authRequise === true;
  const sessionManquante = authRequise && jetons === null;
  const jetonsEnLecture = authRequise && jetons === undefined;

  useEffect(() => {
    if (!authRequise) return;
    let annule = false;
    supabase.auth.getSession().then(({ data }) => {
      if (annule) return;
      const s = data.session;
      setJetons(s ? { acces: s.access_token, renouvellement: s.refresh_token } : null);
    });
    return () => {
      annule = true;
    };
  }, [authRequise, cleChargement]);

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

  // Jamais dans l'URL (jamais un log d'accès, jamais un historique de
  // navigateur) : les jetons voyagent uniquement dans le corps de la requête.
  // Pas de `headers` ici : react-native-webview le documente explicitement
  // comme non pris en charge sur Android pour une requête POST (seulement
  // pour GET) — la Content-Type "application/x-www-form-urlencoded" est de
  // toute façon posée automatiquement par l'API Android sous-jacente
  // (WebView.postUrl) pour ce type de requête.
  const source: WebViewSource = config.authRequise
    ? {
        uri: `${SITE_URL}/auth/mobile-bridge`,
        method: 'POST',
        body: `access_token=${encodeURIComponent(jetons?.acces ?? '')}&refresh_token=${encodeURIComponent(
          jetons?.renouvellement ?? ''
        )}&cible=${encodeURIComponent(cle)}${template ? `&template=${encodeURIComponent(template)}` : ''}${id ? `&id=${encodeURIComponent(id)}` : ''}`,
      }
    : { uri: `${SITE_URL}${config.chemin}` };

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
              setDetailErreur('');
              setJetons(undefined);
              setCleChargement((n) => n + 1);
            }}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="refresh" size={16} color="#1A1A1A" />
          </Pressable>
        </View>

        <View className="flex-1">
          {sessionManquante ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-[13px] text-black/50 text-center">Connectez-vous pour accéder à cet écran.</Text>
            </View>
          ) : erreur ? (
            <View className="flex-1 items-center justify-center px-8 gap-4">
              <Text className="text-[13px] text-black/50 text-center">
                Impossible de charger cette page pour le moment.
              </Text>
              {detailErreur ? <Text className="text-[11px] text-black/35 text-center">{detailErreur}</Text> : null}
              <Pressable
                onPress={() => {
                  setErreur(false);
                  setDetailErreur('');
                  setJetons(undefined);
                  setCleChargement((n) => n + 1);
                }}
                className="bg-[#2563EB] rounded-full px-5 py-2.5">
                <Text className="text-white text-[13px] font-bold">Réessayer</Text>
              </Pressable>
            </View>
          ) : jetonsEnLecture ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          ) : (
            <WebView
              key={cleChargement}
              ref={webviewRef}
              source={source}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onNavigationStateChange={onNavigationStateChange}
              onLoadStart={() => setChargement(true)}
              onLoadEnd={() => setChargement(false)}
              onError={(e) => {
                setChargement(false);
                setDetailErreur(e.nativeEvent.description || 'Erreur réseau');
                setErreur(true);
              }}
              onHttpError={(e) => {
                setChargement(false);
                setDetailErreur(`Erreur ${e.nativeEvent.statusCode} — ${new URL(e.nativeEvent.url).pathname}`);
                setErreur(true);
              }}
              startInLoadingState={false}
            />
          )}

          {chargement && !erreur && !sessionManquante && (
            <View className="absolute inset-0 items-center justify-center bg-white">
              <ActivityIndicator color="#2563EB" size="large" />
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
