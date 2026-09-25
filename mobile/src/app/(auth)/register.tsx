import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconGoogle } from '@/components/facilite-icons';
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
//
// Réécrit sur fond clair le 13/09/2026 (mise en page/couleurs de
// design_handoff_facilite/pages/16-inscription.html, texte et
// comportement réels inchangés) : cet écran était resté codé en dur dans
// l'ancien thème sombre (#0B0F17) abandonné pour le reste de l'app,
// invisible tant que le ThemeProvider masquait le problème en forçant un
// fond clair par-dessus — même badge clé et même teal #085041 que
// login.tsx, pour rester cohérent avec l'écran juste avant celui-ci dans
// le flux.
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
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView contentContainerClassName="px-5 pt-6 pb-10 grow justify-center" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-[22px] px-6 py-7 items-center border border-gray-200 shadow-xs">
              <View className="w-14 h-14 rounded-full bg-white border-2 border-[#085041] items-center justify-center">
                <Image
                  source={require('@/assets/images/logo-cle.png')}
                  style={{ width: 16, height: 32 }}
                  contentFit="contain"
                  alt="Facilité"
                />
              </View>
              <Text className="text-[20px] font-black text-[#0F172A] mt-3.5">Inscription</Text>
              <Text className="text-[13px] text-black/50 font-medium mt-1.5 text-center">
                Créez votre compte pour commencer.
              </Text>

              <View className="w-full mt-5 gap-2.5">
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-black/60 mb-1.5">Nom</Text>
                    <TextInput
                      value={nom}
                      onChangeText={setNom}
                      placeholder="Diop"
                      placeholderTextColor="rgba(0,0,0,0.35)"
                      className="bg-white border border-black/15 rounded-xl px-3.5 py-3 text-[13.5px] text-[#1A1A1A]"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-black/60 mb-1.5">Prénom</Text>
                    <TextInput
                      value={prenom}
                      onChangeText={setPrenom}
                      placeholder="Aïssatou"
                      placeholderTextColor="rgba(0,0,0,0.35)"
                      className="bg-white border border-black/15 rounded-xl px-3.5 py-3 text-[13.5px] text-[#1A1A1A]"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-[11px] font-bold text-black/60 mb-1.5">Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    placeholder="vous@exemple.com"
                    placeholderTextColor="rgba(0,0,0,0.35)"
                    className="bg-white border border-black/15 rounded-xl px-3.5 py-3 text-[13.5px] text-[#1A1A1A]"
                  />
                </View>

                <View>
                  <Text className="text-[11px] font-bold text-black/60 mb-1.5">Mot de passe</Text>
                  <View className="flex-row items-center bg-white border border-black/15 rounded-xl px-3.5">
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholder="Au moins 6 caractères"
                      placeholderTextColor="rgba(0,0,0,0.35)"
                      className="flex-1 py-3 text-[13.5px] text-[#1A1A1A]"
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color="rgba(0,0,0,0.4)" />
                    </Pressable>
                  </View>
                </View>

                <View>
                  <Text className="text-[11px] font-bold text-black/60 mb-1.5">Confirmer le mot de passe</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder="Confirmez votre mot de passe"
                    placeholderTextColor="rgba(0,0,0,0.35)"
                    className="bg-white border border-black/15 rounded-xl px-3.5 py-3 text-[13.5px] text-[#1A1A1A]"
                  />
                </View>

                {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                <Pressable
                  onPress={creerCompte}
                  disabled={loading || !nom.trim() || !prenom.trim() || !email.trim() || !password}
                  className="w-full bg-[#085041] rounded-full py-3.5 items-center"
                  style={{ opacity: loading || !nom.trim() || !prenom.trim() || !email.trim() || !password ? 0.6 : 1 }}>
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white text-[14px] font-bold">Créer le compte</Text>
                  )}
                </Pressable>

                <Text className="text-center text-[11.5px] font-semibold text-black/40 my-1 uppercase tracking-wider">
                  OU
                </Text>

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
              </View>

              <View className="w-full border-t border-black/[0.08] mt-5 pt-3.5 flex-row justify-center gap-1.5">
                <Text className="text-[13px] text-[#1A1A1A]">Déjà un compte ?</Text>
                <Link href="/login" className="text-[13px] font-bold text-blue-600">
                  Se connecter
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
