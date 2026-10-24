import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ScreenCapture from 'expo-screen-capture';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import IndisponibleNeutre from '@/components/IndisponibleNeutre';
import { chargerModelesCv, lienTelechargementCv, urlApercuPage, useEnteteImages } from '@/lib/achatCv';
import { grilleFiligrane, messageAchatCv, pageDepuisDecalage, prixFcfa, TEXTE_FILIGRANE, texteBoutonApercu, textePage, type ModeleCv } from '@/lib/achatCvLogique';
import { achatsNumeriquesAutorises } from '@/lib/biensNumeriques';

// Aperçu PROTÉGÉ d'un modèle de CV (maquette du 24/10/2026) : plein écran sombre, pages défilées de gauche à droite (aimantation au centre, bord de la page
// suivante visible), filigrane diagonal répété « APERÇU · FACILITÉ », image basse définition légèrement floue, AUCUN bouton Télécharger / Partager /
// Imprimer / Enregistrer / Copier. Les images viennent du serveur (filigranées, basse définition) ; le fichier d'origine n'est jamais envoyé ici.
// Android : la capture d'écran est bloquée (FLAG_SECURE) tant que cet écran est ouvert. Sur iOS (règle Apple 3.1.1), message neutre.
const FOND = '#2B2A27';
const VERT = '#10B981';
const ECART = 12;

export default function AchatCvApercu() {
  return achatsNumeriquesAutorises ? <ApercuContenu /> : <IndisponibleNeutre retour={'/profil' as Href} />;
}

