import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BoutonContinuer } from '@/components/CasesCode';
import { BoiteErreur, BoutonGoogle, ChampCreme, Etiquette, SeparateurOu } from '@/components/ChampsAuth';
import EcranConnexion from '@/components/EcranConnexion';
import SaisieCodeSms from '@/components/SaisieCodeSms';
import {
  DELAI_RENVOI_S,
  INDICATIF,
  LONGUEUR_CODE,
  chiffresDuNumero,
  envoyerCodeSms,
  formaterNumero,
  numeroValide,
  verifierCodeSms,
} from '@/lib/connexionSms';
import { useFonctionnalite } from '@/lib/featureFlags';
import { LIBELLE_UTILISER_EMAIL, MESSAGE_CODE_TARDE, libelleRenvoi } from '@/lib/messagesCode';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

// Écran 17 — inscription. Port de src/app/register/page.js : Nom/Prénom
// concaténés en un seul full_name (le déclencheur handle_new_user l'attend),
// puis /verifiez-votre-email. Aucun détour par /api/auth/register : cette route
// n'existe que pour le challenge Vercel BotID, qu'une app native n'exécute pas.
// Onglet Téléphone : signInWithOtp en création, puis verifyOtp.
//
// Mise à jour du 12/10/2026 : même gabarit que 03 (bandeau vert + logo clé,
// champs #EEECE7, boutons pilule, liens légaux), bouton retour → écran 15,
// plus d'en-tête du site ni de carte blanche. Libellés conservés.

type Methode = 'telephone' | 'email';

