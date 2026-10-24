import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MarketplaceHeader from '@/components/MarketplaceHeader';
import { useAuth } from '@/context/AuthContext';
import {
  activerPremium,
  chargerPremiumJusqua,
  chargerSolde,
  chargerTaux,
  creerPaiementJetons,
  statutPaiementJetons,
  type PaiementJetons,
  type Taux,
} from '@/lib/facturation';
import {
  activationPossible,
  compteARebours,
  dateFr,
  formaterMontant,
  jetonsManquants,
  lienOuvrable,
  messageFacturation,
  quantiteSuivante,
  secondesRestantes,
  texteValidite,
  type TypeMessage,
} from '@/lib/facturationLogique';
import { chargerMesBoutiques } from '@/lib/vendeur';

// Page de facturation de Locaux (maquette du 24/10/2026, « Page de facturation ») : jetons et mise en avant (Premium) de la boutique.
// La page NE DÉFILE PAS : tout tient entre l'en-tête de Locaux et sa barre du bas. Pas de couronne, de titre ni d'encadré « non actif » en haut ; pas
// de bouton « + » flottant. Pendant le QR, une barre fixe en bas porte le compte à rebours, « Ouvrir Orange Money », « Ouvrir MAXIT » et l'attente.
// Les jetons sont crédités UNIQUEMENT par le serveur : l'application crée la demande de paiement et lit l'état de la commande.
const FOND = '#F2F0EA';
const BORDURE = '#D9D1C1';
const ORANGE_OM = '#FF6B00';
const INTERVALLE_STATUT_MS = 4000;

