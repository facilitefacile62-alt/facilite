import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BoutonContinuer, CasesCode } from '@/components/CasesCode';
import EcranConnexion, { CHAMP } from '@/components/EcranConnexion';
import { useAuth } from '@/context/AuthContext';
import {
  DELAI_RENVOI_S,
  emailValide,
  envoyerCodeConfirmation,
  LONGUEUR_CODE,
  verifierCodeConfirmation,
} from '@/lib/confirmationCompte';
import { marquerEtapeEmailVue } from '@/lib/preferencesConnexion';

// Étape FACULTATIVE après « Crée un mot de passe » (demande du 23/10/2026) : ajouter et confirmer son adresse e-mail, pour
// pouvoir postuler et retrouver son compte. « Passer cette étape » mène directement à la suite. Une personne dont l'adresse est
// déjà confirmée (inscrite par e-mail ou Google) ne voit pas cette page.
export default function EmailFacultatifScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [etape, setEtape] = useState<'saisie' | 'code'>('saisie');
  const [code, setCode] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(0);

  const dejaConfirme = Boolean(user?.email_confirmed_at);

  // L'étape est notée dès qu'on la quitte : en revenant plus tard, elle n'est plus reproposée.
  const suite = async () => {
    if (user?.id) await marquerEtapeEmailVue(user.id);
    router.replace('/onboarding/bienvenue' as Href);
  };

  useEffect(() => {
    if (dejaConfirme) suite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dejaConfirme]);

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  async function envoyer() {
    if (!emailValide(email) || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await envoyerCodeConfirmation(email);
    setChargement(false);
    if (probleme) {
      setErreur(probleme.message);
      return;
    }
    setCode('');
    setAttente(DELAI_RENVOI_S);
    setEtape('code');
  }

  async function verifier(valeur: string) {
    if (chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await verifierCodeConfirmation(email, valeur);
    setChargement(false);
    if (probleme) {
      setErreur(probleme.message);
      setCode('');
      return;
    }
    await suite();
  }

  function changerCode(valeur: string) {
    setCode(valeur);
    if (erreur) setErreur('');
    if (valeur.length === LONGUEUR_CODE) verifier(valeur);
  }

  async function renvoyer() {
    if (attente > 0 || chargement) return;
    setChargement(true);
    setErreur('');
    const probleme = await envoyerCodeConfirmation(email);
    setChargement(false);
    if (probleme) setErreur(probleme.message);
    else {
      setCode('');
      setAttente(DELAI_RENVOI_S);
    }
  }

  if (dejaConfirme) return null;

  if (etape === 'code') {
    return (
      <EcranConnexion
        retour={() => {
          setEtape('saisie');
          setCode('');
          setErreur('');
        }}>
        <Text className="text-[26px] font-black text-[#111] mt-1">Saisis le code reçu</Text>
        <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
          Nous avons envoyé un code à 6 chiffres à {email.trim()}. Pense à regarder dans les courriers indésirables.
        </Text>

        <CasesCode code={code} onChange={changerCode} longueur={LONGUEUR_CODE} />

        {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text> : null}

        <Pressable onPress={renvoyer} disabled={attente > 0 || chargement} hitSlop={6} className="mt-5 self-start">
          <Text className="text-[15px]" style={{ color: attente > 0 ? 'rgba(0,0,0,0.4)' : '#10B981', fontWeight: attente > 0 ? '500' : '800' }}>
            {attente > 0 ? `Renvoyer un code ${attente}s` : 'Renvoyer un code'}
          </Text>
        </Pressable>

        <Pressable onPress={() => suite()} hitSlop={8} className="mt-5 self-center">
          <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Passer cette étape</Text>
        </Pressable>
      </EcranConnexion>
    );
  }

  return (
    <EcranConnexion>
      <Text className="text-[26px] font-black text-[#111] mt-1">Lie ton adresse e-mail</Text>
      <Text className="text-[15px] mt-1.5 mb-5" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 21 }}>
        Facultatif. Elle te permettra de postuler aux offres et de retrouver ton compte. Nous t’enverrons un code pour la confirmer.
      </Text>

      <Text className="text-[15px] font-black text-[#111] mb-2">Adresse e-mail</Text>
      <View className="flex-row items-center" style={{ height: 52, borderRadius: 12, backgroundColor: CHAMP, paddingHorizontal: 14 }}>
        <TextInput
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (erreur) setErreur('');
          }}
          placeholder="exemple@email.com"
          placeholderTextColor="rgba(0,0,0,0.45)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="Adresse e-mail"
          onSubmitEditing={envoyer}
          style={[{ flex: 1, fontSize: 16, color: '#111' }, { outlineStyle: 'none' } as object]}
        />
        {email ? (
          <Pressable onPress={() => setEmail('')} accessibilityLabel="Effacer" hitSlop={8}>
            <Ionicons name="close-circle" size={22} color="rgba(0,0,0,0.4)" />
          </Pressable>
        ) : null}
      </View>

      {erreur ? <Text className="text-[13px] font-bold mt-3" style={{ color: '#DC2626' }}>{erreur}</Text> : null}

      <View className="mt-5">
        <BoutonContinuer onPress={envoyer} actif={emailValide(email)} chargement={chargement} libelle="Envoyer le code" />
      </View>
      <Pressable onPress={() => suite()} hitSlop={8} className="mt-5 self-center">
        <Text className="text-[15px] font-black" style={{ color: '#2563EB' }}>Passer cette étape</Text>
      </Pressable>
    </EcranConnexion>
  );
}
