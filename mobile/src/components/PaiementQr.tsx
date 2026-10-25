import { Image } from 'expo-image';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { compteARebours, lienOuvrable, texteValidite } from '@/lib/facturationLogique';

// QR et barre fixe de paiement Orange Money — mêmes éléments, même aspect que la page de facturation de Locaux (maquette du 24/10/2026) :
// le QR dans son cadre blanc avec sa légende, puis, EN BAS de l'écran, « Paiement valable 5 minutes · il reste m:ss », « Ouvrir Orange Money »
// (orange), « Ouvrir MAXIT » (noir) et « En attente de confirmation du paiement… ».
const BORDURE = '#D9D1C1';
const ORANGE_OM = '#FF6B00';

export function CarteQr({ qrCodeBase64, legende }: { qrCodeBase64: string | null; legende: string }) {
  return (
    <View className="items-center mt-3">
      {qrCodeBase64 ? (
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDURE, padding: 10 }}>
          <Image source={{ uri: `data:image/png;base64,${qrCodeBase64}` }} alt="QR code de paiement Orange Money" style={{ width: 180, height: 180 }} contentFit="contain" />
        </View>
      ) : null}
      <Text className="text-[14px] font-bold mt-2.5 text-[#1A1A1A]">{legende}</Text>
      <Text className="text-[12.5px] text-center mt-1.5" style={{ color: 'rgba(0,0,0,0.55)' }}>
        Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
      </Text>
    </View>
  );
}

function ouvrir(lien: string | null) {
  if (lienOuvrable(lien)) Linking.openURL(lien).catch(() => {});
}

export function BarrePaiement({
  validForSeconds,
  reste,
  deepLinkOm,
  deepLinkMaxit,
}: {
  validForSeconds: number;
  reste: number | null;
  deepLinkOm: string | null;
  deepLinkMaxit: string | null;
}) {
  return (
    <View style={{ backgroundColor: '#e3dbcc', borderTopWidth: 1, borderTopColor: BORDURE, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
      <Text className="text-[12.5px] font-bold text-center text-[#1A1A1A]">
        Paiement {texteValidite(validForSeconds)}
        {reste !== null ? ` · il reste ${compteARebours(reste)}` : ''}
      </Text>
      <View className="flex-row gap-2.5 mt-2">
        <Pressable
          onPress={() => ouvrir(deepLinkOm)}
          disabled={!lienOuvrable(deepLinkOm)}
          accessibilityRole="button"
          className="flex-1 items-center justify-center"
          style={{ minHeight: 52, borderRadius: 14, backgroundColor: ORANGE_OM, opacity: lienOuvrable(deepLinkOm) ? 1 : 0.45 }}>
          <Text className="text-[14.5px] font-extrabold text-white">Ouvrir Orange Money</Text>
        </Pressable>
        <Pressable
          onPress={() => ouvrir(deepLinkMaxit)}
          disabled={!lienOuvrable(deepLinkMaxit)}
          accessibilityRole="button"
          className="flex-1 items-center justify-center"
          style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#111827', opacity: lienOuvrable(deepLinkMaxit) ? 1 : 0.45 }}>
          <Text className="text-[14.5px] font-extrabold text-white">Ouvrir MAXIT</Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-center gap-2 mt-2">
        <ActivityIndicator size="small" color="rgba(0,0,0,0.4)" />
        <Text className="text-[11.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>En attente de confirmation du paiement…</Text>
      </View>
    </View>
  );
}
