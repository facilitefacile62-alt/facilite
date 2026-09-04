import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

// Port de src/app/verifiez-votre-email/page.js (web, ajouté le 2026-09-04) :
// même raison d'être — la connexion exige un e-mail confirmé, renvoyer vers
// l'écran de connexion juste après l'inscription ferait buter sur un refus
// sans explication.
export default function VerifiezVotreEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === 'string' ? emailParam : '';

  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const renvoyer = async () => {
    if (!email) return;
    setIsResending(true);
    setResendMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.toLowerCase() });
      setResendMessage(error ? error.message || "Impossible de renvoyer l'email." : 'Un nouvel email a été envoyé.');
    } catch {
      setResendMessage('Erreur lors du renvoi.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View className="flex-1 bg-[#0B0F17]">
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerClassName="px-6 pt-6 pb-10 grow justify-center" showsVerticalScrollIndicator={false}>
          <View className="bg-[#161E2E] border border-[#232D40] rounded-2xl p-6 items-center">
            <View className="w-16 h-16 rounded-full bg-emerald-500/15 items-center justify-center mb-5">
              <Ionicons name="mail-open-outline" size={26} color="#34d399" />
            </View>

            <Text className="text-lg font-extrabold text-white text-center mb-2">
              Vérifiez votre boîte de réception
            </Text>
            <Text className="text-[12.5px] text-gray-400 text-center mb-1">
              Nous avons envoyé un lien de confirmation à
            </Text>
            {email ? <Text className="text-[13px] font-bold text-white text-center mb-4">{email}</Text> : null}

            <Text className="text-[11.5px] text-gray-500 text-center leading-relaxed mb-6">
              Ouvrez cet e-mail et appuyez sur le lien qu&apos;il contient pour activer votre compte. Sans
              cette étape, la connexion restera refusée — pensez à vérifier vos courriers indésirables si
              rien n&apos;arrive.
            </Text>

            <Pressable
              onPress={renvoyer}
              disabled={isResending || !email}
              className="w-full border border-[#232D40] rounded-xl py-3 items-center mb-3">
              <Text className="text-[12.5px] font-bold text-gray-300">
                {isResending ? 'Envoi en cours…' : "Renvoyer l'email de confirmation"}
              </Text>
            </Pressable>

            {resendMessage ? (
              <Text className="text-[11.5px] font-semibold text-gray-400 text-center mb-3">{resendMessage}</Text>
            ) : null}

            <Link
              href="/login"
              className="w-full text-center bg-blue-600 rounded-xl py-3.5 mt-1 text-[13.5px] font-bold text-white">
              J&apos;ai confirmé mon adresse — Me connecter
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
