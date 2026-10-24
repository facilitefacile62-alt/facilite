import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FaciliteHeader from '@/components/FaciliteHeader';
import IndisponibleNeutre from '@/components/IndisponibleNeutre';
import { BarrePaiement, CarteQr } from '@/components/PaiementQr';
import { chargerModelesCv, creerPaiementCv, lienTelechargementCv, statutAchatCv, urlApercuPage, useEnteteImages, type PaiementCv } from '@/lib/achatCv';
import { messageAchatCv, prixFcfa, type ModeleCv, type TypeMessageCv } from '@/lib/achatCvLogique';
import { achatsNumeriquesAutorises } from '@/lib/biensNumeriques';
import { secondesRestantes } from '@/lib/facturationLogique';

// Paiement d'un modèle de CV (maquette du 24/10/2026, « Paiement » et « QR ») : même aspect et mêmes éléments que la page de facturation de Locaux.
// Carte « Modèle NOM · PRIX FCFA », un seul bouton « Générer mon QR de paiement Orange Money », puis QR + barre fixe en bas (compte à rebours de
// 5 minutes, Ouvrir Orange Money, Ouvrir MAXIT). Le modèle n'est acheté QUE par le serveur, après la confirmation d'Orange : cet écran lit l'état.
// Sur iOS (règle Apple 3.1.1), l'écran est remplacé par un message neutre.
const FOND = '#F2F0EA';
const BORDURE = '#D9D1C1';
const ORANGE_OM = '#FF6B00';
const INTERVALLE_STATUT_MS = 4000;

export default function AchatCvPayer() {
  return achatsNumeriquesAutorises ? <PayerContenu /> : <IndisponibleNeutre retour={'/profil' as Href} />;
}

