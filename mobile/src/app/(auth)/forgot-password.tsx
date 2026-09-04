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
    <View className="flex-1 bg-[#0B0F17]">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-6 pt-6 pb-10 grow justify-center" keyboardShouldPersistTaps="handled">
            <Text className="text-2xl font-extrabold text-blue-500 text-center mb-1">Facilité</Text>
            <Text className="text-[13px] font-medium text-gray-400 text-center mb-8">
              Réinitialiser le mot de passe
            </Text>

            <View className="bg-[#161E2E] border border-[#232D40] rounded-2xl p-5">
              {isSuccess ? (
                <View className="items-center py-3">
                  <View className="w-12 h-12 rounded-full bg-emerald-500/15 items-center justify-center mb-3">
                    <Text className="text-emerald-400 text-xl font-bold">✓</Text>
                  </View>
                  <Text className="text-[13.5px] font-bold text-white mb-1.5">E-mail envoyé</Text>
                  <Text className="text-[12px] text-gray-400 text-center leading-relaxed">
                    Si un compte existe pour{' '}
                    <Text className="font-bold text-white">{email}</Text>, vous recevrez un lien d&apos;ici
                    quelques instants.
                  </Text>
                  <Link
                    href="/login"
                    className="w-full text-center bg-blue-600 rounded-xl py-3.5 mt-5 text-[13.5px] font-bold text-white">
                    Retour à la connexion
                  </Link>
                </View>
              ) : (
                <>
                  <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Adresse e-mail</Text>
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
                    placeholderTextColor="#5b6577"
                    className="bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 py-3 text-[13.5px] text-white"
                  />

                  {errorMessage ? (
                    <Text className="text-[11.5px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
                      {errorMessage}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={envoyerLien}
                    disabled={loading || !email.trim()}
                    className="bg-blue-600 disabled:opacity-50 rounded-xl py-3.5 items-center mt-4">
                    {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[13.5px] font-bold text-white">Envoyer le lien</Text>}
                  </Pressable>
                </>
              )}
            </View>

            <View className="items-center mt-6">
              <Link href="/login" className="text-[12.5px] font-bold text-blue-400">
                ← Retour à la connexion
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
