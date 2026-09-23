import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseOfferImages } from '@/lib/offerMedia';

interface OfferMediaViewProps {
  media: unknown;
  height?: number;
  borderRadius?: number;
  onPress?: () => void;
  dark?: boolean;
  enableLightbox?: boolean;
}

export default function OfferMediaView({
  media,
  height = 240,
  borderRadius = 14,
  onPress,
  dark = false,
  enableLightbox = true,
}: OfferMediaViewProps) {
  const images = parseOfferImages(media);
  const [indexActif, setIndexActif] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  const handlePressImage = (idx: number) => {
    if (onPress) {
      onPress();
    } else if (enableLightbox) {
      setLightboxIndex(idx);
    }
  };

  return (
    <>
      {/* Lightbox / Visionneuse Plein Écran */}
      {enableLightbox && lightboxIndex !== null && (
        <Modal
          visible={true}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setLightboxIndex(null)}>
          <View style={{ flex: 1, backgroundColor: '#0B0D10' }}>
            <SafeAreaView style={{ flex: 1 }}>
              {/* Header Lightbox */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  Affiche de recrutement {images.length > 1 ? `(${lightboxIndex + 1}/${images.length})` : ''}
                </Text>
                <Pressable
                  onPress={() => setLightboxIndex(null)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Image Plein Écran */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
                <Image
                  source={{ uri: images[lightboxIndex] }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* Rendu 1 image */}
      {images.length === 1 ? (
        <Pressable
          onPress={() => handlePressImage(0)}
          style={{
            width: '100%',
            height,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: dark ? '#15181D' : '#F1EFE9',
            marginTop: 12,
            borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            position: 'relative',
          }}>
          <Image
            source={{ uri: images[0] }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            priority="high"
          />
          {/* Badge indicateur Affiche */}
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.65)',
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}>
            <Ionicons name="image-outline" size={11} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>Affiche officielle</Text>
          </View>
        </Pressable>
      ) : (
        /* Rendu multi-photos */
        <View
          style={{
            width: '100%',
            height,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: dark ? '#15181D' : '#F1EFE9',
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
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => handlePressImage(index)}
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
      )}
    </>
  );
}
