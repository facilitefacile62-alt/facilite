import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

// Port partiel de src/app/forgot-password/page.js : envoie le lien de
// réinitialisation. Ce point ne couvre PAS la suite du parcours (ouverture
// du lien reçu par e-mail -> saisie du nouveau mot de passe) : sur le web,
// cette étape reste sur /login et écoute l'événement PASSWORD_RECOVERY, ce
// qui entrerait en conflit avec AuthGate (src/app/_layout.tsx), qui renvoie
// vers les tabs dès qu'une session existe — y compris une session de
// récupération. À traiter dans un point dédié plutôt que de risquer de
// bloquer quelqu'un en pleine réinitialisation.
//
// Réécrit sur fond clair le 13/09/2026 (mise en page/couleurs de
// design_handoff_facilite/pages/15-mot-de-passe-oublie.html, texte et
// comportement réels inchangés) : cet écran était resté codé en dur dans
// l'ancien thème sombre (#0B0F17) abandonné pour le reste de l'app, même
// badge clé et même teal #085041 que login.tsx et register.tsx.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const envoyerLien = async () => {
    setErrorMessage('');
    if (!email.includes('@')) {
      setErrorMessage('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('login'),
      });
      if (error) {
        setErrorMessage(error.message || "Erreur lors de l'envoi de l'e-mail de réinitialisation.");
        return;
      }
      setIsSuccess(true);
    } catch {
      setErrorMessage('Une erreur imprévue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-6 pb-10 grow justify-center" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-[22px] px-6 py-7 items-center border border-gray-200 shadow-xs">
              <View className="w-14 h-14 rounded-full bg-white border-2 border-[#085041] items-center justify-center">
                <Image
                  source={require('@/assets/images/login_key_teal.png')}
                  style={{ width: 28, height: 28 }}
                  contentFit="contain"
                  alt="Facilité"
                />
              </View>

              {isSuccess ? (
                <>
                  <Text className="text-[19px] font-black text-[#0F172A] mt-3.5">E-mail envoyé</Text>
                  <View className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
                    <Text className="text-[12.5px] text-emerald-800 text-center leading-relaxed">
                      Si un compte existe pour <Text className="font-bold">{email}</Text>, vous recevrez un
                      lien d&apos;ici quelques instants.
                    </Text>
                  </View>
                  <Link
                    href="/login"
                    className="w-full text-center bg-[#085041] rounded-full py-3.5 mt-5 text-[14px] font-bold text-white">
                    Retour à la connexion
                  </Link>
                </>
              ) : (
                <>
                  <Text className="text-[19px] font-black text-[#0F172A] mt-3.5">Réinitialiser le mot de passe</Text>
                  <Text className="text-[13px] text-black/50 font-medium mt-1.5 text-center">
                    Entrez votre e-mail pour recevoir un lien de réinitialisation.
                  </Text>

                  <View className="w-full mt-5 gap-2.5">
                    <View>
                      <Text className="text-[13px] font-bold text-[#1A1A1A] mb-1.5">Adresse e-mail</Text>
                      <TextInput
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          if (errorMessage) setErrorMessage('');
                        }}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        placeholder="nom@exemple.com"
                        placeholderTextColor="rgba(0,0,0,0.35)"
                        className="w-full border-[1.6px] border-[#085041] rounded-full px-4 py-3 text-[13.5px] text-[#1A1A1A]"
                      />
                    </View>

                    {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                    <Pressable
                      onPress={envoyerLien}
                      disabled={loading || !email.trim()}
                      className="w-full bg-[#085041] rounded-full py-3.5 items-center"
                      style={{ opacity: loading || !email.trim() ? 0.6 : 1 }}>
                      {loading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="text-white text-[14px] font-bold">Envoyer le lien</Text>
                      )}
                    </Pressable>

                    <Link href="/login" className="self-center text-[13px] font-bold text-[#085041] mt-1">
                      ← Retour à la connexion
                    </Link>
                  </View>
                </>
              )}
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
