import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconGoogle } from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';
import {
  BLOCAGE_ESSAIS_S,
  DELAI_RENVOI_S,
  ESSAIS_MAX,
  LONGUEUR_CODE,
  emailValide,
  envoyerCodeConfirmation,
  lierCompteGoogle,
  verifierCodeConfirmation,
  type ErreurConfirmation,
} from '@/lib/confirmationCompte';
import { marquerEtapeEmailVue } from '@/lib/preferencesConnexion';

// « Confirmer mon compte » : étape imposée avant de postuler pour les personnes inscrites avec leur seul
// numéro de téléphone (sans e-mail). Trois étapes — choix (Google ou e-mail), code reçu à 6 chiffres,
// confirmation — puis retour sur l'offre d'où l'on vient. Maquettes : « Nouveau dossier/confirmer-mon-compte ».
const FOND = '#F2F0EA';
const VERT = '#10B981';
const VERT_FONCE = '#064E3B';
const GRIS = '#374151';
const ROUGE = '#DC2626';

type Etape = 'choix' | 'code' | 'succes';
type Charge = 'envoi' | 'verif' | 'google' | null;
type ErreurCode = 'incorrect' | 'expire' | 'essais' | null;

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? '?') + (mots[1]?.[0] ?? '')).toUpperCase();
}

