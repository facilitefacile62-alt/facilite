import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { BoutonContinuer, CaseRonde, CasesCode } from '@/components/CasesCode';
import EcranConnexion, { CHAMP } from '@/components/EcranConnexion';
import { IconGoogle } from '@/components/facilite-icons';
import {
  DELAI_RENVOI_EMAIL_S,
  LONGUEUR_CODE_EMAIL,
  emailValide,
  envoyerCodeEmail,
  verifierCodeEmail,
} from '@/lib/connexionEmail';
import { useFonctionnalite } from '@/lib/featureFlags';
import { LIBELLE_UTILISER_EMAIL, MESSAGE_CODE_TARDE, libelleRenvoi } from '@/lib/messagesCode';
import {
  INDICATIF,
  LONGUEUR_CODE,
  chiffresDuNumero,
  envoyerCodeSmsConnexion,
  formaterNumero,
  numeroValide,
  verifierCodeSms,
} from '@/lib/connexionSms';
import { seConnecterParMotDePasse } from '@/lib/motDePasse';
import { seConnecterAvecGoogle } from '@/lib/oauth';
import { memoriserGarderSession } from '@/lib/preferencesConnexion';

// Connexion — écrans 03 à 06 (téléphone) et 09 à 12 (e-mail) de la
// spécification du 12/10/2026. Les deux parcours ont exactement le même
// design : seul le champ et le texte de la page « code » changent.
//
// Compte déjà connu : la session posée par la validation du code mène
// directement à l'Accueil (garde d'authentification du layout racine). Compte
// nouveau : le même garde ouvre la page « Nom et prénom » (nom-prenom.tsx),
// une seule fois, puis l'onboarding.
//
// Le clavier ne s'ouvre jamais seul : aucun autoFocus. Le bouton « Continuer »
// reste à sa place (voir EcranConnexion).
type Onglet = 'telephone' | 'email';
type Etape = 'saisie' | 'code';

