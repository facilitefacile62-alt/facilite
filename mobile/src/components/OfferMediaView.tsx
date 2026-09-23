import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { parseOfferImages } from '@/lib/offerMedia';

interface OfferMediaViewProps {
  media: unknown;
  height?: number;
  borderRadius?: number;
  onPress?: () => void;
  dark?: boolean;
}

export default function OfferMediaView({
  media,
  height = 220,
  borderRadius = 14,
  onPress,
  dark = false,
}: OfferMediaViewProps) {
  const images = parseOfferImages(media);
  const [indexActif, setIndexActif] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  if (images.length === 0 || erreur) {
    return null;
  }

  // Cas avec 1 seule image (majorité des affiches)
  if (images.length === 1) {
    const imageUrl = images[0];
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={{
          width: '100%',
          height,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: dark ? '#15181D' : '#F3F4F6',
          marginTop: 12,
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          position: 'relative',
        }}>
        {chargement && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#15181D' : '#F3F4F6',
              zIndex: 1,
            }}>
            <ActivityIndicator size="small" color="#2563EB" />
          </View>
        )}
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          priority="high"
          onLoadEnd={() => setChargement(false)}
          onError={() => {
            setChargement(false);
            setErreur(true);
          }}
        />
        {/* Badge indicateur HD */}
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
          <Ionicons name="image-outline" size={11} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>Affiche officielle</Text>
        </View>
      </Pressable>
    );
  }

  // Cas avec plusieurs photos (galerie swipable)
  return (
    <View
      style={{
        width: '100%',
        height,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: dark ? '#15181D' : '#F3F4F6',
        marginTop: 12,
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        position: 'relative',
      }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, idx) => `img-${idx}`}
        onMomentumScrollEnd={(e) => {
          const slide = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
          setIndexActif(slide);
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={{ width: Dimensions.get('window').width - 24, height }}>
            <Image
              source={{ uri: item }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        )}
      />
      {/* Indicateur de position (ex: 1/3) */}
      <View
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          backgroundColor: 'rgba(0,0,0,0.65)',
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 12,
        }}>
        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
          {indexActif + 1} / {images.length}
        </Text>
      </View>
    </View>
  );
}
