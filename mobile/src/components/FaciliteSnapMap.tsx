// RÉFÉRENCE NON CONNECTÉE — déplacé ici depuis src/components/ (dépôt web
// Next.js) le 2026-09-12 : écrit en React Native pur (react-native,
// react-native-maps), jamais rendu par aucun écran, ni ici ni dans le web.
// Vérifié avant déplacement : aucun commit/plan n'indique d'écran mobile
// cible précis, et le Marketplace/"Snap Map" ne fait pas partie des 16
// écrans du handoff de design (design_handoff_facilite/pages/, racine du
// dépôt) — probablement une exploration du style "Snap Map" (Yango-like)
// de GlobeExplorateurBoutiques.jsx (web) portée en React Native, jamais
// terminée ni reliée à une route.
//
// Gardé comme référence de design (marqueurs avatar + bordure colorée,
// bulle de statut, style de carte sombre, bottom sheet, filtres) plutôt que
// supprimé : travail visiblement abouti, pas une ébauche jetable. Deux
// choses manquent avant de pouvoir le monter dans un écran réel :
//   1. react-native-maps n'est installé dans AUCUN des deux projets
//      (`npx expo install react-native-maps` depuis mobile/ requis) ;
//   2. l'import ci-dessous (`@/lib/marketplaceData`) résout maintenant vers
//      mobile/src/lib/marketplaceData.ts, qui n'existe pas — la logique de
//      statut d'ouverture (calculerStatutOuverture) n'a jamais été portée
//      côté mobile, seule la version web (src/lib/marketplaceData.js)
//      existe. Le Marketplace mobile actuel passe uniquement par une
//      WebView (mobile/src/app/web/[cle].tsx), jamais par du code natif.
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
// react-native-maps est le standard React Native pour iOS/Android
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { calculerStatutOuverture } from "@/lib/marketplaceData";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Style Sombre / Dark Snazzy Maps élégant pour Mapbox / Google Maps (Sénégal)
export const MAP_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#17202A" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A9BA8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0E141C" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#F3F4F6" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#10B981" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#243342" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1B2631" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2E4053" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1E2A38" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0B1017" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3B82F6" }],
  },
];

export interface FaciliteMembreBoutique {
  id: string;
  nom: string;
  type: "boutique" | "candidat";
  type_boutique?: string;
  mode_horaires?: string;
  horaires?: any[];
  statutAction: string; // Ex: "Boutique ouverte - Sea Plaza", "Cherche emploi à Keur Massar"
  photoUrl?: string;
  lat: number;
  lng: number;
  estCertifie?: boolean;
  estActif?: boolean;
  // Premium Marketplace (voir premium_marketplace, migration
  // 20260912020000_jetons_marketplace.sql) — champ ajouté pour cohérence
  // de type avec CarteBoutiques.jsx/GlobeExplorateurBoutiques.jsx, mais ce
  // composant n'est actuellement rendu nulle part dans le dépôt (recherche
  // de `<FaciliteSnapMap` faite avant d'écrire ceci : aucun résultat) —
  // aucun effet visible tant qu'il n'est pas reconnecté à un parent.
  estPremium?: boolean;
  telephoneWhatsapp?: string;
  quartier?: string;
  ville?: string;
  articlesOffres?: Array<{
    id: string;
    titre: string;
    prixXof?: number;
    photoUrl?: string;
  }>;
}

interface FaciliteSnapMapProps {
  membres?: FaciliteMembreBoutique[];
  onMembrePress?: (membre: FaciliteMembreBoutique) => void;
  onFermer?: () => void;
}