export default function LoginScreen() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<Onglet>('telephone');
  const [etape, setEtape] = useState<Etape>('saisie');
  const [chiffres, setChiffres] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [garder, setGarder] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [googleEnCours, setGoogleEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(0);
  // Heure d'envoi du dernier code (pour dire « pas bon » ou « expiré ») et verrou contre les doubles envois.
  const [envoyeLe, setEnvoyeLe] = useState<number | null>(null);
  const verrouEnvoi = useRef(false);
  // Secours « mot de passe » (facultatif) quand le code n'arrive pas : fenêtre ouverte depuis la page du code.
  const [fenetreMdp, setFenetreMdp] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [erreurMdp, setErreurMdp] = useState('');
  const [mdpEnCours, setMdpEnCours] = useState(false);

  // Compte à rebours avant de pouvoir redemander un code.
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  // Interrupteur feat_connexion_telephone (fermé par défaut) : fermé, jamais d'onglet Téléphone, et l'e-mail est la seule saisie.
  const telephoneOuvert = useFonctionnalite('feat_connexion_telephone');
  const parTelephone = telephoneOuvert && onglet === 'telephone';
  const saisieValide = parTelephone ? numeroValide(chiffres) : emailValide(email);

  async function envoyer() {
    if (!saisieValide || chargement || verrouEnvoi.current) return;
    verrouEnvoi.current = true;
    setChargement(true);
    setErreur('');
    const probleme = parTelephone ? await envoyerCodeSmsConnexion(chiffres) : await envoyerCodeEmail(email);
    verrouEnvoi.current = false;
    setChargement(false);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setCode('');
    setEnvoyeLe(Date.now());
    setAttente(DELAI_RENVOI_EMAIL_S);
    setEtape('code');
  }

  async function verifier(valeur: string) {
    if (chargement) return;
    setChargement(true);
    setErreur('');
    await memoriserGarderSession(garder);
    const probleme = parTelephone ? await verifierCodeSms(chiffres, valeur, envoyeLe) : await verifierCodeEmail(email, valeur, envoyeLe);
    setChargement(false);
    if (probleme) {
      setErreur(probleme);
      setCode('');
    }
    // Succès : la session déclenche la suite (Accueil, ou « Nom et prénom » pour un nouveau compte).
  }

  async function connexionMotDePasse() {
    if (!motDePasse || mdpEnCours) return;
    setMdpEnCours(true);
    setErreurMdp('');
    await memoriserGarderSession(garder);
    const probleme = await seConnecterParMotDePasse(parTelephone ? { telephone: chiffres } : { email }, motDePasse);
    setMdpEnCours(false);
    if (probleme) {
      setErreurMdp(probleme);
      return;
    }
    // Succès : la session déclenche la suite, comme pour le code.
    setFenetreMdp(false);
    setMotDePasse('');
  }

  function changerCode(valeur: string) {
    setCode(valeur);
    if (erreur) setErreur('');
    // Vérification automatique dès que les six chiffres sont saisis.
    if (valeur.length === (parTelephone ? LONGUEUR_CODE : LONGUEUR_CODE_EMAIL)) verifier(valeur);
  }

  async function renvoyer() {
    if (attente > 0 || chargement || verrouEnvoi.current) return;
    verrouEnvoi.current = true;
    setChargement(true);
    setErreur('');
    const probleme = parTelephone ? await envoyerCodeSmsConnexion(chiffres) : await envoyerCodeEmail(email);
    verrouEnvoi.current = false;
    setChargement(false);
    if (probleme) setErreur(probleme);
    else {
      setCode('');
      setEnvoyeLe(Date.now());
      setAttente(DELAI_RENVOI_EMAIL_S);
    }
  }

  // « Utiliser mon e-mail à la place » : retour à la saisie, sur l'onglet e-mail, sans renvoyer de SMS.
  function utiliserEmail() {
    setOnglet('email');
    setEtape('saisie');
    setCode('');
    setErreur('');
  }

  async function google() {
    setGoogleEnCours(true);
    setErreur('');
    try {
      await memoriserGarderSession(garder);
      await seConnecterAvecGoogle();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la connexion Google.');
    } finally {
      setGoogleEnCours(false);
    }
  }

  // ------------------------------------------------------------ page « code »
  if (etape === 'code') {
    const cible = parTelephone ? `${INDICATIF} ${formaterNumero(chiffres)}` : email.trim();
    return (
      <EcranConnexion
        retour={() => {
          setEtape('saisie');
          setCode('');
          setErreur('');
        }}>
        <Text className="text-[26px] font-black text-[#111] mt-1">
          {parTelephone ? 'Saisis le code à 6 chiffres' : "Vérifier l'adresse e-mail"}
        </Text>
        <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
          {parTelephone ? `Ton code a été envoyé au numéro ${cible}` : `Utilise le lien ou saisis le code envoyé à ${cible}`}
        </Text>

        <Pressable onPress={() => { setErreurMdp(''); setFenetreMdp(true); }} accessibilityRole="button" hitSlop={6} className="mb-4 self-start flex-row items-center gap-2">
          <Ionicons name="key-outline" size={18} color="#2563EB" />
          <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Ou utiliser mon mot de passe</Text>
        </Pressable>

        <CasesCode code={code} onChange={changerCode} longueur={parTelephone ? LONGUEUR_CODE : LONGUEUR_CODE_EMAIL} />

        {erreur ? (
          <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text>
        ) : null}

        <Text className="text-[15px] font-bold mt-5" style={{ color: 'rgba(0,0,0,0.7)', lineHeight: 21 }}>{MESSAGE_CODE_TARDE}</Text>

        <Pressable
          onPress={renvoyer}
          disabled={attente > 0 || chargement}
          accessibilityRole="button"
          className="mt-4 items-center justify-center bg-white"
          style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: attente > 0 ? 'rgba(0,0,0,0.15)' : '#10B981', opacity: attente > 0 || chargement ? 0.6 : 1, paddingHorizontal: 14 }}>
          <Text className="text-[17px] font-black text-center" style={{ color: attente > 0 ? 'rgba(0,0,0,0.5)' : '#047857' }}>{libelleRenvoi(attente)}</Text>
        </Pressable>

        {parTelephone ? (
          <Pressable
            onPress={utiliserEmail}
            accessibilityRole="button"
            className="mt-3 items-center justify-center bg-white"
            style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14 }}>
            <Text className="text-[17px] font-black text-center text-[#111]">{LIBELLE_UTILISER_EMAIL}</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/connexion-email')} hitSlop={6} className="mt-5 self-start">
          <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Besoin d&apos;aide pour te connecter ?</Text>
        </Pressable>

        <View style={{ marginTop: 'auto', paddingTop: 24 }}>
          <CaseRonde
            cochee={notifications}
            onChange={setNotifications}
            texte="Tu peux recevoir des notifications de notre part par SMS, WhatsApp et message instantané."
          />
        </View>

        <Modal visible={fenetreMdp} transparent animationType="fade" onRequestClose={() => setFenetreMdp(false)}>
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View className="w-full rounded-[22px] bg-white p-5" style={{ maxWidth: 420 }}>
              <Text className="text-[20px] font-black text-[#111]">Mon mot de passe</Text>
              <Text className="text-[14px] mt-1 mb-4" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 20 }}>
                Pour {cible}. Si tu n’as pas créé de mot de passe, utilise le code.
              </Text>
              <TextInput
                value={motDePasse}
                onChangeText={setMotDePasse}
                placeholder="Ton mot de passe"
                placeholderTextColor="rgba(0,0,0,0.45)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={connexionMotDePasse}
                style={{ height: 52, borderRadius: 12, backgroundColor: CHAMP, paddingHorizontal: 16, fontSize: 16, color: '#111', outlineStyle: 'none' } as object}
              />
              {erreurMdp ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreurMdp}</Text> : null}
              <View className="mt-4">
                <BoutonContinuer onPress={connexionMotDePasse} actif={motDePasse.length > 0} chargement={mdpEnCours} libelle="Me connecter" />
              </View>
              <Pressable onPress={() => setFenetreMdp(false)} hitSlop={8} className="mt-4 self-center">
                <Text className="text-[15px] font-black" style={{ color: 'rgba(0,0,0,0.55)' }}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </EcranConnexion>
    );
  }

  // ----------------------------------------------------------- page de saisie
  return (
    <EcranConnexion>
      <Pressable
        onPress={google}
        disabled={googleEnCours}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-3 bg-white"
        style={{ height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: '#E5E2DC', opacity: googleEnCours ? 0.6 : 1 }}>
        <IconGoogle size={20} />
        <Text className="text-[17px] font-black text-[#111]">Continuer avec Google</Text>
      </Pressable>

      <View className="flex-row items-center gap-3 mt-5">
        <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
        <Text className="text-[13px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>ou</Text>
        <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
      </View>

      {telephoneOuvert ? (
      <View className="flex-row mt-4" style={{ borderBottomWidth: 2, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
        {(['telephone', 'email'] as const).map((o) => {
          const actif = onglet === o;
          return (
            <Pressable
              key={o}
              onPress={() => {
                setOnglet(o);
                setErreur('');
              }}
              className="flex-1 items-center"
              style={{ paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: actif ? '#111' : 'transparent', marginBottom: -2 }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                className="text-[16px]"
                style={{ fontWeight: actif ? '900' : '700', color: actif ? '#111' : 'rgba(0,0,0,0.45)' }}>
                {o === 'telephone' ? 'Téléphone' : "E-mail/nom d'utilisateur"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      ) : null}

      <View
        className="flex-row items-center mt-4"
        style={{ height: 52, borderRadius: 12, backgroundColor: CHAMP, paddingHorizontal: 14 }}>
        {parTelephone ? (
          <>
            <Pressable
              onPress={() => Alert.alert('Pays', "Pour l'instant, seul le Sénégal (+221) est disponible.")}
              className="flex-row items-center gap-1.5"
              hitSlop={6}>
              <Text className="text-[16px] font-black text-[#111]">SN {INDICATIF}</Text>
              <Ionicons name="chevron-down" size={15} color="#111" />
            </Pressable>
            <View style={{ width: 1, height: 26, backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 12 }} />
            <TextInput
              value={formaterNumero(chiffres)}
              onChangeText={(t) => {
                setChiffres(chiffresDuNumero(t));
                if (erreur) setErreur('');
              }}
              placeholder="Numéro de téléphone"
              placeholderTextColor="rgba(0,0,0,0.45)"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              accessibilityLabel="Numéro de téléphone"
              style={[{ flex: 1, fontSize: 16, color: '#111' }, { outlineStyle: 'none' } as object]}
            />
          </>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (erreur) setErreur('');
              }}
              placeholder="E-mail ou nom d'utilisateur"
              placeholderTextColor="rgba(0,0,0,0.45)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Adresse e-mail"
              style={[{ flex: 1, fontSize: 16, color: '#111' }, { outlineStyle: 'none' } as object]}
            />
            {email ? (
              <Pressable onPress={() => setEmail('')} accessibilityLabel="Effacer" hitSlop={8}>
                <Ionicons name="close-circle" size={22} color="rgba(0,0,0,0.4)" />
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <View className="mt-4">
        <CaseRonde
          cochee={garder}
          onChange={setGarder}
          texte="Enregistre tes informations de connexion pour te connecter automatiquement la prochaine fois."
        />
      </View>

      {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text> : null}

      <View className="mt-4">
        <BoutonContinuer onPress={envoyer} actif={saisieValide} chargement={chargement} />
      </View>
    </EcranConnexion>
  );
}
