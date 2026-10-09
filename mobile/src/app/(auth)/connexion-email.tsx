import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import { IconGoogle } from '@/components/facilite-icons';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Connexion par e-mail ou Google — maquette 45. Atteinte depuis
// « Continuer avec l'e-mail ou Google › » de l'écran téléphone (login.tsx).
// Le flux reste celui du site (src/app/login/page.js), à deux étapes :
// étape 1 = e-mail seul (+ Google, + mot de passe oublié) ; étape 2 = mot de
// passe (+ lien magique, + retour « Modifier »).
//
// Habillage de la maquette : fond crème, en-tête #e3dbcc avec le bouton vert
// « Connexion », carte blanche, clé dans son halo, champs à bordure vert
// foncé 1,5 px et coins 14 px, « Continuer avec l'e-mail » en vert foncé
// #0d3b34 (charte §2.1).
//
// L'en-tête n'a ni recherche ni menu : avant la connexion, ils ouvriraient
// des écrans protégés et renverraient aussitôt ici — des boutons morts.
const FOND_BARRE = '#e3dbcc';
const VERT = '#10B981';
const VERT_FONCE = '#0B3D2A';
const BLEU = '#2563EB';

export default function ConnexionEmailScreen() {
  const router = useRouter();
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

  const champ = 'w-full bg-white rounded-[14px] px-4 text-[14px] text-[#1A1A1A]';
  const styleChamp = { height: 56, borderWidth: 1.5, borderColor: VERT_FONCE } as const;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* En-tête : « Facilité » + bouton vert Connexion (ramène au téléphone) */}
        <View className="flex-row items-center justify-between px-5 py-3.5" style={{ backgroundColor: FOND_BARRE }}>
          <Text className="text-[19px] font-black text-[#2563EB]">Facilité</Text>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
            className="flex-row items-center gap-1.5 rounded-full px-4 py-2.5"
            style={{ backgroundColor: VERT }}>
            <Ionicons name="log-in-outline" size={15} color="#fff" />
            <Text className="text-white text-[13px] font-bold">Connexion</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-5 pb-10" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-[24px] px-5 py-6 items-center" style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
              {/* Clé dans son halo */}
              <View
                className="items-center justify-center"
                style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: '#D9F5E8' }}>
                <View
                  className="items-center justify-center bg-white"
                  style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: VERT }}>
                  <Text style={{ fontSize: 26 }}>🔑</Text>
                </View>
              </View>

              <Text className="text-[22px] font-black text-[#1A1A1A] mt-3.5">Connexion</Text>
              <Text className="text-[13px] mt-1.5 text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Saisissez vos identifiants pour vous connecter.
              </Text>

              {etape === 1 ? (
                <View className="w-full mt-5 gap-3">
                  <Pressable
                    onPress={continuerAvecGoogle}
                    disabled={googleLoading}
                    className="w-full flex-row items-center justify-center gap-2.5 bg-white rounded-[14px]"
                    style={{ height: 54, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)', opacity: googleLoading ? 0.6 : 1 }}>
                    <IconGoogle />
                    <Text className="text-[14px] font-bold text-[#1A1A1A]">
                      {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
                    </Text>
                  </Pressable>

                  <Text className="text-center text-[12px] font-bold" style={{ color: 'rgba(0,0,0,0.4)' }}>
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
                    className={champ}
                    style={styleChamp}
                  />

                  {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                  <BoutonAction
                    sombre
                    titre="Continuer avec l'e-mail"
                    sousTitre="Connexion par adresse e-mail"
                    icone="mail-outline"
                    onPress={validerEtape1}
                  />

                  <Link href="/forgot-password" className="self-center text-[13.5px] font-bold" style={{ color: '#10B981' }}>
                    Mot de passe oublié ?
                  </Link>
                </View>
              ) : (
                <View className="w-full mt-5 gap-3">
                  <View
                    className="w-full flex-row items-center justify-between rounded-[14px] px-4 py-3.5"
                    style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
                    <Text className="text-[13px] font-semibold text-[#1A1A1A] flex-1 mr-2" numberOfLines={1}>
                      {email}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setEtape(1);
                        setPassword('');
                        setErrorMessage('');
                        setMagicLinkSent(false);
                      }}>
                      <Text className="text-[12px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>
                        Modifier
                      </Text>
                    </Pressable>
                  </View>

                  {magicLinkSent ? (
                    <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <Text className="text-[12.5px] font-bold text-emerald-800">✉️ Lien de connexion envoyé !</Text>
                      <Text className="text-[12px] text-emerald-800 mt-0.5">
                        Vérifiez votre boîte de réception pour vous connecter en 1 clic.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View
                        className="w-full flex-row items-center bg-white rounded-[14px] px-4"
                        style={{ height: 56, borderWidth: 1.5, borderColor: VERT_FONCE }}>
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
                          className="flex-1 text-[14px] text-[#1A1A1A]"
                        />
                        <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color="rgba(0,0,0,0.4)"
                          />
                        </Pressable>
                      </View>

                      <View className="w-full flex-row items-center justify-between">
                        <Pressable onPress={envoyerLienMagique} disabled={magicLinkLoading} hitSlop={8}>
                          <Text className="text-[12.5px] font-semibold" style={{ color: 'rgba(0,0,0,0.45)' }}>
                            {magicLinkLoading ? 'Envoi…' : 'Lien magique'}
                          </Text>
                        </Pressable>
                        <Link href="/forgot-password" className="text-[12.5px] font-bold" style={{ color: '#10B981' }}>
                          Mot de passe oublié ?
                        </Link>
                      </View>

                      {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                      {needsConfirmation && (
                        <Pressable
                          onPress={renvoyerConfirmation}
                          disabled={isResending}
                          className="py-3 rounded-[14px] items-center"
                          style={{ borderWidth: 1.5, borderColor: VERT_FONCE }}>
                          <Text className="text-[12.5px] font-bold" style={{ color: VERT_FONCE }}>
                            {isResending ? 'Envoi en cours…' : "Renvoyer l'email de confirmation"}
                          </Text>
                        </Pressable>
                      )}

                      <BoutonAction
                        sombre
                        titre="Se connecter"
                        sousTitre="Avec votre mot de passe"
                        icone="log-in-outline"
                        onPress={seConnecter}
                        desactive={!password}
                        chargement={loading}
                      />
                    </>
                  )}
                </View>
              )}

              <View className="w-full mt-5 pt-4 flex-row justify-center gap-1.5" style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
                <Text className="text-[13.5px] text-[#1A1A1A]">Pas encore de compte ?</Text>
                <Link href="/register" className="text-[13.5px] font-bold" style={{ color: BLEU }}>
                  Inscrivez-vous
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

function BoiteErreur({ texte }: { texte: string }) {
  return (
    <View className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5">
      <Text className="text-[11.5px] font-bold text-red-600">{texte}</Text>
    </View>
  );
}
