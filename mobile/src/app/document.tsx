import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// Visionneuse de document — maquette « Profil — Visionneuse PDF » (39) :
// en-tête « ‹ Retour » + nom du fichier, bouton de téléchargement à droite,
// document affiché en plein écran, barre du bas toujours visible (elle est
// posée par le layout racine).
//
// Charte §4 : tous les documents sont des PDF ouverts dans une visionneuse
// INTÉGRÉE ; seule la pièce d'identité est une image. D'où les deux rendus.
//
// Le PDF passe par Google Docs Viewer sur Android : la WebView Android ne
// sait pas afficher un PDF nativement (page blanche sinon). iOS et le web
// l'affichent directement.
const FOND_SOMBRE = '#1F2430';

function urlAffichage(url: string): string {
  if (Platform.OS === 'android') {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function VisionneuseDocumentScreen() {
  const router = useRouter();
  const { url, titre, image } = useLocalSearchParams<{ url?: string; titre?: string; image?: string }>();
  const estImage = image === '1';
  const lien = typeof url === 'string' ? url : '';

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/profil');
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06]">
          <Pressable
            onPress={retour}
            accessibilityLabel="Retour"
            className="flex-row items-center gap-1.5 bg-[#F2F0EA] rounded-full px-3 py-2">
            <Ionicons name="arrow-back" size={15} color="#1A1A1A" />
            <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Retour</Text>
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]" numberOfLines={1}>
              {titre || 'Document'}
            </Text>
            <Text className="text-[11px] text-black/45">{estImage ? 'Image' : 'PDF'}</Text>
          </View>
          <Pressable
            onPress={() => {
              if (lien) Linking.openURL(lien).catch(() => {});
            }}
            accessibilityLabel="Télécharger"
            className="w-9 h-9 rounded-xl bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="download-outline" size={16} color="#1A1A1A" />
          </Pressable>
        </View>

        <View className="flex-1" style={{ backgroundColor: FOND_SOMBRE }}>
          {!lien ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-white/70 text-[13px] text-center">Document introuvable.</Text>
            </View>
          ) : estImage ? (
            <Image source={{ uri: lien }} alt={titre || 'Document'} style={{ flex: 1 }} contentFit="contain" />
          ) : (
            <WebView source={{ uri: urlAffichage(lien) }} style={{ flex: 1, backgroundColor: FOND_SOMBRE }} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
