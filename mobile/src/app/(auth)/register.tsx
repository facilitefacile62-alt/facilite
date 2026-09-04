import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Port de src/app/register/page.js, avec les mêmes deux changements que la
// version web du 2026-09-04 : Nom/Prénom séparés (concaténés en un seul
// full_name à l'envoi — le déclencheur handle_new_user attend ce champ, pas
// deux), et redirection vers /verifiez-votre-email plutôt qu'un message
// inline. Contrairement au web, aucun détour par /api/auth/register : cette
// route existe pour donner à Vercel BotID des requêtes de navigateur à
// challenger (instrumentation-client.js) — une app native n'exécute pas ce
// challenge, la faire transiter par la route web n'apporterait donc aucune
// protection réelle. signUp() est appelé directement, comme le faisait le
// web avant l'ajout de BotID.
export default function RegisterScreen() {
  const router = useRouter();
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const creerCompte = async () => {
    setErrorMessage('');
    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
    if (!fullName || !email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName } },
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
              Créez votre compte pour commencer
            </Text>

            <View className="bg-[#161E2E] border border-[#232D40] rounded-2xl p-5">
              <View className="flex-row gap-2.5 mb-3.5">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Nom</Text>
                  <TextInput
                    value={nom}
                    onChangeText={setNom}
                    placeholder="Diop"
                    placeholderTextColor="#5b6577"
                    className="bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 py-3 text-[13.5px] text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Prénom</Text>
                  <TextInput
                    value={prenom}
                    onChangeText={setPrenom}
                    placeholder="Aïssatou"
                    placeholderTextColor="#5b6577"
                    className="bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 py-3 text-[13.5px] text-white"
                  />
                </View>
              </View>

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
              <View className="flex-row items-center bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 mb-3.5">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Au moins 6 caractères"
                  placeholderTextColor="#5b6577"
                  className="flex-1 py-3 text-[13.5px] text-white"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94a3b8" />
                </Pressable>
              </View>

              <Text className="text-[11px] font-bold text-gray-400 mb-1.5">Confirmer le mot de passe</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder="Confirmez votre mot de passe"
                placeholderTextColor="#5b6577"
                className="bg-[#0B0F17] border border-[#232D40] rounded-xl px-3.5 py-3 text-[13.5px] text-white"
              />

              {errorMessage ? (
                <Text className="text-[11.5px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3.5">
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                onPress={creerCompte}
                disabled={loading || !nom.trim() || !prenom.trim() || !email.trim() || !password}
                className="bg-blue-600 disabled:opacity-50 rounded-xl py-3.5 items-center mt-4">
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-[13.5px] font-bold text-white">Créer le compte</Text>}
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
              <Text className="text-[12.5px] text-gray-500">Déjà un compte ?</Text>
              <Link href="/login" className="text-[12.5px] font-bold text-blue-400">
                Se connecter
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
