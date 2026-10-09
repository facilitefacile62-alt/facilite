import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import {
  DELAI_RENVOI_S,
  INDICATIF,
  LONGUEUR_CODE,
  chiffresDuNumero,
  envoyerCodeSms,
  formaterNumero,
  numeroValide,
  verifierCodeSms,
} from '@/lib/connexionSms';
import { SITE_URL } from '@/lib/webEcrans';

// Connexion — maquettes 43 « Connexion » et 44 « Connexion — Code SMS » :
// le téléphone est le moyen principal (« inspirée de Yimmo », charte §5),
// l'e-mail et Google passent par « Continuer avec l'e-mail ou Google › »
// (écran 45, connexion-email.tsx). Mode CONNEXION uniquement : un numéro
// sans compte est refusé, jamais créé (voir lib/connexionSms.ts).
//
// Une fois le code validé la session est posée ; le garde d'authentification
// du layout racine redirige tout seul vers l'accueil.
const VERT_FOND = '#0d3b34';
const VERT_FONCE = '#0B3D2A';
const BLEU = '#2563EB';
const CREME = '#FAF6F1';

type Etape = 'numero' | 'code';

export default function LoginScreen() {
  const [etape, setEtape] = useState<Etape>('numero');
  const [chiffres, setChiffres] = useState('');
  const [code, setCode] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(0);
  const champCode = useRef<TextInput>(null);

  // Compte à rebours avant de pouvoir redemander un SMS.
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  async function recevoirLeCode() {
    if (!numeroValide(chiffres) || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await envoyerCodeSms(chiffres);
    setChargement(false);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setCode('');
    setAttente(DELAI_RENVOI_S);
    setEtape('code');
    setTimeout(() => champCode.current?.focus(), 150);
  }

  async function valider() {
    if (code.length !== LONGUEUR_CODE || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await verifierCodeSms(chiffres, code);
    setChargement(false);
    if (probleme) setErreur(probleme);
    // Succès : rien à faire ici, la session déclenche la redirection.
  }

  async function renvoyer() {
    if (attente > 0 || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await envoyerCodeSms(chiffres);
    setChargement(false);
    if (probleme) setErreur(probleme);
    else {
      setCode('');
      setAttente(DELAI_RENVOI_S);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: VERT_FOND }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          {/* Bandeau vert : clé dans son halo */}
          <View className="items-center justify-center" style={{ height: 230 }}>
            <View
              className="items-center justify-center"
              style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: '#0c5a3e' }}>
              <View
                className="items-center justify-center"
                style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#C4F3DD' }}>
                <Text style={{ fontSize: 44 }}>🗝️</Text>
              </View>
            </View>
          </View>

          {/* Feuille crème */}
          <View className="flex-1 rounded-t-[28px] overflow-hidden" style={{ backgroundColor: CREME }}>
            <ScrollView
              contentContainerClassName="px-6 pt-6 pb-6 grow"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {etape === 'numero' ? (
                <View className="gap-3.5 grow">
                  <Text className="text-[12px] font-extrabold tracking-wider" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    TON NUMÉRO
                  </Text>

                  {/* Styles explicites : les classes arbitraires de ce bloc
                      n'étaient pas toutes prises en compte (coins carrés,
                      séparateur absent) — constaté à la capture. */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      height: 58,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: VERT_FONCE,
                      backgroundColor: '#FFFFFF',
                    }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A1A1A' }}>{INDICATIF}</Text>
                    <View style={{ width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.15)', marginHorizontal: 12 }} />
                    <TextInput
                      value={formaterNumero(chiffres)}
                      onChangeText={(t) => {
                        setChiffres(chiffresDuNumero(t));
                        if (erreur) setErreur('');
                      }}
                      placeholder="77 000 00 00"
                      placeholderTextColor="rgba(0,0,0,0.3)"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      accessibilityLabel="Numéro de téléphone"
                      style={{ flex: 1, fontSize: 16, color: '#1A1A1A' }}
                    />
                  </View>

                  <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    On t&apos;envoie un code par SMS pour te connecter.
                  </Text>

                  {erreur ? <BoiteErreur texte={erreur} /> : null}

                  <BoutonAction
                    titre="Recevoir le code"
                    sousTitre="Code de connexion par SMS"
                    icone="chatbubble-outline"
                    onPress={recevoirLeCode}
                    desactive={!numeroValide(chiffres)}
                    chargement={chargement}
                  />

                  <Link href="/connexion-email" className="self-center text-[14px] font-extrabold mt-1" style={{ color: VERT_FOND }}>
                    Continuer avec l&apos;e-mail ou Google ›
                  </Link>
                </View>
              ) : (
                <View className="gap-3.5 grow">
                  <Pressable
                    onPress={() => {
                      setEtape('numero');
                      setCode('');
                      setErreur('');
                    }}
                    hitSlop={8}
                    accessibilityRole="button">
                    <Text className="text-[13.5px] font-extrabold" style={{ color: VERT_FOND }}>
                      ‹ Modifier le numéro
                    </Text>
                  </Pressable>

                  <View>
                    <Text className="text-[22px] font-black text-[#1A1A1A]">Entre ton code</Text>
                    <Text className="text-[13px] mt-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      Le code à {LONGUEUR_CODE} chiffres vient de partir au {INDICATIF} {formaterNumero(chiffres)}.
                    </Text>
                  </View>

                  {/* Six cases, une seule saisie : le champ réel est invisible et
                      couvre les cases, ce qui permet la saisie automatique du
                      code reçu par SMS (oneTimeCode / sms-otp). */}
                  <Pressable onPress={() => champCode.current?.focus()} accessibilityLabel="Saisir le code reçu par SMS">
                    <View className="flex-row justify-between">
                      {Array.from({ length: LONGUEUR_CODE }).map((_, i) => {
                        const rempli = i < code.length;
                        const actif = i === Math.min(code.length, LONGUEUR_CODE - 1);
                        return (
                          <View
                            key={i}
                            className="items-center justify-center rounded-[12px] bg-white"
                            style={{
                              width: 48,
                              height: 54,
                              borderWidth: 1.5,
                              borderColor: actif ? BLEU : rempli ? VERT_FONCE : 'rgba(0,0,0,0.12)',
                            }}>
                            <Text className="text-[22px] font-black text-[#1A1A1A]">{code[i] ?? ''}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <TextInput
                      ref={champCode}
                      value={code}
                      onChangeText={(t) => {
                        setCode(t.replace(/\D/g, '').slice(0, LONGUEUR_CODE));
                        if (erreur) setErreur('');
                      }}
                      keyboardType="number-pad"
                      maxLength={LONGUEUR_CODE}
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      caretHidden
                      style={{ position: 'absolute', inset: 0, opacity: 0.02 }}
                    />
                  </Pressable>

                  {erreur ? <BoiteErreur texte={erreur} /> : null}

                  <BoutonAction
                    titre="Valider"
                    sousTitre="Code reçu par SMS"
                    icone="key-outline"
                    onPress={valider}
                    desactive={code.length !== LONGUEUR_CODE}
                    chargement={chargement}
                  />

                  <View className="flex-row justify-center items-center gap-1.5">
                    <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
                      Pas reçu ?
                    </Text>
                    <Pressable onPress={renvoyer} disabled={attente > 0 || chargement} hitSlop={8}>
                      <Text
                        className="text-[13px] font-extrabold underline"
                        style={{ color: VERT_FOND, opacity: attente > 0 ? 0.45 : 1 }}>
                        {attente > 0 ? `Renvoyer le code (${attente} s)` : 'Renvoyer le code'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Pied de page de la maquette 43. Avant connexion, les écrans
                  /web/... sont inaccessibles (garde d'authentification) : on
                  ouvre donc le site. « Mentions légales » figure sur la
                  maquette mais le site n'a pas cette page — pas de lien
                  inventé en attendant son contenu. */}
              <View className="flex-row justify-center gap-2 mt-8">
                <Pressable onPress={() => Linking.openURL(`${SITE_URL}/conditions-utilisation`).catch(() => {})}>
                  <Text className="text-[12px] underline" style={{ color: 'rgba(0,0,0,0.5)' }}>CGU</Text>
                </Pressable>
                <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.35)' }}>·</Text>
                <Pressable onPress={() => Linking.openURL(`${SITE_URL}/confidentialite`).catch(() => {})}>
                  <Text className="text-[12px] underline" style={{ color: 'rgba(0,0,0,0.5)' }}>Confidentialité</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function BoiteErreur({ texte }: { texte: string }) {
  return (
    <View className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5">
      <Text className="text-[11.5px] font-bold text-red-600">{texte}</Text>
    </View>
  );
}