export default function FacturationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;

  const [chargement, setChargement] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [taux, setTaux] = useState<Taux | null>(null);
  const [solde, setSolde] = useState(0);
  const [premiumJusqua, setPremiumJusqua] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  const [quantite, setQuantite] = useState(10);
  const [paiement, setPaiement] = useState<PaiementJetons | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [enActivation, setEnActivation] = useState(false);
  const [reste, setReste] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: TypeMessage; jetons?: number } | null>(null);
  const finRef = useRef(0);

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const boutiques = await chargerMesBoutiques(userId);
      const id = boutiques[0]?.id ?? null;
      setStoreId(id);
      if (!id) {
        setErreur("Créez d'abord votre boutique pour acheter des jetons.");
        return;
      }
      const [t, s, p] = await Promise.all([chargerTaux(), chargerSolde(id), chargerPremiumJusqua(id)]);
      setTaux(t);
      setSolde(s);
      setPremiumJusqua(p);
      setErreur('');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible de charger vos jetons pour le moment.');
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      recharger();
    }, [recharger])
  );

  // Compte à rebours de 5 minutes ; à zéro, le QR disparaît (message « Le QR code a expiré… »).
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

  // État de la commande : toutes les 4 secondes, et IMMÉDIATEMENT au retour dans l'application (après MAXIT ou Orange Money).
  const transactionId = paiement?.transactionId;
  const jetonsAchetes = paiement?.quantiteJetons;
  const interroger = useCallback(async () => {
    if (!transactionId) return;
    const etat = await statutPaiementJetons(transactionId);
    if (etat === 'success') {
      setPaiement(null);
      setMessage({ type: 'recu', jetons: jetonsAchetes });
      recharger();
    } else if (etat === 'failed') {
      setPaiement(null);
      setMessage({ type: 'annule' });
    }
  }, [transactionId, jetonsAchetes, recharger]);

  useEffect(() => {
    if (!transactionId) return undefined;
    const minuteur = setInterval(interroger, INTERVALLE_STATUT_MS);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') interroger();
    });
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, [transactionId, interroger]);

  async function genererQr() {
    if (!storeId || enCreation || paiement) return;
    setEnCreation(true);
    setMessage(null);
    const resultat = await creerPaiementJetons(storeId, quantite);
    setEnCreation(false);
    if (!resultat.ok) {
      if (resultat.statut === 429) setMessage({ type: 'deja_prepare' });
      else setErreur(resultat.message);
      return;
    }
    setErreur('');
    finRef.current = Date.now() + resultat.paiement.validForSeconds * 1000;
    setReste(resultat.paiement.validForSeconds);
    setPaiement(resultat.paiement);
  }

  async function activer() {
    if (!storeId || enActivation || !taux || !activationPossible(solde, taux.jetons_requis_premium_an, Boolean(premiumJusqua))) return;
    setEnActivation(true);
    try {
      await activerPremium(storeId);
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'activation n'a pas pu être faite.");
    } finally {
      setEnActivation(false);
    }
  }

  function ouvrir(lien: string | null) {
    if (lienOuvrable(lien)) Linking.openURL(lien).catch(() => setErreur("Impossible d'ouvrir l'application. Scannez le QR code."));
  }

  const requis = taux?.jetons_requis_premium_an ?? 50;
  const premiumActif = Boolean(premiumJusqua);
  const peutActiver = activationPossible(solde, requis, premiumActif);
  const prix = (taux?.cout_jeton_fcfa ?? 0) * quantite;
  const info = message ? messageFacturation(message.type, message.jetons) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <View style={{ backgroundColor: '#e3dbcc', paddingTop: insets.top }}>
        <MarketplaceHeader />
      </View>

      {/* La page ne défile pas : tout reste fixe entre l'en-tête et la barre du bas. */}
      <View className="flex-1 px-4 pt-3">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/marketplace/vendre/ma-boutique' as Href))}
          accessibilityLabel="Retour"
          className="items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDURE }}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>

        {chargement ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#047857" />
        ) : (
          <View className="mt-3" style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: BORDURE, padding: 14 }}>
            {premiumActif ? (
              <View style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <Text className="text-[14px] font-extrabold" style={{ color: '#047857' }}>Premium Locaux actif</Text>
                <Text className="text-[12.5px] mt-1" style={{ color: 'rgba(0,0,0,0.65)' }}>
                  Votre boutique est mise en avant jusqu&apos;au {dateFr(premiumJusqua)}.
                </Text>
              </View>
            ) : null}

            <View className="flex-row items-center justify-between px-1">
              <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Solde de jetons</Text>
              <Text className="text-[26px] font-black text-[#1A1A1A]">{solde}</Text>
            </View>

            {!premiumActif ? (
              <>
                <Pressable
                  onPress={activer}
                  disabled={!peutActiver || enActivation}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !peutActiver }}
                  className="flex-row items-center justify-center gap-2 mt-3"
                  style={{ minHeight: 48, borderRadius: 14, backgroundColor: peutActiver ? '#F59E0B' : '#FCD58F' }}>
                  {enActivation ? <ActivityIndicator color="#fff" size="small" /> : <MaterialCommunityIcons name="crown" size={18} color="#FFFFFF" />}
                  <Text className="text-[14.5px] font-extrabold text-white">Activer Premium pour {requis} jetons</Text>
                </Pressable>
                {!peutActiver ? (
                  <Text className="text-[12px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.45)' }}>
                    Il vous manque {jetonsManquants(solde, requis)} jetons.
                  </Text>
                ) : null}
              </>
            ) : null}

            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 12 }} />
            <Text className="text-[15px] font-extrabold text-[#1A1A1A]">Acheter des jetons</Text>

            {info ? (
              <View className="mt-2.5" style={{ backgroundColor: info.fond, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text className="text-[13px] font-bold" style={{ color: info.texteCouleur }}>{info.texte}</Text>
              </View>
            ) : null}
            {erreur ? <Text className="text-[12.5px] font-bold mt-2.5" style={{ color: '#B91C1C' }}>{erreur}</Text> : null}

            {!paiement ? (
              <>
                <View className="flex-row items-center gap-3 mt-3">
                  <View className="flex-row items-center" style={{ borderWidth: 1, borderColor: BORDURE, borderRadius: 14 }}>
                    <Pressable
                      onPress={() => setQuantite((q) => quantiteSuivante(q, -1))}
                      accessibilityLabel="Moins de jetons"
                      className="items-center justify-center"
                      style={{ width: 44, height: 48 }}>
                      <Ionicons name="remove" size={20} color="#1A1A1A" />
                    </Pressable>
                    <Text className="text-[16px] font-black text-[#1A1A1A] text-center" style={{ minWidth: 40 }}>{quantite}</Text>
                    <Pressable
                      onPress={() => setQuantite((q) => quantiteSuivante(q, 1))}
                      accessibilityLabel="Plus de jetons"
                      className="items-center justify-center"
                      style={{ width: 44, height: 48 }}>
                      <Ionicons name="add" size={20} color="#1A1A1A" />
                    </Pressable>
                  </View>
                  <Text className="flex-1 text-[13px]" style={{ color: 'rgba(0,0,0,0.55)' }}>
                    jetons · <Text className="font-black" style={{ color: '#1A1A1A' }}>{formaterMontant(prix)} FCFA</Text>
                  </Text>
                </View>

                <Pressable
                  onPress={genererQr}
                  disabled={enCreation || !storeId}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-2 mt-3"
                  style={{ minHeight: 52, borderRadius: 14, backgroundColor: ORANGE_OM, paddingHorizontal: 12, opacity: enCreation ? 0.7 : 1 }}>
                  {enCreation ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />}
                  <Text className="text-[14.5px] font-extrabold text-white text-center shrink">Générer mon QR de paiement Orange Money</Text>
                </Pressable>
                <Text className="text-[12px] text-center mt-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  Touchez le bouton : votre QR de paiement Orange Money s&apos;affiche.
                </Text>
              </>
            ) : (
              <View className="items-center mt-3">
                {paiement.qrCodeBase64 ? (
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: BORDURE, padding: 10 }}>
                    <Image source={{ uri: `data:image/png;base64,${paiement.qrCodeBase64}` }} alt="QR code de paiement Orange Money" style={{ width: 160, height: 160 }} contentFit="contain" />
                  </View>
                ) : null}
                <Text className="text-[13px] mt-2.5" style={{ color: 'rgba(0,0,0,0.6)' }}>
                  {paiement.quantiteJetons} jetons · {formaterMontant(paiement.montantXof)} FCFA
                </Text>
                <Text className="text-[12.5px] text-center mt-1.5" style={{ color: 'rgba(0,0,0,0.55)' }}>
                  Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Barre fixe en bas (au-dessus de la barre de navigation), seulement pendant le QR. */}
      {paiement ? (
        <View style={{ backgroundColor: '#e3dbcc', borderTopWidth: 1, borderTopColor: BORDURE, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
          <Text className="text-[12.5px] font-bold text-center text-[#1A1A1A]">
            Paiement {texteValidite(paiement.validForSeconds)} · il reste {compteARebours(reste ?? 0)}
          </Text>
          <View className="flex-row gap-2.5 mt-2">
            <Pressable
              onPress={() => ouvrir(paiement.deepLinkOm)}
              disabled={!lienOuvrable(paiement.deepLinkOm)}
              accessibilityRole="button"
              className="flex-1 items-center justify-center"
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: ORANGE_OM, opacity: lienOuvrable(paiement.deepLinkOm) ? 1 : 0.45 }}>
              <Text className="text-[14px] font-extrabold text-white">Ouvrir Orange Money</Text>
            </Pressable>
            <Pressable
              onPress={() => ouvrir(paiement.deepLinkMaxit)}
              disabled={!lienOuvrable(paiement.deepLinkMaxit)}
              accessibilityRole="button"
              className="flex-1 items-center justify-center"
              style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#111827', opacity: lienOuvrable(paiement.deepLinkMaxit) ? 1 : 0.45 }}>
              <Text className="text-[14px] font-extrabold text-white">Ouvrir MAXIT</Text>
            </Pressable>
          </View>
          <View className="flex-row items-center justify-center gap-2 mt-2">
            <ActivityIndicator size="small" color="rgba(0,0,0,0.4)" />
            <Text className="text-[11.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>En attente de confirmation du paiement…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
