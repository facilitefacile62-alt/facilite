import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconGoogle } from '@/components/facilite-icons';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Reproduit design_handoff_facilite/pages/14-connexion.html ET, surtout, le
// vrai flux à 2 étapes déjà en place côté web (src/app/login/page.js) :
// étape 1 = e-mail seul (+ Google, + mot de passe oublié) ; étape 2 = mot de
// passe (+ lien magique, + retour "Modifier"). La version précédente de cet
// écran affichait email ET mot de passe d'un coup, sans lien avec ni le
// design fourni ni le comportement réel du site — signalé en capture par
// l'utilisateur en comparant avec ffacilite.com. Couleur de marque #085041
// (teal), pas le #0d3b34 approché par le mockup HTML statique : le vrai
// code web fait foi sur les couleurs exactes.
const TEAL = '#085041';

export default function LoginScreen() {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const emailPropre = () => email.trim().toLowerCase();

  const validerEtape1 = () => {
    if (!emailPropre() || !emailPropre().includes('@')) {
      setErrorMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setErrorMessage('');
    setEtape(2);
  };

  const seConnecter = async () => {
    setErrorMessage('');
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailPropre(), password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Adresse email ou mot de passe incorrect. Vérifiez vos identifiants.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage("Votre adresse email n'a pas encore été confirmée. Vérifiez votre boîte de réception.");
          setNeedsConfirmation(true);
        } else {
          setErrorMessage(error.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const renvoyerConfirmation = async () => {
    if (!emailPropre()) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: emailPropre() });
      setErrorMessage(error ? error.message || "Impossible de renvoyer l'email." : 'Un nouvel email a été envoyé.');
      if (!error) setNeedsConfirmation(false);
    } finally {
      setIsResending(false);
    }
  };

  const envoyerLienMagique = async () => {
    if (!emailPropre() || !emailPropre().includes('@')) {
      setErrorMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setMagicLinkLoading(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: emailPropre() });
      if (error) setErrorMessage(error.message || "Impossible d'envoyer le lien magique.");
      else setMagicLinkSent(true);
    } finally {
      setMagicLinkLoading(false);
    }
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

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-6 pb-10 grow justify-center" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-[22px] px-6 py-7 items-center shadow-xs">
              <View className="w-14 h-14 rounded-full bg-white border-2 border-[#085041] items-center justify-center">
                <Image
                  source={require('@/assets/images/login_key_teal.png')}
                  style={{ width: 28, height: 28 }}
                  contentFit="contain"
                  alt="Facilité"
                />
              </View>
              <Text className="text-[20px] font-black text-[#0F172A] mt-3.5">Connexion</Text>
              <Text className="text-[13px] text-black/50 font-medium mt-1.5 text-center">
                Saisissez vos identifiants pour vous connecter.
              </Text>

              {etape === 1 ? (
                <View className="w-full mt-5 gap-2.5">
                  <Pressable
                    onPress={continuerAvecGoogle}
                    disabled={googleLoading}
                    className="w-full flex-row items-center justify-center gap-2.5 border border-black/15 rounded-full py-3.5"
                    style={{ opacity: googleLoading ? 0.6 : 1 }}>
                    <IconGoogle />
                    <Text className="text-[13.5px] font-bold text-[#1A1A1A]">
                      {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
                    </Text>
                  </Pressable>

                  <Text className="text-center text-[11.5px] font-semibold text-black/40 my-1 uppercase tracking-wider">
                    OU
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMessage) setErrorMessage('');
                    }}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    placeholder="nom@exemple.com"
                    placeholderTextColor="rgba(0,0,0,0.35)"
                    className="w-full border-[1.6px] border-[#085041] rounded-full px-4 py-3 text-[13.5px] text-[#1A1A1A]"
                  />

                  {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                  <Pressable onPress={validerEtape1} className="w-full bg-[#085041] rounded-full py-3.5 items-center">
                    <Text className="text-white text-[14px] font-bold">Continuer avec l&apos;e-mail</Text>
                  </Pressable>

                  <Link href="/forgot-password" className="self-end text-[13px] font-semibold text-[#085041] mt-1">
                    Mot de passe oublié ?
                  </Link>
                </View>
              ) : (
                <View className="w-full mt-5 gap-2.5">
                  <View className="w-full flex-row items-center justify-between bg-black/[0.03] px-3.5 py-2.5 rounded-xl border border-black/10">
                    <Text className="text-[12.5px] font-semibold text-[#1A1A1A] flex-1 mr-2" numberOfLines={1}>
                      {email}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setEtape(1);
                        setPassword('');
                        setErrorMessage('');
                        setMagicLinkSent(false);
                      }}>
                      <Text className="text-[11.5px] font-semibold text-black/45">Modifier</Text>
                    </Pressable>
                  </View>

                  {magicLinkSent ? (
                    <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <Text className="text-[12px] font-bold text-emerald-800">
                        ✉️ Lien de connexion envoyé !
                      </Text>
                      <Text className="text-[11.5px] text-emerald-800 mt-0.5">
                        Vérifiez votre boîte de réception pour vous connecter en 1 clic.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View className="w-full flex-row items-center border-[1.6px] border-[#085041] rounded-full px-4">
                        <TextInput
                          value={password}
                          onChangeText={(t) => {
                            setPassword(t);
                            if (errorMessage) setErrorMessage('');
                          }}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          placeholder="Saisissez votre mot de passe"
                          placeholderTextColor="rgba(0,0,0,0.35)"
                          className="flex-1 py-3 text-[13.5px] text-[#1A1A1A]"
                        />
                        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={16}
                            color="rgba(0,0,0,0.4)"
                          />
                        </Pressable>
                      </View>

                      <View className="w-full flex-row items-center justify-between">
                        <Pressable onPress={envoyerLienMagique} disabled={magicLinkLoading}>
                          <Text className="text-[11.5px] font-semibold text-black/45">
                            {magicLinkLoading ? 'Envoi…' : 'Lien magique'}
                          </Text>
                        </Pressable>
                        <Link href="/forgot-password" className="text-[11.5px] font-semibold text-[#085041]">
                          Mot de passe oublié ?
                        </Link>
                      </View>

                      {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                      {needsConfirmation && (
                        <Pressable
                          onPress={renvoyerConfirmation}
                          disabled={isResending}
                          className="py-2.5 rounded-xl border border-[#085041] items-center">
                          <Text className="text-[12px] font-bold text-[#085041]">
                            {isResending ? 'Envoi en cours…' : "Renvoyer l'email de confirmation"}
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        onPress={seConnecter}
                        disabled={loading || !password}
                        className="w-full bg-[#085041] rounded-full py-3.5 items-center"
                        style={{ opacity: loading || !password ? 0.6 : 1 }}>
                        {loading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text className="text-white text-[14px] font-bold">Se connecter</Text>
                        )}
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              <View className="w-full border-t border-black/[0.08] mt-5 pt-3.5 flex-row justify-center gap-1.5">
                <Text className="text-[13px] text-[#1A1A1A]">Pas encore de compte ?</Text>
                <Link href="/register" className="text-[13px] font-bold text-blue-600">
                  Inscrivez-vous
                </Link>
              </View>
            </View>

            <Text className="text-center text-[11.5px] text-black/35 mt-4">
              © 2026 Facilité · Tous droits réservés.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function BoiteErreur({ texte }: { texte: string }) {
  return (
    <View className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5">
      <Text className="text-[11px] font-bold text-red-600">{texte}</Text>
    </View>
  );
}