export default function ConfirmerCompteScreen() {
  const router = useRouter();
  const { refreshProfile, user } = useAuth();
  const { titre, entreprise, retour, onboarding } = useLocalSearchParams<{ titre?: string; entreprise?: string; retour?: string; onboarding?: string }>();
  // Même page que pour « postuler sur Facilité » ; depuis l'inscription (onboarding=1) on peut en plus la passer.
  const dansInscription = onboarding === '1';

  const [etape, setEtape] = useState<Etape>('choix');
  const [email, setEmail] = useState('');
  const [erreurEmail, setErreurEmail] = useState('');
  const [code, setCode] = useState('');
  const [erreurCode, setErreurCode] = useState<ErreurCode>(null);
  const [essais, setEssais] = useState(0);
  const [charge, setCharge] = useState<Charge>(null);
  const [erreurGoogle, setErreurGoogle] = useState(false);
  const [bandeau, setBandeau] = useState<{ message: string; reessayer?: () => void } | null>(null);
  const [restant, setRestant] = useState(0);
  const champCode = useRef<TextInput>(null);

  // Compte à rebours avant de pouvoir redemander un code.
  useEffect(() => {
    if (restant <= 0) return;
    const t = setTimeout(() => setRestant((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [restant]);
  useEffect(() => {
    if (erreurCode === 'essais' && restant === 0) {
      setErreurCode(null);
      setEssais(0);
    }
  }, [erreurCode, restant]);

  // Quitter l'étape d'inscription (passer ou terminer) : elle est notée et ne sera plus reproposée.
  const sortir = async () => {
    if (dansInscription && user?.id) await marquerEtapeEmailVue(user.id);
    router.replace((retour as Href) || '/');
  };

  const revenir = () => {
    if (etape === 'code') {
      setEtape('choix');
      setCode('');
      setErreurCode(null);
      return;
    }
    if (dansInscription) {
      sortir();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace((retour as Href) || '/');
  };

  const traiterErreurReseau = (e: ErreurConfirmation, reessayer: () => void) => {
    if (e.type === 'reseau') {
      setBandeau({ message: 'Pas de connexion internet', reessayer });
      return true;
    }
    return false;
  };

  const envoyerCode = async () => {
    setBandeau(null);
    setErreurEmail('');
    if (!emailValide(email)) {
      setErreurEmail('Adresse e-mail invalide. Exemple : prenom@gmail.com');
      return;
    }
    setCharge('envoi');
    const erreur = await envoyerCodeConfirmation(email);
    setCharge(null);
    if (erreur) {
      if (!traiterErreurReseau(erreur, envoyerCode)) setErreurEmail(erreur.message);
      return;
    }
    setEtape('code');
    setCode('');
    setErreurCode(null);
    setEssais(0);
    setRestant(DELAI_RENVOI_S);
  };

  const renvoyer = async () => {
    if (restant > 0 || charge) return;
    setBandeau(null);
    setCharge('envoi');
    const erreur = await envoyerCodeConfirmation(email);
    setCharge(null);
    if (erreur) {
      if (!traiterErreurReseau(erreur, renvoyer)) setErreurCode(erreur.type === 'expire' ? 'expire' : null);
      return;
    }
    setCode('');
    setErreurCode(null);
    setEssais(0);
    setRestant(DELAI_RENVOI_S);
  };

  const verifier = async () => {
    if (code.length < LONGUEUR_CODE || charge || erreurCode === 'essais') return;
    setBandeau(null);
    setCharge('verif');
    const erreur = await verifierCodeConfirmation(email, code);
    setCharge(null);
    if (!erreur) {
      await refreshProfile();
      setEtape('succes');
      return;
    }
    if (traiterErreurReseau(erreur, verifier)) return;
    if (erreur.type === 'expire') {
      setErreurCode('expire');
      return;
    }
    const total = essais + 1;
    setEssais(total);
    setErreurCode(total >= ESSAIS_MAX ? 'essais' : 'incorrect');
    if (total >= ESSAIS_MAX) {
      setCode('');
      setRestant(BLOCAGE_ESSAIS_S);
    }
  };

  const google = async () => {
    setBandeau(null);
    setErreurGoogle(false);
    setCharge('google');
    try {
      await lierCompteGoogle();
      await refreshProfile();
      setEtape('succes');
    } catch (e) {
      if (e instanceof Error && /network|réseau|reseau|internet|connexion/i.test(e.message)) setBandeau({ message: 'Pas de connexion internet', reessayer: google });
      else setErreurGoogle(true);
    } finally {
      setCharge(null);
    }
  };

  const terminer = () => sortir();

  const saisieBloquee = erreurCode === 'essais';
  const casesRouges = erreurCode === 'incorrect' || erreurCode === 'expire';

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {bandeau ? (
            <View
              className="flex-row items-center gap-3 mx-4 mt-2 rounded-2xl px-4 py-3"
              style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}>
              <Ionicons name={bandeau.message.startsWith('Pas de connexion') ? 'cellular' : 'alert-circle'} size={18} color="#B91C1C" />
              <Text className="flex-1 text-[13.5px] font-bold" style={{ color: '#B91C1C' }}>{bandeau.message}</Text>
              {bandeau.reessayer ? (
                <Pressable onPress={bandeau.reessayer} className="rounded-xl px-4 py-2" style={{ backgroundColor: '#B91C1C' }}>
                  <Text className="text-white text-[13px] font-black">Réessayer</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {etape === 'succes' ? (
            <View className="flex-1 px-6">
              <View className="flex-1 items-center justify-center">
                <View className="items-center justify-center rounded-full" style={{ width: 120, height: 120, backgroundColor: '#CFE8DB' }}>
                  <View className="items-center justify-center rounded-full" style={{ width: 84, height: 84, backgroundColor: VERT }}>
                    <Ionicons name="checkmark" size={46} color="#fff" />
                  </View>
                </View>
                <Text className="text-[26px] font-black text-center mt-8" style={{ color: VERT_FONCE }}>Compte Google confirmé</Text>
                <Text className="text-[15.5px] text-center mt-3" style={{ color: GRIS }}>Vous pouvez maintenant postuler sur Facilité.</Text>
              </View>
              <Pressable onPress={terminer} accessibilityRole="button" className="items-center justify-center rounded-[18px] mb-4" style={{ height: 58, backgroundColor: VERT }}>
                <Text className="text-white text-[17px] font-black">OK</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}>
              <Pressable
                onPress={revenir}
                accessibilityLabel="Retour"
                className="items-center justify-center rounded-full bg-white mt-3"
                style={{ width: 46, height: 46, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
                <Ionicons name="chevron-back" size={22} color="#111" />
              </Pressable>

              {etape === 'choix' ? (
                <>
                  {titre ? (
                    <View className="flex-row items-center gap-4 bg-white rounded-[22px] p-4 mt-5">
                      <View className="items-center justify-center rounded-2xl" style={{ width: 48, height: 48, backgroundColor: '#FEF3C7' }}>
                        <Text className="text-[16px] font-black" style={{ color: '#B45309' }}>{initiales(entreprise || titre)}</Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[12px]" style={{ color: '#6B7280' }}>Vous postulez à…</Text>
                        <Text className="text-[16px] font-black text-[#111]" numberOfLines={2}>{titre}</Text>
                        {entreprise ? <Text className="text-[13.5px] font-bold" style={{ color: '#2563EB' }} numberOfLines={1}>{entreprise}</Text> : null}
                      </View>
                    </View>
                  ) : null}

                  <Text className="text-[30px] leading-[36px] font-black mt-6" style={{ color: VERT_FONCE }}>Confirmez votre compte pour postuler</Text>
                  <Text className="text-[15px] leading-[23px] mt-3" style={{ color: GRIS }}>
                    Pour que les recruteurs puissent vous répondre, nous avons besoin d’un compte Google confirmé. Cela prend moins d’une minute.
                  </Text>

                  {erreurGoogle ? (
                    <View className="flex-row items-center gap-3 rounded-[18px] mt-6 p-4" style={{ backgroundColor: '#FEF2F2', borderWidth: 2, borderColor: '#FECACA' }}>
                      <View className="items-center justify-center rounded-full" style={{ width: 26, height: 26, backgroundColor: ROUGE }}>
                        <Text className="text-white text-[15px] font-black">!</Text>
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-[15px] font-black" style={{ color: '#991B1B' }}>La connexion Google n’a pas abouti.</Text>
                        <Text className="text-[14px]" style={{ color: '#991B1B' }}>Vérifiez votre compte et réessayez.</Text>
                      </View>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={google}
                    disabled={charge !== null}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-3 rounded-[18px] mt-6"
                    style={{ height: 56, backgroundColor: VERT, opacity: charge && charge !== 'google' ? 0.6 : 1 }}>
                    {charge === 'google' ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <View className="items-center justify-center rounded-full bg-white" style={{ width: 30, height: 30 }}>
                          <IconGoogle size={18} />
                        </View>
                        <Text className="text-white text-[16px] font-black">Continuer avec Google</Text>
                      </>
                    )}
                  </Pressable>

                  <View className="flex-row items-center gap-3 mt-5">
                    <View className="flex-1" style={{ height: 1, backgroundColor: '#D4D1C9' }} />
                    <Text className="text-[13px]" style={{ color: '#6B7280' }}>ou</Text>
                    <View className="flex-1" style={{ height: 1, backgroundColor: '#D4D1C9' }} />
                  </View>

                  <Text className="text-[14.5px] font-black text-[#111] mt-5">Votre adresse e-mail</Text>
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (erreurEmail) setErreurEmail('');
                    }}
                    placeholder="prenom@gmail.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    onSubmitEditing={envoyerCode}
                    className="bg-white rounded-[18px] px-5 mt-2 text-[16px] text-[#111]"
                    style={{ height: 56, borderWidth: erreurEmail ? 1.5 : 1, borderColor: erreurEmail ? ROUGE : '#D9D6CE' }}
                  />
                  {erreurEmail ? <Text className="text-[13px] font-bold mt-2" style={{ color: ROUGE }}>{erreurEmail}</Text> : null}

                  <Pressable
                    onPress={envoyerCode}
                    disabled={charge !== null}
                    accessibilityRole="button"
                    className="items-center justify-center rounded-[18px] bg-white mt-4"
                    style={{ height: 56, borderWidth: 1.5, borderColor: VERT, opacity: charge === 'google' ? 0.6 : 1 }}>
                    {charge === 'envoi' ? (
                      <View className="flex-row items-center gap-2">
                        <ActivityIndicator color={VERT} />
                        <Text className="text-[16px] font-black" style={{ color: '#047857' }}>Envoi du code…</Text>
                      </View>
                    ) : (
                      <Text className="text-[16px] font-black" style={{ color: '#047857' }}>Continuer</Text>
                    )}
                  </Pressable>

                  {dansInscription ? (
                    <Pressable onPress={sortir} hitSlop={8} className="mt-5 self-center">
                      <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Passer cette étape</Text>
                    </Pressable>
                  ) : null}

                  <View className="flex-row items-center gap-2 mt-auto pt-8">
                    <Ionicons name="lock-closed" size={14} color="#D97706" />
                    <Text className="flex-1 text-[13px]" style={{ color: '#6B7280' }}>Votre adresse sert uniquement à vous contacter pour vos candidatures.</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-[30px] leading-[36px] font-black mt-8" style={{ color: VERT_FONCE }}>Entrez le code reçu</Text>
                  <Text className="text-[15.5px] leading-[24px] mt-3" style={{ color: GRIS }}>
                    Nous avons envoyé un code à 6 chiffres à <Text className="font-black">{email.trim()}</Text>.{' '}
                    <Text
                      onPress={() => {
                        setEtape('choix');
                        setCode('');
                        setErreurCode(null);
                      }}
                      className="font-black"
                      style={{ color: '#059669', textDecorationLine: 'underline' }}>
                      Modifier l’adresse
                    </Text>
                  </Text>

                  <Pressable onPress={() => champCode.current?.focus()} accessibilityLabel="Saisir le code" className="mt-6">
                    <View className="flex-row justify-between">
                      {Array.from({ length: LONGUEUR_CODE }).map((_, i) => (
                        <View
                          key={i}
                          className="items-center justify-center bg-white"
                          style={{
                            width: 48,
                            height: 58,
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: casesRouges ? '#DC2626' : saisieBloquee ? '#DDDAD2' : code.length === i ? VERT : code[i] ? VERT_FONCE : '#D9D6CE',
                            backgroundColor: casesRouges ? '#FEF2F2' : saisieBloquee ? '#EBE9E4' : '#fff',
                          }}>
                          <Text className="text-[26px] font-black" style={{ color: casesRouges ? '#B91C1C' : VERT_FONCE }}>{code[i] ?? ''}</Text>
                        </View>
                      ))}
                    </View>
                    <TextInput
                      ref={champCode}
                      value={code}
                      onChangeText={(t) => {
                        if (saisieBloquee) return;
                        setCode(t.replace(/\D/g, '').slice(0, LONGUEUR_CODE));
                        if (erreurCode) setErreurCode(null);
                      }}
                      keyboardType="number-pad"
                      maxLength={LONGUEUR_CODE}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      autoFocus
                      caretHidden
                      editable={!saisieBloquee}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02 }}
                    />
                  </Pressable>

                  {erreurCode === 'incorrect' ? <Text className="text-[14px] font-black mt-3" style={{ color: ROUGE }}>Code incorrect, réessayez.</Text> : null}
                  {erreurCode === 'expire' ? <Text className="text-[14px] font-black mt-3" style={{ color: ROUGE }}>Ce code a expiré, demandez-en un nouveau.</Text> : null}
                  {erreurCode === 'essais' ? (
                    <Text className="text-[14px] font-black mt-3" style={{ color: ROUGE }}>Trop d’essais. Réessayez dans 10 minutes.</Text>
                  ) : null}

                  <Pressable
                    onPress={verifier}
                    disabled={code.length < LONGUEUR_CODE || charge !== null || saisieBloquee || erreurCode === 'expire'}
                    accessibilityRole="button"
                    className="items-center justify-center rounded-[18px] mt-5"
                    style={{ height: 56, backgroundColor: code.length < LONGUEUR_CODE || saisieBloquee || erreurCode === 'expire' || erreurCode === 'incorrect' ? '#A7E9CF' : VERT }}>
                    {charge === 'verif' ? (
                      <View className="flex-row items-center gap-2">
                        <ActivityIndicator color="#fff" />
                        <Text className="text-white text-[17px] font-black">Vérification…</Text>
                      </View>
                    ) : (
                      <Text className="text-white text-[17px] font-black">Vérifier</Text>
                    )}
                  </Pressable>

                  <Pressable onPress={renvoyer} disabled={restant > 0 || charge !== null} className="items-center mt-5 py-2">
                    {charge === 'envoi' ? (
                      <ActivityIndicator color={VERT} />
                    ) : (
                      <Text className="text-[15px] font-black" style={{ color: restant > 0 ? '#8A8780' : '#059669' }}>
                        {restant > 0 ? `Renvoyer le code dans ${restant >= 60 ? `${Math.floor(restant / 60)} min ${restant % 60} s` : `${restant} s`}` : 'Renvoyer le code'}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
