import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BoutonAction from '@/components/BoutonAction';
import EnteteAuth from '@/components/EnteteAuth';
import { supabase } from '@/lib/supabase';

// Mot de passe oublié — maquette 57. Port partiel de
// src/app/forgot-password/page.js : envoie le lien de réinitialisation. Ce
// point ne couvre PAS la suite du parcours (ouverture du lien reçu par
// e-mail -> saisie du nouveau mot de passe) : sur le web, cette étape reste
// sur /login et écoute l'événement PASSWORD_RECOVERY, ce qui entrerait en
// conflit avec AuthGate (src/app/_layout.tsx), qui renvoie vers les tabs
// dès qu'une session existe — y compris une session de récupération. À
// traiter dans un point dédié plutôt que de risquer de bloquer quelqu'un en
// pleine réinitialisation.
//
// Habillage de la maquette : en-tête #e3dbcc avec le bouton vert
// « Connexion », clé dans son halo, champ à bordure vert foncé 1,5 px et
// coins 14 px, bouton « Envoyer le lien » de la charte §2.1.
const VERT = '#10B981';
const VERT_FONCE = '#0B3D2A';

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

              {isSuccess ? (
                <>
                  <Text className="text-[22px] font-black text-[#1A1A1A] mt-3.5">E-mail envoyé</Text>
                  <View className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
                    <Text className="text-[12.5px] text-emerald-800 text-center leading-relaxed">
                      Si un compte existe pour <Text className="font-bold">{email}</Text>, vous recevrez un
                      lien d&apos;ici quelques instants.
                    </Text>
                  </View>
                  <Link href="/login" className="mt-5 text-[14px] font-bold" style={{ color: VERT }}>
                    ← Retour à la connexion
                  </Link>
                </>
              ) : (
                <>
                  <Text className="text-[22px] font-black text-[#1A1A1A] mt-3.5 text-center">
                    Réinitialiser le mot de passe
                  </Text>
                  <Text className="text-[13px] mt-1.5 text-center" style={{ color: 'rgba(0,0,0,0.5)' }}>
                    Entrez votre e-mail pour recevoir un lien de réinitialisation.
                  </Text>

                  <View className="w-full mt-5 gap-3">
                    <View>
                      <Text className="text-[13px] font-extrabold text-[#1A1A1A] mb-1.5">Adresse e-mail</Text>
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
                        style={{
                          height: 56,
                          borderWidth: 1.5,
                          borderColor: VERT_FONCE,
                          borderRadius: 14,
                          backgroundColor: '#fff',
                          paddingHorizontal: 14,
                          fontSize: 14,
                          color: '#1A1A1A',
                        }}
                      />
                    </View>

                    {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

                    <BoutonAction
                      titre="Envoyer le lien"
                      sousTitre="Réinitialisation par e-mail"
                      icone="mail-outline"
                      onPress={envoyerLien}
                      desactive={!email.trim()}
                      chargement={loading}
                    />

                    <Link href="/login" className="self-center text-[13.5px] font-bold" style={{ color: VERT }}>
                      ← Retour à la connexion
                    </Link>
                  </View>
                </>
              )}
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