export default function RegisterScreen() {
  const router = useRouter();
  const [methodeChoisie, setMethode] = useState<Methode>('email');
  // Interrupteur feat_connexion_telephone (fermé par défaut) : fermé, l'inscription se fait par Google ou par e-mail seulement.
  const telephoneOuvert = useFonctionnalite('feat_connexion_telephone');
  const methode: Methode = telephoneOuvert ? methodeChoisie : 'email';
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [chiffres, setChiffres] = useState('');
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [code, setCode] = useState('');
  const [attente, setAttente] = useState(0);
  // Heure d'envoi du dernier code (« pas bon » ou « expiré ») et verrou contre les doubles envois.
  const [envoyeLe, setEnvoyeLe] = useState<number | null>(null);
  const verrouEnvoi = useRef(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const nomComplet = `${prenom.trim()} ${nom.trim()}`.trim();

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const creerCompteEmail = async () => {
    setErrorMessage('');
    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (!nomComplet || !email.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: nomComplet } },
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

  const envoyerCode = async () => {
    if (!nomComplet || !numeroValide(chiffres) || loading || verrouEnvoi.current) return;
    verrouEnvoi.current = true;
    setLoading(true);
    setErrorMessage('');
    const probleme = await envoyerCodeSms(chiffres, { nomComplet });
    verrouEnvoi.current = false;
    setLoading(false);
    if (probleme) {
      setErrorMessage(probleme);
      return;
    }
    setCode('');
    setEnvoyeLe(Date.now());
    setAttente(DELAI_RENVOI_S);
    setCodeEnvoye(true);
  };

  const validerCode = async () => {
    if (code.length !== LONGUEUR_CODE || loading) return;
    setLoading(true);
    setErrorMessage('');
    const probleme = await verifierCodeSms(chiffres, code, envoyeLe);
    setLoading(false);
    if (probleme) setErrorMessage(probleme);
    // Succès : la session déclenche la redirection du garde d'authentification.
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

  const formulaireEmailPret = Boolean(nom.trim() && prenom.trim() && email.trim() && password && confirmPassword);
  const formulaireTelPret = Boolean(nom.trim() && prenom.trim() && numeroValide(chiffres));

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/connexion-email'));

  return (
    <EcranConnexion retour={retour}>
      <Text className="text-[26px] font-black text-[#111] mt-1">Sign Up</Text>
      <Text className="text-[15px] mt-1.5 mb-4" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        Create your account to get started.
      </Text>

      {codeEnvoye ? (
        <View className="gap-3.5">
          <Pressable
            onPress={() => {
              setCodeEnvoye(false);
              setCode('');
              setErrorMessage('');
            }}
            hitSlop={8}>
            <Text className="text-[14px] font-extrabold" style={{ color: '#0B3D2A' }}>
              ‹ Modifier le numéro
            </Text>
          </Pressable>
          <View>
            <Text className="text-[20px] font-black text-[#111]">Saisis le code à {LONGUEUR_CODE} chiffres</Text>
            <Text className="text-[14px] mt-1" style={{ color: 'rgba(0,0,0,0.55)' }}>
              Ton code a été envoyé au numéro {INDICATIF} {formaterNumero(chiffres)}.
            </Text>
          </View>
          <SaisieCodeSms
            code={code}
            onChange={(v) => {
              setCode(v);
              if (errorMessage) setErrorMessage('');
            }}
          />
          {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}
          <BoutonContinuer libelle="Valider" onPress={validerCode} actif={code.length === LONGUEUR_CODE} chargement={loading} />
          <Text className="text-[15px] font-bold" style={{ color: 'rgba(0,0,0,0.7)', lineHeight: 21 }}>{MESSAGE_CODE_TARDE}</Text>
          <Pressable
            onPress={async () => {
              if (attente > 0 || loading || verrouEnvoi.current) return;
              verrouEnvoi.current = true;
              setLoading(true);
              const p = await envoyerCodeSms(chiffres, { nomComplet });
              verrouEnvoi.current = false;
              setLoading(false);
              if (p) setErrorMessage(p);
              else {
                setCode('');
                setEnvoyeLe(Date.now());
                setAttente(DELAI_RENVOI_S);
              }
            }}
            disabled={attente > 0 || loading}
            accessibilityRole="button"
            className="items-center justify-center bg-white"
            style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: attente > 0 ? 'rgba(0,0,0,0.15)' : '#10B981', opacity: attente > 0 || loading ? 0.6 : 1, paddingHorizontal: 14 }}>
            <Text className="text-[17px] font-black text-center" style={{ color: attente > 0 ? 'rgba(0,0,0,0.5)' : '#047857' }}>{libelleRenvoi(attente)}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMethode('email');
              setCodeEnvoye(false);
              setCode('');
              setErrorMessage('');
            }}
            accessibilityRole="button"
            className="items-center justify-center bg-white"
            style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14 }}>
            <Text className="text-[17px] font-black text-center text-[#111]">{LIBELLE_UTILISER_EMAIL}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Etiquette texte="Nom" />
              <ChampCreme value={nom} onChangeText={setNom} placeholder="Votre nom" autoCapitalize="words" />
            </View>
            <View className="flex-1">
              <Etiquette texte="Prénom" />
              <ChampCreme value={prenom} onChangeText={setPrenom} placeholder="Votre prénom" autoCapitalize="words" />
            </View>
          </View>

          {/* Sélecteur segmenté Téléphone | E-mail (E-mail par défaut) */}
          {telephoneOuvert ? (
          <View className="flex-row rounded-[14px] p-1 mt-4" style={{ backgroundColor: '#EEECE7' }}>
            {(
              [
                { id: 'telephone' as const, libelle: 'Téléphone' },
                { id: 'email' as const, libelle: 'E-mail' },
              ]
            ).map((o) => {
              const actif = methode === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setMethode(o.id);
                    setErrorMessage('');
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  className="flex-1 items-center justify-center rounded-[11px]"
                  style={{ height: 44, backgroundColor: actif ? '#fff' : 'transparent' }}>
                  <Text className="text-[15px] font-extrabold" style={{ color: actif ? '#111' : 'rgba(0,0,0,0.55)' }}>
                    {o.libelle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          ) : null}

          {methode === 'email' ? (
            <>
              <View className="mt-4">
                <Etiquette texte="Email" />
                <ChampCreme
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="Enter your Email"
                />
              </View>
              <View className="mt-4">
                <Etiquette texte="Password" />
                <ChampCreme value={password} onChangeText={setPassword} masque autoCapitalize="none" placeholder="Create a password" />
              </View>
              <View className="mt-4">
                <Etiquette texte="Confirm Password" />
                <ChampCreme
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  masque
                  autoCapitalize="none"
                  placeholder="Confirm your password"
                />
              </View>
            </>
          ) : (
            <View className="mt-4">
              <Etiquette texte="Numéro de téléphone" />
              <View className="flex-row items-center" style={{ height: 52, borderRadius: 12, backgroundColor: '#EEECE7', paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 18 }}>🇸🇳</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#111', marginLeft: 8 }}>{INDICATIF}</Text>
                <View style={{ width: 1, height: 26, backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 12 }} />
                <TextInput
                  value={formaterNumero(chiffres)}
                  onChangeText={(t) => {
                    setChiffres(chiffresDuNumero(t));
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="77 000 00 00"
                  placeholderTextColor="rgba(0,0,0,0.45)"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  accessibilityLabel="Numéro de téléphone"
                  style={{ flex: 1, fontSize: 16, color: '#111', outlineStyle: 'none' } as object}
                />
              </View>
            </View>
          )}

          {errorMessage ? <BoiteErreur texte={errorMessage} /> : null}

          <View className="mt-5">
            <BoutonContinuer
              libelle="Create Account"
              onPress={methode === 'email' ? creerCompteEmail : envoyerCode}
              actif={methode === 'email' ? formulaireEmailPret : formulaireTelPret}
              chargement={loading}
            />
          </View>

          <SeparateurOu texte="OR" />
          <View className="mt-4">
            <BoutonGoogle libelle="Continue with Google" onPress={continuerAvecGoogle} chargement={googleLoading} />
          </View>
        </>
      )}

      <View className="flex-row justify-center items-center gap-1.5 mt-5 flex-wrap">
        <Text className="text-[15px] text-[#111]">Already have an account?</Text>
        <Link href="/connexion-email" className="text-[15px] font-bold" style={{ color: '#2563EB' }}>
          Log In
        </Link>
      </View>
    </EcranConnexion>
  );
}
