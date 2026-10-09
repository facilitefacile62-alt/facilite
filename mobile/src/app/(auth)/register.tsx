import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EnteteAuth from '@/components/EnteteAuth';
import SaisieCodeSms from '@/components/SaisieCodeSms';
import { IconGoogle } from '@/components/facilite-icons';
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
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Inscription — maquette 58 « Sign Up ». Port de src/app/register/page.js :
// Nom/Prénom séparés concaténés en un seul full_name à l'envoi (le
// déclencheur handle_new_user attend ce champ), puis redirection vers
// /verifiez-votre-email. Aucun détour par /api/auth/register : cette route
// n'existe que pour donner à Vercel BotID des requêtes de navigateur à
// challenger — une app native n'exécute pas ce challenge.
//
// Habillage de la maquette : en-tête #e3dbcc avec le bouton vert
// « Connexion », clé dans son halo, sélecteur segmenté Téléphone | E-mail
// (E-mail par défaut), champs à bordure vert foncé 1,5 px et coins 14 px.
// Les libellés anglais (Sign Up, Password, Create Account, OR, Continue with
// Google) sont ceux de la maquette, qui reprend le site.
//
// Onglet Téléphone : même mécanique que l'onglet du site (désactivé là-bas
// par PHONE_SIGNUP_ENABLED tant qu'un envoi SMS réel n'a pas été testé de
// bout en bout) — signInWithOtp en création, puis verifyOtp. Le champ
// Password du sélecteur de la maquette est remplacé par un œil : le chevron
// de la maquette n'ouvrait rien.
const VERT = '#10B981';
const VERT_FONCE = '#0B3D2A';
const BLEU = '#2563EB';

type Methode = 'telephone' | 'email';

const champStyle = { height: 56, borderWidth: 1.5, borderColor: VERT_FONCE, borderRadius: 14, backgroundColor: '#fff' } as const;

