import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import { BoiteErreur, ChampCreme, Etiquette, LienTexte } from '@/components/ChampsAuth';
import EcranConnexion from '@/components/EcranConnexion';
import { supabase } from '@/lib/supabase';

// Écran 16 — mot de passe oublié. Envoie le lien de réinitialisation ; le lien ouvre l'écran « nouveau mot de passe »
// (src/app/nouveau-mot-de-passe.tsx), volontairement hors du groupe (auth) pour échapper à AuthGate, qui renvoie vers
// les tabs dès qu'une session existe, y compris une session de récupération.
// L'adresse de retour (facilite://nouveau-mot-de-passe, ou exp://… en développement) doit figurer dans les « Redirect URLs »
// du projet Supabase, sinon Supabase renvoie vers l'adresse du site au lieu de l'app.
// Mise à jour du 12/10/2026 : même gabarit que 03 (bandeau vert + logo clé),
// bouton retour → écran 15, plus d'en-tête du site.

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
        redirectTo: Linking.createURL('nouveau-mot-de-passe'),
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

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/connexion-email'));

  return (
    <EcranConnexion retour={retour}>
      {isSuccess ? (
        <>
          <Text className="text-[26px] font-black text-[#111] mt-1">E-mail envoyé</Text>
          <View className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
            <Text className="text-[14px] text-emerald-800 leading-relaxed">
              Si un compte existe pour <Text className="font-bold">{email}</Text>, tu recevras un lien d&apos;ici
              quelques instants.
            </Text>
          </View>
          <View className="mt-4">
            <LienTexte texte="← Retour à la connexion" onPress={() => router.replace('/connexion-email')} />
          </View>
        </>
      ) : (
        <>
          <Text className="text-[26px] font-black text-[#111] mt-1">Réinitialiser le mot de passe</Text>
          <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
            Entre ton e-mail pour recevoir un lien de réinitialisation.
          </Text>

          <Etiquette texte="Adresse e-mail" />
          <ChampCreme
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errorMessage) setErrorMessage('');
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="nom@exemple.com"
          />

          {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

          <View className="mt-5">
            <BoutonContinuer libelle="Envoyer le lien" onPress={envoyerLien} actif={Boolean(email.trim())} chargement={loading} />
          </View>
          <View className="mt-2">
            <LienTexte texte="← Retour à la connexion" onPress={retour} />
          </View>
        </>
      )}
    </EcranConnexion>
  );
}
