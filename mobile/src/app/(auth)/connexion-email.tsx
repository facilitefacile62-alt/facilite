import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import {
  BoiteErreur,
  BoutonGoogle,
  ChampCreme,
  LienTexte,
  SeparateurOu,
} from '@/components/ChampsAuth';
import EcranConnexion from '@/components/EcranConnexion';
import { messageErreurGoogle, messageRefusConnexion } from '@/lib/connexionApplicationLogique';
import { useFonctionnalite } from '@/lib/featureFlags';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Écran 15 — connexion par e-mail et mot de passe (ou Google). Atteint depuis
// « Besoin d'aide pour te connecter ? ». Mise à jour du 12/10/2026 : même
// gabarit que les écrans 03 à 14 (bandeau vert #0B3D2A + logo clé fixe, champs
// #EEECE7, bouton pilule, liens légaux en bas), plus d'en-tête du site.
// Flux inchangé, en deux étapes : e-mail seul, puis mot de passe (+ lien
// magique, + « Modifier »).

export default function ConnexionEmailScreen({ racine = false }: { racine?: boolean } = {}) {
  const router = useRouter();
  // Interrupteurs de l'application (fermés par défaut, illisible = fermé) : inscription, « mot de passe oublié », lien magique.
  const inscriptionOuverte = useFonctionnalite('feat_app_inscription');
  const motDePasseOublieOuvert = useFonctionnalite('feat_app_mot_de_passe_oublie');
  const lienMagiqueOuvert = useFonctionnalite('feat_app_connexion_sans_mot_de_passe');
  const [etape, setEtape] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // Un seul message neutre, en français : jamais « adresse inconnue » ni « adresse non confirmée », jamais de texte technique anglais.
        setErrorMessage(messageRefusConnexion(error));
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
      setErrorMessage(error ? "Impossible de renvoyer l'e-mail pour le moment. Réessayez plus tard." : 'Un nouvel e-mail a été envoyé.');
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
      if (error) setErrorMessage("Impossible d'envoyer le lien pour le moment. Réessayez plus tard.");
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
      setErrorMessage(messageErreurGoogle(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  return (
    <EcranConnexion retour={racine ? undefined : retour}>
      <Text className="text-[26px] font-black text-[#111] mt-1">Connexion</Text>
      <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        Saisis tes identifiants pour te connecter.
      </Text>

      {etape === 1 ? (
        <>
          <BoutonGoogle libelle="Continuer avec Google" onPress={continuerAvecGoogle} chargement={googleLoading} />
          <SeparateurOu texte="OU" />
          <View className="mt-4">
            <ChampCreme
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errorMessage) setErrorMessage('');
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="nom@exemple.com"
            />
          </View>
          {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}
          <View className="mt-4">
            <BoutonContinuer onPress={validerEtape1} actif={emailPropre().includes('@')} />
          </View>
          {motDePasseOublieOuvert ? (
            <View className="mt-2">
              <LienTexte texte="Mot de passe oublié ?" onPress={() => router.push('/forgot-password')} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View
            className="flex-row items-center justify-between px-4"
            style={{ height: 52, borderRadius: 12, backgroundColor: '#EEECE7' }}>
            <Text className="text-[15px] font-bold text-[#111] flex-1 mr-2" numberOfLines={1}>{email}</Text>
            <Pressable
              onPress={() => {
                setEtape(1);
                setPassword('');
                setErrorMessage('');
                setMagicLinkSent(false);
              }}
              hitSlop={8}>
              <Text className="text-[14px] font-bold" style={{ color: 'rgba(0,0,0,0.5)' }}>Modifier</Text>
            </Pressable>
          </View>

          {magicLinkSent ? (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
              <Text className="text-[13px] font-bold text-emerald-800">Lien de connexion envoyé !</Text>
              <Text className="text-[13px] text-emerald-800 mt-0.5">
                Vérifie ta boîte de réception pour te connecter en 1 clic.
              </Text>
            </View>
          ) : (
            <>
              <View className="mt-3">
                <ChampCreme
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errorMessage) setErrorMessage('');
                  }}
                  masque
                  autoCapitalize="none"
                  placeholder="Mot de passe"
                />
              </View>

              {lienMagiqueOuvert || motDePasseOublieOuvert ? (
                <View className="flex-row items-center justify-between mt-3">
                  {lienMagiqueOuvert ? (
                    <Pressable onPress={envoyerLienMagique} disabled={magicLinkLoading} hitSlop={8}>
                      <Text className="text-[14px] font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>
                        {magicLinkLoading ? 'Envoi…' : 'Lien magique'}
                      </Text>
                    </Pressable>
                  ) : <View />}
                  {motDePasseOublieOuvert ? (
                    <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
                      <Text className="text-[14px] font-bold" style={{ color: '#10B981' }}>Mot de passe oublié ?</Text>
                    </Pressable>
                  ) : <View />}
                </View>
              ) : null}

              {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

              {needsConfirmation && (
                <Pressable
                  onPress={renvoyerConfirmation}
                  disabled={isResending}
                  className="py-3 rounded-[14px] items-center mt-3"
                  style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }}>
                  <Text className="text-[13px] font-bold" style={{ color: '#0B3D2A' }}>
                    {isResending ? 'Envoi en cours…' : "Renvoyer l'email de confirmation"}
                  </Text>
                </Pressable>
              )}

              <View className="mt-4">
                <BoutonContinuer libelle="Se connecter" onPress={seConnecter} actif={Boolean(password)} chargement={loading} />
              </View>
            </>
          )}
        </>
      )}

      {inscriptionOuverte ? (
        <View className="flex-row justify-center items-center gap-1.5 mt-5 flex-wrap">
          <Text className="text-[15px] text-[#111]">Pas encore de compte ?</Text>
          <Pressable onPress={() => router.push('/register')} hitSlop={8}>
            <Text className="text-[15px] font-bold" style={{ color: '#2563EB' }}>S&apos;inscrire</Text>
          </Pressable>
        </View>
      ) : null}
    </EcranConnexion>
  );
}