function PayerContenu() {
  const router = useRouter();
  const { id, depuis } = useLocalSearchParams<{ id?: string; depuis?: string }>();
  const entete = useEnteteImages();
  const [modele, setModele] = useState<ModeleCv | null | undefined>(undefined); // undefined = chargement
  const [paiement, setPaiement] = useState<PaiementCv | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [reste, setReste] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: TypeMessageCv; nom?: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [suivi, setSuivi] = useState<string | null>(null); // achat suivi (QR affiché, ou paiement déjà en cours trouvé au serveur)
  const finRef = useRef(0);

  // Retour : Paiement → Aperçu (si ouvert depuis l'aperçu et pas encore acheté), sinon Catalogue ; « Achat confirmé » → Catalogue.
  const acheteMaintenant = modele?.achete === true;
  const revenir = useCallback(() => {
    if (depuis === 'apercu' && !acheteMaintenant && router.canGoBack()) router.back();
    else router.replace('/profil?onglet=achat-cv' as Href);
  }, [depuis, acheteMaintenant, router]);

  const recharger = useCallback(async () => {
    try {
      const liste = await chargerModelesCv();
      setModele(liste.find((m) => m.id === id) ?? null);
    } catch {
      setModele((actuel) => (actuel === undefined ? null : actuel));
    }
  }, [id]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  // Compte à rebours de 5 minutes ; à zéro, le QR disparaît.
  useEffect(() => {
    if (!paiement) return undefined;
    const minuteur = setInterval(() => {
      const restant = secondesRestantes(finRef.current, Date.now());
      setReste(restant);
      if (restant <= 0) {
        setPaiement(null);
        setMessage({ type: 'expire' });
      }
    }, 1000);
    return () => clearInterval(minuteur);
  }, [paiement]);

  // État de l'achat : toutes les 4 secondes, et IMMÉDIATEMENT au retour dans l'application (après MAXIT ou Orange Money).
  const nomModele = modele?.nom;
  const interroger = useCallback(async () => {
    if (!suivi) return;
    const etat = await statutAchatCv(suivi);
    if (etat === 'success') {
      setPaiement(null);
      setSuivi(null);
      setMessage({ type: 'recu', nom: nomModele });
      recharger();
    } else if (etat === 'failed') {
      setPaiement(null);
      setSuivi(null);
      setMessage({ type: 'annule' });
    }
  }, [suivi, nomModele, recharger]);

  useEffect(() => {
    if (!suivi) return undefined;
    const minuteur = setInterval(interroger, INTERVALLE_STATUT_MS);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') interroger();
    });
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, [suivi, interroger]);

  async function genererQr() {
    if (!modele || enCreation || paiement || modele.achete) return;
    setEnCreation(true);
    setMessage(null);
    setErreur('');
    const resultat = await creerPaiementCv(modele.id);
    setEnCreation(false);
    if (!resultat.ok) {
      if (resultat.dejaAchete) {
        recharger();
        return;
      }
      if (resultat.paiementEnCours) {
        // Un QR encore valable existe (application rouverte, autre appareil) : on le suit, sans en ouvrir un second.
        setMessage({ type: 'deja_prepare' });
        if (resultat.achatId) setSuivi(resultat.achatId);
        return;
      }
      setErreur(resultat.message);
      return;
    }
    finRef.current = Date.now() + resultat.paiement.validForSeconds * 1000;
    setReste(resultat.paiement.validForSeconds);
    setPaiement(resultat.paiement);
    setSuivi(resultat.paiement.achatId);
  }

  async function utiliser() {
    if (!modele) return;
    const lien = await lienTelechargementCv(modele.id);
    if (!lien) {
      Alert.alert('Modèle indisponible', "Ce modèle n'a pas pu être ouvert. Réessayez dans un instant.");
      return;
    }
    Linking.openURL(lien).catch(() => Alert.alert('Téléchargement impossible', "Aucune application n'a pu ouvrir ce fichier."));
  }

  const info = message ? messageAchatCv(message.type, message.nom) : null;
  const miniature = modele && entete && modele.nbPages > 0 ? urlApercuPage(modele.id, 1) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <FaciliteHeader />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={revenir}
            accessibilityLabel="Retour"
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDURE }}>
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </Pressable>

          {modele === undefined ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#047857" />
          ) : modele === null ? (
            <View className="mt-3 items-center" style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: BORDURE, padding: 20 }}>
              <Text className="text-[14px] text-black/55 text-center">Ce modèle n&apos;est pas disponible pour le moment.</Text>
            </View>
          ) : (
            <View className="mt-3" style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: BORDURE, padding: 14 }}>
              <View className="flex-row items-center gap-3">
                <View className="rounded-xl overflow-hidden" style={{ width: 72, aspectRatio: 3 / 4, backgroundColor: '#E8E4DA' }}>
                  {miniature ? <Image source={{ uri: miniature, headers: entete ?? undefined }} alt={`Aperçu du modèle ${modele.nom}`} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="none" blurRadius={1} /> : null}
                  {modele.achete ? (
                    <View className="absolute top-1 left-1 rounded-full px-1.5 py-0.5" style={{ backgroundColor: '#10B981' }}>
                      <Text className="text-white text-[9px] font-black">Acheté</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={2}>Modèle {modele.nom}</Text>
                  {modele.achete ? null : <Text className="text-[16px] font-black mt-1 text-[#1A1A1A]">{prixFcfa(modele.prixXof)}</Text>}
                </View>
              </View>

              {info ? (
                <View className="mt-3" style={{ backgroundColor: info.fond, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text className="text-[14px] font-bold" style={{ color: info.texteCouleur }}>{info.texte}</Text>
                </View>
              ) : null}
              {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#B91C1C' }}>{erreur}</Text> : null}

              {modele.achete ? (
                <Pressable
                  onPress={utiliser}
                  accessibilityRole="button"
                  className="items-center justify-center mt-3"
                  style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#10B981' }}>
                  <Text className="text-[15px] font-extrabold text-white">Utiliser ce modèle</Text>
                </Pressable>
              ) : paiement ? (
                <CarteQr qrCodeBase64={paiement.qrCodeBase64} legende={`Modèle ${modele.nom} · ${prixFcfa(paiement.montantXof)}`} />
              ) : (
                <>
                  <Pressable
                    onPress={genererQr}
                    disabled={enCreation}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-2 mt-3"
                    style={{ minHeight: 56, borderRadius: 14, backgroundColor: ORANGE_OM, paddingHorizontal: 12, opacity: enCreation ? 0.7 : 1 }}>
                    {enCreation ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />}
                    <Text className="text-[15px] font-extrabold text-white text-center shrink">Générer mon QR de paiement Orange Money</Text>
                  </Pressable>
                  <Text className="text-[12.5px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    Touchez le bouton : votre QR de paiement Orange Money s&apos;affiche.
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Barre fixe en bas, seulement pendant le QR. */}
        {paiement ? <BarrePaiement validForSeconds={paiement.validForSeconds} reste={reste} deepLinkOm={paiement.deepLinkOm} deepLinkMaxit={paiement.deepLinkMaxit} /> : null}
      </SafeAreaView>
    </View>
  );
}