/** Filigrane diagonal répété sur toute la page : posé PAR-DESSUS l'image, ne reçoit aucun geste. */
function Filigrane({ largeur, hauteur }: { largeur: number; hauteur: number }) {
  const { lignes, colonnes } = grilleFiligrane(largeur, hauteur);
  const diagonale = Math.ceil(Math.sqrt(largeur * largeur + hauteur * hauteur));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          width: diagonale,
          height: diagonale,
          left: (largeur - diagonale) / 2,
          top: (hauteur - diagonale) / 2,
          transform: [{ rotate: '-30deg' }],
          justifyContent: 'space-around',
        }}>
        {Array.from({ length: lignes }).map((_, l) => (
          <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-around', marginLeft: l % 2 ? 40 : 0 }}>
            {Array.from({ length: colonnes }).map((__, c) => (
              <Text key={c} selectable={false} style={{ fontSize: 15, fontWeight: '900', letterSpacing: 2, color: 'rgba(17,24,39,0.20)' }}>
                {TEXTE_FILIGRANE}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function ApercuContenu() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { width: largeurEcran } = useWindowDimensions();
  const entete = useEnteteImages();
  const [modele, setModele] = useState<ModeleCv | null | undefined>(undefined); // undefined = chargement
  const [page, setPage] = useState(1);
  const [captureRefusee, setCaptureRefusee] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Android : bloque la capture d'écran et l'enregistrement de l'écran tant que l'aperçu est ouvert (FLAG_SECURE).
  ScreenCapture.usePreventScreenCapture('apercu-cv');

  useEffect(() => {
    let annule = false;
    chargerModelesCv()
      .then((liste) => {
        if (!annule) setModele(liste.find((m) => m.id === id) ?? null);
      })
      .catch(() => {
        if (!annule) setModele(null);
      });
    return () => {
      annule = true;
    };
  }, [id]);

  // Une tentative de capture (détectée par le système quand il le permet) affiche le message gris pendant quelques secondes.
  useEffect(() => {
    let abonnement: { remove: () => void } | null = null;
    try {
      abonnement = ScreenCapture.addScreenshotListener(() => {
        setCaptureRefusee(true);
        if (minuterie.current) clearTimeout(minuterie.current);
        minuterie.current = setTimeout(() => setCaptureRefusee(false), 5000);
      });
    } catch {
      // Détection indisponible sur cet appareil : la capture reste bloquée par FLAG_SECURE.
    }
    return () => {
      abonnement?.remove();
      if (minuterie.current) clearTimeout(minuterie.current);
    };
  }, []);

  const largeurPage = Math.round(largeurEcran * 0.78);
  const hauteurPage = Math.round((largeurPage * 4) / 3);
  const pas = largeurPage + ECART;
  const marge = (largeurEcran - largeurPage) / 2;

  const surDefilement = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (modele) setPage(pageDepuisDecalage(e.nativeEvent.contentOffset.x, pas, modele.nbPages));
    },
    [modele, pas]
  );

  const actionPrincipale = async () => {
    if (!modele) return;
    if (!modele.achete) {
      router.push(`/mon-profil/achat-cv-payer?id=${modele.id}&depuis=apercu` as Href);
      return;
    }
    const lien = await lienTelechargementCv(modele.id);
    if (!lien) {
      Alert.alert('Modèle indisponible', "Ce modèle n'a pas pu être ouvert. Réessayez dans un instant.");
      return;
    }
    Linking.openURL(lien).catch(() => Alert.alert('Téléchargement impossible', "Aucune application n'a pu ouvrir ce fichier."));
  };

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/profil?onglet=achat-cv' as Href));
  const pages = modele && modele.nbPages > 0 ? Array.from({ length: modele.nbPages }, (_, i) => i + 1) : [];
  const capture = messageAchatCv('capture');

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      {/* L'en-tête du profil est masqué ; la barre du bas de Facilité reste visible (rendue par la racine). */}
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
          <Pressable onPress={retour} accessibilityLabel="Retour" className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Text className="flex-1 text-[17px] font-black text-white" numberOfLines={1}>{modele?.nom ?? 'Aperçu'}</Text>
          {modele && !modele.achete ? <Text className="text-[15px] font-black" style={{ color: '#FCD58F' }}>{prixFcfa(modele.prixXof)}</Text> : null}
        </View>

        {captureRefusee ? (
          <View className="mx-4 mb-2" style={{ backgroundColor: capture.fond, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text className="text-[13.5px] font-bold" style={{ color: capture.texteCouleur }}>{capture.texte}</Text>
          </View>
        ) : null}

        {modele === undefined ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : modele === null || pages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-[14.5px] text-center" style={{ color: 'rgba(255,255,255,0.75)' }}>Cet aperçu n&apos;est pas disponible pour le moment.</Text>
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <FlatList
              horizontal
              data={pages}
              keyExtractor={(n) => String(n)}
              showsHorizontalScrollIndicator={false}
              snapToInterval={pas}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: marge, gap: ECART }}
              onScroll={surDefilement}
              scrollEventThrottle={32}
              renderItem={({ item }) => {
                const adresse = urlApercuPage(modele.id, item);
                return (
                  <View style={{ width: largeurPage, height: hauteurPage, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    {adresse && entete ? (
                      // Image basse définition, légèrement floue, jamais mise en cache : aucune version nette n'existe côté application.
                      <Image source={{ uri: adresse, headers: entete }} alt={`Page ${item} du modèle`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="none" blurRadius={1} />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color="#9CA3AF" />
                      </View>
                    )}
                    <Filigrane largeur={largeurPage} hauteur={hauteurPage} />
                  </View>
                );
              }}
            />

            <View className="flex-row justify-center items-center gap-1.5 mt-4">
              {pages.map((n) => (
                <View key={n} style={{ height: 8, width: n === page ? 22 : 8, borderRadius: 4, backgroundColor: n === page ? VERT : 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>
            <Text className="text-[13.5px] font-bold text-center mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{textePage(page, pages.length)}</Text>
            <Text className="text-[12.5px] text-center mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Aperçu protégé : non téléchargeable.</Text>
          </View>
        )}

        {/* Barre fixe en bas : « Acheter ce modèle · PRIX » ou « Utiliser ce modèle ». */}
        {modele ? (
          <View style={{ backgroundColor: '#e3dbcc', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 }}>
            <Pressable
              onPress={actionPrincipale}
              accessibilityRole="button"
              className="items-center justify-center"
              style={{ minHeight: 56, borderRadius: 14, backgroundColor: VERT }}>
              <Text className="text-[16px] font-extrabold text-white">{texteBoutonApercu(modele)}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
