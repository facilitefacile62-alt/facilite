import * as Linking from 'expo-linking';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import { BoiteErreur, ChampCreme, Etiquette, LienTexte } from '@/components/ChampsAuth';
import EcranConnexion from '@/components/EcranConnexion';
import {
  lienExploitable,
  lireLienRecuperation,
  messageErreurMiseAJour,
  verifierNouveauMotDePasse,
  type LienRecuperation,
} from '@/lib/recuperationMotDePasse';
import { supabase } from '@/lib/supabase';

// Suite de « Mot de passe oublié » : l'e-mail de réinitialisation ouvre l'app sur cet écran. Il ouvre la session de
// récupération portée par le lien (jetons ou code), demande le nouveau mot de passe deux fois, l'enregistre, ferme TOUTES
// les sessions (comme le site) puis renvoie vers la connexion.
//
// Hors du groupe (auth) : AuthGate renvoie vers l'accueil toute personne connectée qui s'y trouve, y compris une session de
// récupération. AuthGate laisse aussi cet écran accessible sans session (voir src/app/_layout.tsx).

type Etat = 'verification' | 'formulaire' | 'lien_invalide' | 'lien_expire' | 'succes';

async function ouvrirSession(lien: LienRecuperation): Promise<boolean> {
  try {
    if (lien.accessToken && lien.refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: lien.accessToken, refresh_token: lien.refreshToken });
      return !error;
    }
    if (lien.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(lien.code);
      return !error;
    }
  } catch {
    // retombe sur « lien invalide »
  }
  return false;
}

export default function NouveauMotDePasseScreen() {
  const router = useRouter();
  const urlOuverte = Linking.useURL();
  const [etat, setEtat] = useState<Etat>('verification');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const dejaTraite = useRef(false);

  // Le lien est lu une seule fois : une session de récupération ne s'ouvre qu'une fois par lien.
  useEffect(() => {
    if (dejaTraite.current) return;
    const url = urlOuverte ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null);
    if (!url) return;
    dejaTraite.current = true;
    const lien = lireLienRecuperation(url);
    if (lien.erreur) {
      queueMicrotask(() => setEtat(lien.erreur === 'expire' ? 'lien_expire' : 'lien_invalide'));
      return;
    }
    if (!lienExploitable(lien)) {
      queueMicrotask(() => setEtat('lien_invalide'));
      return;
    }
    ouvrirSession(lien).then((ok) => setEtat(ok ? 'formulaire' : 'lien_expire'));
  }, [urlOuverte]);

  // Ouvert sans aucun lien (écran appelé à la main) : on ne reste pas à tourner indéfiniment.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!dejaTraite.current) {
        dejaTraite.current = true;
        setEtat('lien_invalide');
      }
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const versConnexion = () => router.replace('/connexion-email' as Href);
  const nouveauLien = () => router.replace('/forgot-password' as Href);

  async function enregistrer() {
    const probleme = verifierNouveauMotDePasse(motDePasse, confirmation);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur('');
    setChargement(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) {
        setErreur(messageErreurMiseAJour(error.message));
        return;
      }
      // Toutes les sessions sont fermées (comme sur le site) : la personne se reconnecte avec le nouveau mot de passe.
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
      setEtat('succes');
    } catch {
      setErreur("Impossible d'enregistrer le mot de passe. Réessayez.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <EcranConnexion>
      {etat === 'verification' ? (
        <View className="items-center mt-10 gap-3">
          <ActivityIndicator color="#10B981" />
          <Text className="text-[14px]" style={{ color: 'rgba(0,0,0,0.55)' }}>Vérification du lien…</Text>
        </View>
      ) : null}

      {etat === 'lien_invalide' || etat === 'lien_expire' ? (
        <>
          <Text className="text-[26px] font-black text-[#111] mt-1">
            {etat === 'lien_expire' ? 'Lien expiré' : 'Lien non valide'}
          </Text>
          <View className="w-full bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
            <Text className="text-[14px] text-red-700 leading-relaxed">
              {etat === 'lien_expire'
                ? 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.'
                : "Ce lien n'est pas valide. Ouvrez-le depuis l'e-mail reçu, ou demandez-en un nouveau."}
            </Text>
          </View>
          <View className="mt-5">
            <BoutonContinuer libelle="Demander un nouveau lien" onPress={nouveauLien} actif />
          </View>
          <View className="mt-2">
            <LienTexte texte="← Retour à la connexion" onPress={versConnexion} />
          </View>
        </>
      ) : null}

      {etat === 'formulaire' ? (
        <>
          <Text className="text-[26px] font-black text-[#111] mt-1">Nouveau mot de passe</Text>
          <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
            Choisissez un mot de passe d&apos;au moins 8 caractères.
          </Text>

          <Etiquette texte="Nouveau mot de passe" />
          <ChampCreme
            masque
            value={motDePasse}
            onChangeText={(v) => {
              setMotDePasse(v);
              if (erreur) setErreur('');
            }}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Nouveau mot de passe"
          />
          <View className="mt-3">
            <Etiquette texte="Confirmer le mot de passe" />
            <ChampCreme
              masque
              value={confirmation}
              onChangeText={(v) => {
                setConfirmation(v);
                if (erreur) setErreur('');
              }}
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Confirmer le mot de passe"
            />
          </View>

          {erreur ? <BoiteErreur texte={erreur} /> : null}

          <View className="mt-5">
            <BoutonContinuer libelle="Enregistrer" onPress={enregistrer} actif={Boolean(motDePasse && confirmation)} chargement={chargement} />
          </View>
        </>
      ) : null}

      {etat === 'succes' ? (
        <>
          <Text className="text-[26px] font-black text-[#111] mt-1">Mot de passe modifié</Text>
          <View className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
            <Text className="text-[14px] text-emerald-800 leading-relaxed">
              Votre mot de passe a été mis à jour. Vous avez été déconnecté partout : connectez-vous avec le nouveau.
            </Text>
          </View>
          <View className="mt-5">
            <BoutonContinuer libelle="Se connecter" onPress={versConnexion} actif />
          </View>
        </>
      ) : null}
    </EcranConnexion>
  );
}