export default function RegisterScreen() {
  const router = useRouter();
  const [methode, setMethode] = useState<Methode>('email');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [chiffres, setChiffres] = useState('');
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [code, setCode] = useState('');
  const [attente, setAttente] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const nomComplet = `${prenom.trim()} ${nom.trim()}`.trim();

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const creerCompteEmail = async () => {
    setErrorMessage('');
    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (!nomComplet || !email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: nomComplet } },
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      router.replace(`/verifiez-votre-email?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setErrorMessage('Une erreur imprévue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const envoyerCode = async () => {
    if (!nomComplet || !numeroValide(chiffres) || loading) return;
    setLoading(true);
    setErrorMessage('');
    const probleme = await envoyerCodeSms(chiffres, { nomComplet });
    setLoading(false);
    if (probleme) {
      setErrorMessage(probleme);
      return;
    }
    setCode('');
    setAttente(DELAI_RENVOI_S);
    setCodeEnvoye(true);
  };

  const validerCode = async () => {
    if (code.length !== LONGUEUR_CODE || loading) return;
    setLoading(true);
    setErrorMessage('');
    const probleme = await verifierCodeSms(chiffres, code);
    setLoading(false);
    if (probleme) setErrorMessage(probleme);
    // Succès : la session déclenche la redirection du garde d'authentification.
  };

  const continuerAvecGoogle = async () => {
    setGoogleLoading(true);
    setErrorMessage('');
    try {
      await seConnecterAvecGoogle();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la connexion Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const formulaireEmailPret = Boolean(nom.trim() && prenom.trim() && email.trim() && password && confirmPassword);
  const formulaireTelPret = Boolean(nom.trim() && prenom.trim() && numeroValide(chiffres));

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteAuth />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-5 pb-10" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-[24px] px-5 py-6 items-center" style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
              <View
                className="items-center justify-center"
                style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: '#D9F5E8' }}>
                <View
                  className="items-center justify-center bg-white"
                  style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: VERT }}>
                  <Text style={{ fontSize: 26 }}>🔑</Text>
                </View>
              </View>

              <Text className="text-[22px] font-black text-[#1A1A1A] mt-3.5">Sign Up</Text>
              <Text className="text-[13px] mt-1.5 text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Create your account to get started.
              </Text>

              <View className="w-full mt-5 gap-3">
                {codeEnvoye ? (
                  <View className="gap-3.5">
                    <Pressable
                      onPress={() => {
                        setCodeEnvoye(false);
                        setCode('');
                        setErrorMessage('');
                      }}
                      hitSlop={8}>
                      <Text className="text-[13.5px] font-extrabold" style={{ color: '#0d3b34' }}>
                        ‹ Modifier le numéro
                      </Text>
                    </Pressable>
                    <View>
                      <Text className="text-[20px] font-black text-[#1A1A1A]">Entre ton code</Text>
                      <Text className="text-[13px] mt-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        Le code à {LONGUEUR_CODE} chiffres vient de partir au {INDICATIF} {formaterNumero(chiffres)}.
                      </Text>
                    </View>
                    <SaisieCodeSms
                      code={code}
                      onChange={(v) => {
                        setCode(v);
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                    {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}
                    <BoutonSimple
                      titre="Valider"
                      onPress={validerCode}
                      desactive={code.length !== LONGUEUR_CODE}
                      chargement={loading}
                    />
                    <View className="flex-row justify-center items-center gap-1.5">
                      <Text className="text-[13px]" style={{ color: 'rgba(0,0,0,0.5)' }}>Pas reçu ?</Text>
                      <Pressable
                        onPress={async () => {
                          if (attente > 0 || loading) return;
                          setLoading(true);
                          const p = await envoyerCodeSms(chiffres, { nomComplet });
                          setLoading(false);
                          if (p) setErrorMessage(p);
                          else {
                            setCode('');
                            setAttente(DELAI_RENVOI_S);
                          }
                        }}
                        disabled={attente > 0 || loading}
                        hitSlop={8}>
                        <Text
                          className="text-[13px] font-extrabold underline"
                          style={{ color: '#0d3b34', opacity: attente > 0 ? 0.45 : 1 }}>
                          {attente > 0 ? `Renvoyer le code (${attente} s)` : 'Renvoyer le code'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Nom</Text>
                        <TextInput
                          value={nom}
                          onChangeText={setNom}
                          placeholder="Votre nom"
                          placeholderTextColor="rgba(0,0,0,0.35)"
                          style={[champStyle, { paddingHorizontal: 14, fontSize: 14, color: '#1A1A1A' }]}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Prénom</Text>
                        <TextInput
                          value={prenom}
                          onChangeText={setPrenom}
                          placeholder="Votre prénom"
                          placeholderTextColor="rgba(0,0,0,0.35)"
                          style={[champStyle, { paddingHorizontal: 14, fontSize: 14, color: '#1A1A1A' }]}
                        />
                      </View>
                    </View>

                    {/* Sélecteur segmenté Téléphone | E-mail (E-mail par défaut) */}
                    <View className="flex-row rounded-[14px] p-1" style={{ backgroundColor: '#E8E4DA' }}>
                      {(
                        [
                          { id: 'telephone' as const, libelle: 'Téléphone' },
                          { id: 'email' as const, libelle: 'E-mail' },
                        ]
                      ).map((o) => {
                        const actif = methode === o.id;
                        return (
                          <Pressable
                            key={o.id}
                            onPress={() => {
                              setMethode(o.id);
                              setErrorMessage('');
                            }}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: actif }}
                            className="flex-1 items-center justify-center rounded-[11px]"
                            style={{ height: 42, backgroundColor: actif ? '#fff' : 'transparent' }}>
                            <Text className="text-[14px] font-extrabold" style={{ color: actif ? '#1A1A1A' : 'rgba(0,0,0,0.55)' }}>
                              {o.libelle}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {methode === 'email' ? (
                      <>
                        <View>
                          <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Email</Text>
                          <TextInput
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            placeholder="Enter your Email"
                            placeholderTextColor="rgba(0,0,0,0.35)"
                            style={[champStyle, { paddingHorizontal: 14, fontSize: 14, color: '#1A1A1A' }]}
                          />
                        </View>

                        <View>
                          <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Password</Text>
                          <View style={[champStyle, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }]}>
                            <TextInput
                              value={password}
                              onChangeText={setPassword}
                              secureTextEntry={!showPassword}
                              autoCapitalize="none"
                              placeholder="Create a password"
                              placeholderTextColor="rgba(0,0,0,0.35)"
                              style={{ flex: 1, fontSize: 14, color: '#1A1A1A' }}
                            />
                            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} accessibilityLabel="Afficher le mot de passe">
                              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(0,0,0,0.4)" />
                            </Pressable>
                          </View>
                        </View>

                        <View>
                          <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Confirm Password</Text>
                          <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            placeholder="Confirm your password"
                            placeholderTextColor="rgba(0,0,0,0.35)"
                            style={[champStyle, { paddingHorizontal: 14, fontSize: 14, color: '#1A1A1A' }]}
                          />
                        </View>
                      </>
                    ) : (
                      <View>
                        <Text className="text-[12.5px] font-extrabold text-[#1A1A1A] mb-1.5">Numéro de téléphone</Text>
                        <View style={[champStyle, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }]}>
                          <Text style={{ fontSize: 16 }}>🇸🇳</Text>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginLeft: 8 }}>{INDICATIF}</Text>
                          <View style={{ width: 1, height: 22, backgroundColor: 'rgba(0,0,0,0.15)', marginHorizontal: 10 }} />
                          <TextInput
                            value={formaterNumero(chiffres)}
                            onChangeText={(t) => {
                              setChiffres(chiffresDuNumero(t));
                              if (errorMessage) setErrorMessage('');
                            }}
                            placeholder="77 000 00 00"
                            placeholderTextColor="rgba(0,0,0,0.3)"
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            accessibilityLabel="Numéro de téléphone"
                            style={{ flex: 1, fontSize: 15, color: '#1A1A1A' }}
                          />
                        </View>
                      </View>
                    )}

                    {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                    <BoutonSimple
                      titre="Create Account"
                      onPress={methode === 'email' ? creerCompteEmail : envoyerCode}
                      desactive={methode === 'email' ? !formulaireEmailPret : !formulaireTelPret}
                      chargement={loading}
                    />

                    <Text className="text-center text-[12px] font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      OR
                    </Text>

                    <Pressable
                      onPress={continuerAvecGoogle}
                      disabled={googleLoading}
                      className="w-full flex-row items-center justify-center gap-2.5 bg-white rounded-[14px]"
                      style={{ height: 54, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', opacity: googleLoading ? 0.6 : 1 }}>
                      <IconGoogle />
                      <Text className="text-[14px] font-bold text-[#1A1A1A]">
                        {googleLoading ? 'Redirection…' : 'Continue with Google'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View className="w-full mt-5 pt-4 flex-row justify-center gap-1.5" style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
                <Text className="text-[13.5px] text-[#1A1A1A]">Already have an account?</Text>
                <Link href="/login" className="text-[13.5px] font-bold" style={{ color: BLEU }}>
                  Log In
                </Link>
              </View>
            </View>

            <Text className="text-center text-[12px] mt-4" style={{ color: 'rgba(0,0,0,0.35)' }}>
              © 2026 Facilité · Tous droits réservés.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Bouton « simple » de la charte §2.1 : même forme, titre centré, sans icône. */
function BoutonSimple({
  titre,
  onPress,
  desactive,
  chargement,
}: {
  titre: string;
  onPress: () => void;
  desactive?: boolean;
  chargement?: boolean;
}) {
  const inactif = Boolean(desactive || chargement);
  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      className="w-full items-center justify-center rounded-[14px]"
      style={{
        height: 54,
        backgroundColor: '#F3FBF7',
        borderWidth: 1.5,
        borderColor: '#34D399',
        opacity: desactive && !chargement ? 0.6 : 1,
      }}>
      {chargement ? (
        <ActivityIndicator color="#047857" />
      ) : (
        <Text className="text-[15px] font-extrabold text-[#1A1A1A]">{titre}</Text>
      )}
    </Pressable>
  );
}

function BoiteErreur({ texte }: { texte: string }) {
  return (
    <View className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5">
      <Text className="text-[11.5px] font-bold text-red-600">{texte}</Text>
    </View>
  );
}