// Région initiale : Sénégal (Dakar & Thiès)
const REGION_SENEGAL_INITIALE: Region = {
  latitude: 14.6937,
  longitude: -17.4441,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export const FaciliteSnapMap: React.FC<FaciliteSnapMapProps> = ({
  membres = [],
  onMembrePress,
  onFermer,
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [selectedMembre, setSelectedMembre] = useState<FaciliteMembreBoutique | null>(null);
  const [filtreActif, setFiltreActif] = useState<"tous" | "boutiques" | "candidats" | "live">("tous");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Animation pour la BottomSheet volante
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Filtrage des membres selon le filtre sélectionné
  const membresFiltres = useMemo(() => {
    return membres.filter((m) => {
      if (filtreActif === "boutiques") return m.type === "boutique";
      if (filtreActif === "candidats") return m.type === "candidat";
      if (filtreActif === "live") return m.estActif;
      return true;
    });
  }, [membres, filtreActif]);

  // Ouverture du BottomSheet
  const ouvrirBottomSheet = useCallback((membre: FaciliteMembreBoutique) => {
    setSelectedMembre(membre);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Centrage fluide de la caméra
    mapRef.current?.animateToRegion(
      {
        latitude: membre.lat,
        longitude: membre.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      800
    );

    onMembrePress?.(membre);
  }, [slideAnim, onMembrePress]);

  // Fermeture du BottomSheet
  const fermerBottomSheet = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSelectedMembre(null));
  }, [slideAnim]);

  // Demande de permission GPS & Géolocalisation
  const localiserUtilisateur = async () => {
    setIsLocating(true);
    try {
      if (navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setUserLocation(loc);
            mapRef.current?.animateToRegion(
              {
                ...loc,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              1000
            );
            setIsLocating(false);
          },
          () => {
            setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch {
      setIsLocating(false);
    }
  };

  // Contacter sur WhatsApp / Postuler
  const ouvrirWhatsApp = (telephone?: string) => {
    if (!telephone) return;
    const cleanPhone = telephone.replace(/\D/g, "");
    const url = `https://wa.me/221${cleanPhone}?text=Bonjour,%20j'ai%20vu%20votre%20profil%20sur%20Facilit%C3%A9%20Snap%20Map`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* 1. Carte Interactive Sombre Mapbox / Google Maps */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_DARK_STYLE}
        initialRegion={REGION_SENEGAL_INITIALE}
        showsUserLocation={false}
        showsCompass={false}
      >
        {/* Marqueur GPS "Vous êtes ici" */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Vous êtes ici"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userMarkerContainer}>
              <View style={styles.userMarkerPulse} />
              <View style={styles.userMarkerDot} />
              <View style={styles.userMarkerLabel}>
                <Text style={styles.userMarkerText}>Vous êtes ici</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* 2. Marqueurs Personnalisés : Avatars avec Bordure Colorée & Bulles de Statut */}
        {membresFiltres.map((m) => {
          // Vert Menthe #10B981 si actif / candidat, Bleu Roi #2563EB pour boutique certifiée
          const borderColor = m.estCertifie ? "#2563EB" : m.estActif ? "#10B981" : "#10B981";

          let dotColor = m.estActif ? "#10B981" : "#9CA3AF";
          if (m.type_boutique === "etablissement") {
            if (m.mode_horaires === "toujours_ouvert") {
              dotColor = "#10B981";
            } else if (m.mode_horaires === "sur_rendez_vous") {
              dotColor = "#0284C7";
            } else if (m.horaires && m.horaires.length > 0) {
              const st = calculerStatutOuverture(m, m.horaires);
              dotColor = st?.ouvert ? "#10B981" : "#F43F5E";
            } else {
              dotColor = "#8B5CF6";
            }
          }

          return (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              onPress={() => ouvrirBottomSheet(m)}
              anchor={{ x: 0.5, y: 0.85 }}
            >
              <View style={styles.customMarkerContainer}>
                {/* Bulle d'information (Tooltip / Badge) au-dessus de l'avatar */}
                <View style={styles.markerBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: dotColor },
                    ]}
                  />
                  <Text style={styles.markerBadgeTitle} numberOfLines={1}>
                    {m.nom}
                  </Text>
                  <Text style={styles.markerBadgeSub} numberOfLines={1}>
                    · {m.statutAction || m.quartier || "Dakar"}
                  </Text>
                </View>

                {/* Avatar circulaire avec bordure colorée (#10B981 ou #2563EB) */}
                <View style={[styles.avatarRing, { borderColor }]}>
                  {m.photoUrl ? (
                    <Image source={{ uri: m.photoUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarEmoji}>
                        {m.type === "boutique" ? "🏪" : "🧑🏾‍💼"}
                      </Text>
                    </View>
                  )}
                  {m.estActif && (
                    <View style={styles.liveTag}>
                      <Text style={styles.liveTagText}>LIVE</Text>
                    </View>
                  )}
                </View>

                {/* Ombre portée au sol */}
                <View style={styles.markerShadow} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* 3. En-tête Supérieur Snap Map */}
      <View style={styles.headerFloating}>
        <View style={styles.headerRow}>
          <View style={styles.headerProfile}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarEmoji}>👤</Text>
            </View>
            <View>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>Dakar · Thiès</Text>
                <Text style={styles.headerWeather}>🌙 30°C</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {membresFiltres.length} membres &amp; commerces en direct
              </Text>
            </View>
          </View>

          {onFermer && (
            <TouchableOpacity style={styles.closeBtn} onPress={onFermer}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pilules de filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterPill, filtreActif === "tous" && styles.filterPillActive]}
            onPress={() => setFiltreActif("tous")}
          >
            <Text style={[styles.filterText, filtreActif === "tous" && styles.filterTextActive]}>
              🧭 Tous ({membres.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filtreActif === "boutiques" && styles.filterPillActive]}
            onPress={() => setFiltreActif("boutiques")}
          >
            <Text style={[styles.filterText, filtreActif === "boutiques" && styles.filterTextActive]}>
              🏪 Boutiques certifiées
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filtreActif === "candidats" && styles.filterPillActive]}
            onPress={() => setFiltreActif("candidats")}
          >
            <Text style={[styles.filterText, filtreActif === "candidats" && styles.filterTextActive]}>
              🧑🏾‍💼 Candidats disponibles
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filtreActif === "live" && styles.filterPillActive]}
            onPress={() => setFiltreActif("live")}
          >
            <Text style={[styles.filterText, filtreActif === "live" && styles.filterTextActive]}>
              🟢 En stock (LIVE)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 4. Bouton Flottant GPS "Ma Position" */}
      <TouchableOpacity
        style={styles.gpsButton}
        onPress={localiserUtilisateur}
        disabled={isLocating}
      >
        {isLocating ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.gpsIcon}>📍</Text>
        )}
      </TouchableOpacity>

      {/* 5. BottomSheet volante au clic sur un marqueur */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {selectedMembre && (
          <View style={styles.sheetContent}>
            <View style={styles.dragHandle} />

            {/* En-tête Profil */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetAvatarBox}>
                {selectedMembre.photoUrl ? (
                  <Image source={{ uri: selectedMembre.photoUrl }} style={styles.sheetAvatar} />
                ) : (
                  <Text style={styles.sheetAvatarEmoji}>
                    {selectedMembre.type === "boutique" ? "🏪" : "🧑🏾‍💼"}
                  </Text>
                )}
              </View>

              <View style={styles.sheetInfo}>
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {selectedMembre.nom}
                  </Text>
                  {selectedMembre.estCertifie && (
                    <Text style={styles.badgeCertifie}>✓ Vérifié</Text>
                  )}
                </View>
                <Text style={styles.sheetSubtitle}>
                  {selectedMembre.statutAction || "Actif sur Facilité"}
                </Text>
                <Text style={styles.sheetLocation}>
                  📍 {selectedMembre.quartier ? `${selectedMembre.quartier}, ` : ""}{selectedMembre.ville || "Dakar"} · Sénégal
                </Text>
              </View>

              <TouchableOpacity onPress={fermerBottomSheet} style={styles.sheetCloseBtn}>
                <Text style={styles.sheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bouton WhatsApp Vert Principal */}
            {selectedMembre.telephoneWhatsapp && (
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => ouvrirWhatsApp(selectedMembre.telephoneWhatsapp)}
              >
                <Text style={styles.whatsappBtnText}>
                  💬 Contacter sur WhatsApp ({selectedMembre.telephoneWhatsapp})
                </Text>
              </TouchableOpacity>
            )}

            {/* Liste horizontale des articles ou offres */}
            {selectedMembre.articlesOffres && selectedMembre.articlesOffres.length > 0 && (
              <View style={styles.productsSection}>
                <Text style={styles.productsSectionTitle}>
                  {selectedMembre.type === "boutique" ? "Articles en rayon" : "Compétences & Offres"}
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selectedMembre.articlesOffres.map((art) => (
                    <View key={art.id} style={styles.productCard}>
                      {art.photoUrl ? (
                        <Image source={{ uri: art.photoUrl }} style={styles.productImg} />
                      ) : (
                        <View style={styles.productPlaceholder}>
                          <Text style={styles.productEmoji}>🛍️</Text>
                        </View>
                      )}
                      <Text style={styles.productTitle} numberOfLines={1}>
                        {art.titre}
                      </Text>
                      {art.prixXof != null && (
                        <Text style={styles.productPrice}>{art.prixXof.toLocaleString("fr-FR")} FCFA</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F17",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  // Custom Markers Styles
  customMarkerContainer: {
    alignItems: "center",
  },
  markerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  markerBadgeTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    maxWidth: 100,
  },
  markerBadgeSub: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3.5,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 22,
  },
  liveTag: {
    position: "absolute",
    bottom: -4,
    backgroundColor: "#10B981",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  liveTagText: {
    color: "#052e16",
    fontSize: 8,
    fontWeight: "900",
  },
  markerShadow: {
    width: 28,
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 3,
    marginTop: 3,
  },
  // User Location Marker
  userMarkerContainer: {
    alignItems: "center",
  },
  userMarkerPulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  userMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userMarkerLabel: {
    marginTop: 4,
    backgroundColor: "#2563EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  userMarkerText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  // Header Floating
  headerFloating: {
    position: "absolute",
    top: Platform.OS === "ios" ? 44 : 16,
    left: 12,
    right: 12,
    backgroundColor: "rgba(11, 16, 23, 0.88)",
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarEmoji: {
    fontSize: 18,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  headerWeather: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  filterScroll: {
    marginTop: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
  },
  filterText: {
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#111827",
    fontWeight: "900",
  },
  // GPS Button
  gpsButton: {
    position: "absolute",
    right: 16,
    bottom: 110,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  gpsIcon: {
    fontSize: 22,
  },
  // BottomSheet
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111827",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: SCREEN_HEIGHT * 0.65,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetContent: {
    padding: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4B5563",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sheetAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sheetAvatar: {
    width: 50,
    height: 50,
  },
  sheetAvatarEmoji: {
    fontSize: 24,
  },
  sheetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  badgeCertifie: {
    backgroundColor: "#1D4ED8",
    color: "#BFDBFE",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sheetSubtitle: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  sheetLocation: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 6,
  },
  sheetCloseText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "800",
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  whatsappBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  productsSection: {
    marginTop: 16,
  },
  productsSectionTitle: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  productCard: {
    width: 110,
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 8,
    marginRight: 10,
  },
  productImg: {
    width: 94,
    height: 80,
    borderRadius: 8,
  },
  productPlaceholder: {
    width: 94,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  productEmoji: {
    fontSize: 24,
  },
  productTitle: {
    color: "#F3F4F6",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  productPrice: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
});

export default FaciliteSnapMap;
