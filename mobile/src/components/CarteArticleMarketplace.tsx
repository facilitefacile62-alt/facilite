import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, Pressable, Text, View } from 'react-native';

import { distanceLisible, enStock, lieuBoutique, prixLisible, type ArticleMarketplace } from '@/lib/marketplace';

// Carte article du Marketplace (maquette « Marketplace », image 15) :
// pastille LIVE, boutique vérifiée, bouton de localisation à la place
// d'« Acheter » (le prix sert de bouton d'achat). Partagée entre l'accueil
// et Autour de moi pour qu'une carte ait toujours le même visage.
const PRIX_COULEUR = '#D97706';

function ouvrirItineraire(article: ArticleMarketplace) {
  if (article.boutiqueLat != null && article.boutiqueLng != null) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${article.boutiqueLat},${article.boutiqueLng}`).catch(() => {});
  }
}

export default function CarteArticleMarketplace({ article, onPress }: { article: ArticleMarketplace; onPress: () => void }) {
  const photo = article.photos[0];
  const positionConnue = article.boutiqueLat != null && article.boutiqueLng != null;
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white rounded-2xl border border-black/[0.06] overflow-hidden active:opacity-90">
      <View className="w-full aspect-square bg-[#F2F0EA] items-center justify-center">
        {photo ? (
          <Image source={{ uri: photo }} alt={article.titre} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
        ) : (
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        )}
        {enStock(article) ? (
          <View className="absolute top-2 right-2 bg-red-600 rounded px-1.5 py-0.5">
            <Text className="text-white text-[9px] font-black">LIVE</Text>
          </View>
        ) : (
          <View className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5">
            <Text className="text-white text-[9px] font-bold">Épuisé</Text>
          </View>
        )}
        {distanceLisible(article.distanceKm) && (
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1 bg-black/65 rounded-full px-2 py-0.5">
            <Ionicons name="location" size={10} color="#6ee7c9" />
            <Text className="text-white text-[10px] font-bold">{distanceLisible(article.distanceKm)}</Text>
          </View>
        )}
      </View>
      <View className="p-2.5 gap-1">
        <View className="flex-row items-center gap-1">
          <Text className="text-[11px] font-bold text-[#1A1A1A] flex-1" numberOfLines={1}>
            {article.boutiqueNom}
          </Text>
          {article.boutiqueVerifie && <Ionicons name="checkmark-circle" size={11} color="#10B981" />}
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="location-outline" size={10} color="#9CA3AF" />
          <Text className="text-[10px] text-gray-500 flex-1" numberOfLines={1}>
            {lieuBoutique(article)}
          </Text>
        </View>
        <Text className="text-[12px] text-[#1A1A1A] leading-[16px]" numberOfLines={2}>
          {article.titre}
        </Text>
        <View className="flex-row items-center justify-between mt-0.5">
          <Text className="text-[15px] font-extrabold" style={{ color: PRIX_COULEUR }}>
            {prixLisible(article.prixXof)} <Text className="text-[10px] font-bold">FCFA</Text>
          </Text>
          <Pressable
            onPress={() => ouvrirItineraire(article)}
            disabled={!positionConnue}
            accessibilityLabel="M'y rendre"
            className="w-7 h-7 rounded-full items-center justify-center disabled:opacity-40"
            style={{ backgroundColor: '#E4DEC9' }}>
            <Ionicons name="navigate" size={13} color="#1A1A1A" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
