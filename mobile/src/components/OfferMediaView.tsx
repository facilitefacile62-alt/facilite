import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RATIO_ATTENTE, ratioAffichage } from '@/lib/formatImage';
import { parseOfferImages } from '@/lib/offerMedia';

// Rapport connu de chaque image, GARDÉ ENTRE deux affichages : la liste démonte les cartes qui sortent de l'écran, et
// sans cette mémoire chaque retour d'une affiche repartait du cadre provisoire puis « sautait » à sa vraie taille — c'est
// ce qu'on voyait comme une image qui vibre quand on fait défiler ou qu'on la touche.
const RATIOS_CONNUS = new Map<string, number>();

interface OfferMediaViewProps {
  media: unknown;
  borderRadius?: number;
  onPress?: () => void;
  dark?: boolean;
  enableLightbox?: boolean;
}

/**
 * Affiche d'offre au FORMAT RÉEL de l'image : ni hauteur imposée, ni bandes sur
 * les côtés, ni fond flou. La personne qui publie n'a rien à régler — le cadre
 * prend le rapport de l'image dès qu'elle est chargée (bornes extrêmes dans
 * lib/formatImage.ts). Plusieurs photos : la photo choisie en grand, les autres
 * en vignettes de même hauteur, chacune à son propre format.
 */
export default function OfferMediaView({
  media,
  borderRadius = 14,
  onPress,
  dark = false,
  enableLightbox = true,
}: OfferMediaViewProps) {
  const images = parseOfferImages(media);
  const [indexActif, setIndexActif] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Rapport mesuré de chaque image, indexé par adresse.
  const [ratios, setRatios] = useState<Record<string, number>>({});

  if (images.length === 0) {
    return null;
  }

  const noter = (uri: string, largeur: number, hauteur: number) => {
    const r = ratioAffichage(largeur, hauteur);
    if (r) {
      RATIOS_CONNUS.set(uri, r);
      setRatios((prev) => (prev[uri] === r ? prev : { ...prev, [uri]: r }));
    }
  };

  const indexValide = Math.min(indexActif, images.length - 1);
  const uriActive = images[indexValide];
  const ratioDe = (uri: string) => ratios[uri] ?? RATIOS_CONNUS.get(uri);
  const fondNeutre = dark ? '#0E131F' : '#F1EFE9';
  const bordure = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const handlePressImage = (idx: number) => {
    if (onPress) {
      onPress();
    } else if (enableLightbox) {
      setLightboxIndex(idx);
    }
  };

  const allerA = (delta: number) => {
    setLightboxIndex((i) => (i === null ? i : (i + delta + images.length) % images.length));
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
                  accessibilityLabel="Fermer"
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

              {/* Image Plein Écran (entière, quel que soit son format) */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
                <Image
                  source={{ uri: images[lightboxIndex] }}
                  alt="Affiche de recrutement"
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  transition={200}
                />
                {images.length > 1 && (
                  <>
                    <Pressable
                      onPress={() => allerA(-1)}
                      accessibilityLabel="Photo précédente"
                      style={{
                        position: 'absolute',
                        left: 10,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      onPress={() => allerA(1)}
                      accessibilityLabel="Photo suivante"
                      style={{
                        position: 'absolute',
                        right: 10,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
                    </Pressable>
                  </>
                )}
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      <View
        style={{
          width: '100%',
          borderRadius,
          overflow: 'hidden',
          backgroundColor: fondNeutre,
          marginTop: 10,
          borderWidth: 1,
          borderColor: bordure,
        }}>
        {/* Photo au format réel */}
        <Pressable
          onPress={() => handlePressImage(indexValide)}
          style={{ width: '100%', aspectRatio: ratioDe(uriActive) ?? RATIO_ATTENTE, position: 'relative' }}>
          <Image
            source={{ uri: uriActive }}
            alt="Affiche de recrutement"
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={0}
            priority="high"
            onLoad={(e) => noter(uriActive, e.source.width, e.source.height)}
          />

          {/* Bouton Agrandir en haut à droite */}
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              backgroundColor: 'rgba(0,0,0,0.65)',
              paddingHorizontal: 9,
              paddingVertical: 4.5,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}>
            <Ionicons name="search" size={11} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
              Agrandir{images.length > 1 ? ` (${indexValide + 1}/${images.length})` : ''}
            </Text>
          </View>

          {/* Filigrane ffacilite.com en bas */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(10,14,23,0.75)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Image source={require('@/assets/images/logo-cle.png')} alt="" style={{ width: 8, height: 16 }} contentFit="contain" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 }}>
              ffacilite.com
            </Text>
          </View>
        </Pressable>

        {/* Autres photos : vignettes de même hauteur, chacune à son format */}
        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, padding: 4 }}>
            {images.map((uri, idx) => (
              <Pressable
                key={`${uri}-${idx}`}
                onPress={() => setIndexActif(idx)}
                accessibilityLabel={`Voir la photo ${idx + 1}`}
                style={{
                  height: 64,
                  aspectRatio: ratioDe(uri) ?? 1,
                  borderRadius: Math.max(borderRadius - 6, 6),
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: idx === indexValide ? '#10E688' : 'transparent',
                  opacity: idx === indexValide ? 1 : 0.7,
                }}>
                <Image
                  source={{ uri }}
                  alt={`Photo ${idx + 1}`}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  onLoad={(e) => noter(uri, e.source.width, e.source.height)}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </>
  );
}
