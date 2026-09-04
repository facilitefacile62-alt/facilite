import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Port simplifié de src/app/login/page.js (723 lignes sur le web : magic
// link, connexion par téléphone désactivée côté web, récupération de mot de
// passe...). Ce point ne porte que le chemin principal : email/mot de passe,
// Google, et le cas « email non confirmé » — les autres méthodes suivront
// avec des points dédiés si besoin. Aucune navigation manuelle après succès :
// AuthGate (src/app/_layout.tsx) redirige tout seul dès que la session
// change dans AuthContext.
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const seConnecter = async () => {
    if (!email.trim() || !password) return;
    setErrorMessage('');
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
    if (!email.trim()) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
      setErrorMessage(error ? error.message || "Impossible de renvoyer l'email." : 'Un nouvel email a été envoyé.');
      if (!error) setNeedsConfirmation(false);
    } finally {
      setIsResending(false);
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
    <View className="flex-1 bg-[#0B0F17]">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-6 pt-6 pb-10 grow justify-center" keyboardShouldPersistTaps="handled">
            <Text className="text-2xl font-extrabold text-blue-500 text-center mb-1">Facilité</Text>
            <Text className="text-[13px] font-medium text-gray-400 text-center mb-8">
              Connectez-vous pour continuer
            </Text>

            <View className="bg-[#161E2E] border border-[#232D40] rounded-2xl p-5">
              <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="vous@exemple.com"
                placeholderTextColor="#5b6577"
                className="bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 py-3 text-[13.5px] text-white mb-3.5"
              />

              <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Mot de passe</Text>
              <View className="flex-row items-center bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="••••••••"
                  placeholderTextColor="#5b6577"
                  className="flex-1 py-3 text-[13.5px] text-white"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94a3b8" />
                </Pressable>
              </View>

              <View className="items-end mt-2 mb-1">
                <Link href="/forgot-password" className="text-[11.5px] font-semibold text-blue-400">
                  Mot de passe oublié ?
                </Link>
              </View>

              {errorMessage ? (
                <Text className="text-[11.5px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
                  {errorMessage}
                </Text>
              ) : null}

              {needsConfirmation && (
                <Pressable
                  onPress={renvoyerConfirmation}
                  disabled={isResending}
                  className="mt-2.5 py-2.5 rounded-xl border border-emerald-500 items-center">
                  <Text className="text-[12px] font-bold text-emerald-400">
                    {isResending ? 'Envoi en cours…' : "Renvoyer l'email de confirmation"}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={seConnecter}
                disabled={loading || !email.trim() || !password}
                className="bg-blue-600 disabled:opacity-50 rounded-xl py-3.5 items-center mt-4">
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[13.5px] font-bold text-white">Se connecter</Text>}
              </Pressable>

              <View className="flex-row items-center gap-3 my-5">
                <View className="flex-1 h-px bg-[#232D40]" />
                <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ou</Text>
                <View className="flex-1 h-px bg-[#232D40]" />
              </View>

              <Pressable
                onPress={continuerAvecGoogle}
                disabled={googleLoading}
                className="flex-row items-center justify-center gap-2.5 bg-[#0B0F17] border border-[#232D40] rounded-xl py-3">
                <Ionicons name="logo-google" size={15} color="#e5e7eb" />
                <Text className="text-[13px] font-bold text-white">
                  {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row justify-center gap-1.5 mt-6">
              <Text className="text-[12.5px] text-gray-500">Pas encore de compte ?</Text>
              <Link href="/register" className="text-[12.5px] font-bold text-blue-400">
                Créer un compte
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
