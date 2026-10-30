import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChampMotDePasse from '@/components/ChampMotDePasse';
import EnteteRubrique from '@/components/EnteteRubrique';
import SelecteurPays from '@/components/SelecteurPays';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';
import { verifierChangementMotDePasse } from '@/lib/recuperationMotDePasse';
import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';

// Sécurité & Connexion — maquette 56 : informations du compte (téléphone
// SMS, e-mail confirmé, date de naissance, région/pays) puis définition
// d'un mot de passe.
//
// Mot de passe : un compte qui en a DÉJÀ un doit saisir l'ancien (revérifié par une connexion ciblée, comme sur le site),
// puis toutes ses sessions sont fermées ; un compte sans mot de passe (Google, téléphone) en crée un sans ancien.
// « A déjà un mot de passe » est décidé par le serveur (/api/auth/has-password), jamais deviné côté appareil.
//
// Les informations viennent du compte d'authentification (user.email,
// user.phone, email_confirmed_at) et de `profiles` (date_naissance, country —
// noms vérifiés dans 20260802060000_profiles_deny_by_default.sql) : rien
// n'est affiché quand la valeur n'existe pas (« Non renseignée »), jamais
// une valeur d'exemple.
const LONGUEUR_MIN = 8;

/** "macoumba@gmail.com" -> "m***@gmail.com", comme la maquette. */
function emailMasque(email: string | undefined): string {
  if (!email) return 'Aucune adresse';
  const [local, domaine] = email.split('@');
  if (!domaine) return email;
  return `${local.slice(0, 1)}***@${domaine}`;
}

function Critere({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? '#10B981' : 'rgba(0,0,0,0.3)'} />
      <Text className="text-[11.5px]" style={{ color: ok ? '#047857' : 'rgba(0,0,0,0.45)' }}>{texte}</Text>
    </View>
  );
}

function texteOuNonRenseigne(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v : 'Non renseignée';
}

export default function ProfilSecuriteScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [actuel, setActuel] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  // Ancien mot de passe vérifié (changement seulement) : tant qu'il ne l'est pas, « nouveau » et « confirmer » restent grisés.
  const [actuelVerifie, setActuelVerifie] = useState(false);
  const [verification, setVerification] = useState(false);
  const [actuelFaux, setActuelFaux] = useState(false);
  const defilement = useRef<ScrollView>(null);

  async function verifierActuel() {
    if (!actuel || verification || actuelVerifie) return;
    setVerification(true);
    setActuelFaux(false);
    try {
      const identifiant = user?.email ? { email: user.email, password: actuel } : { phone: user?.phone ?? '', password: actuel };
      const { error } = await supabase.auth.signInWithPassword(identifiant);
      if (error) setActuelFaux(true);
      else setActuelVerifie(true);
    } finally {
      setVerification(false);
    }
  }
  // Un champ du formulaire reçoit le focus : on descend jusqu'au bas de la page, pour voir le champ ET le bouton « Changer le mot de passe »
  // au-dessus du clavier (la page est arrêtée au-dessus du clavier, voir ConteneurClavier).
  const versLeBas = () => setTimeout(() => defilement.current?.scrollToEnd({ animated: true }), 250);
  // Pays : modifiable ici (profiles.country) par un menu déroulant.
  const [editionPays, setEditionPays] = useState(false);
  const [pays, setPays] = useState('');
  const [paysEnCours, setPaysEnCours] = useState(false);

  async function enregistrerPays() {
    if (!user?.id || paysEnCours) return;
    setPaysEnCours(true);
    try {
      await enregistrerChampsProfil(user.id, { country: pays.trim() || null });
      await refreshProfile();
      setEditionPays(false);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le pays pour le moment.");
    } finally {
      setPaysEnCours(false);
    }
  }
  // null = pas encore connu (aucun formulaire affiché plutôt que de deviner) ; 'echec' = le serveur n'a pas répondu.
  const [aUnMotDePasse, setAUnMotDePasse] = useState<boolean | null | 'echec'>(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const jeton = data.session?.access_token;
        if (!jeton) throw new Error('session');
        // Délai maximal : sans réponse en 10 s, on propose « Réessayer » au lieu de laisser « Vérification en cours… » indéfiniment.
        const reponse = await fetch(`${SITE_URL}/api/auth/has-password`, { headers: { Authorization: `Bearer ${jeton}` }, signal: AbortSignal.timeout(10000) });
        const corps = await reponse.json();
        if (!annule) setAUnMotDePasse(typeof corps?.hasPassword === 'boolean' ? corps.hasPassword : 'echec');
      } catch {
        if (!annule) setAUnMotDePasse('echec');
      }
    })();
    return () => {
      annule = true;
    };
  }, [essai]);

  const assezLong = motDePasse.length >= LONGUEUR_MIN;
  // Changement : ancien + nouveau + confirmation remplis ; création : nouveau assez long.
  const peutEnregistrer = aUnMotDePasse === true ? actuelVerifie && assezLong && confirmation === motDePasse : assezLong;

  async function definirMotDePasse() {
    if (enCours) return;
    if (aUnMotDePasse === true) {
      const probleme = verifierChangementMotDePasse(actuel, motDePasse, confirmation);
      if (probleme) {
        Alert.alert('Mot de passe non modifié', probleme);
        return;
      }
    } else if (!assezLong) return;

    setEnCours(true);
    try {
      if (aUnMotDePasse === true) {
        // L'ancien mot de passe est revérifié par une connexion ciblée sur l'identifiant du compte.
        const identifiant = user?.email ? { email: user.email, password: actuel } : { phone: user?.phone ?? '', password: actuel };
        const { error: erreurAncien } = await supabase.auth.signInWithPassword(identifiant);
        if (erreurAncien) {
          Alert.alert('Mot de passe non modifié', 'Mot de passe actuel incorrect.');
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) {
        Alert.alert('Mot de passe non enregistré', error.message);
        return;
      }
      setMotDePasse('');
      setActuel('');
      setConfirmation('');
      if (aUnMotDePasse === true) {
        // Un vrai changement ferme TOUTES les sessions (y compris celle-ci) : un ancien mot de passe a pu fuiter.
        await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
        Alert.alert('Mot de passe modifié', 'Reconnectez-vous avec votre nouveau mot de passe.');
        router.replace('/login' as Href);
        return;
      }
      setAUnMotDePasse(true);
      Alert.alert('Mot de passe enregistré', 'Vous pouvez désormais vous connecter avec ce mot de passe.');
    } finally {
      setEnCours(false);
    }
  }

  const lignes = [
    {
      cle: 'telephone',
      libelle: 'Téléphone (SMS)',
      valeur: user?.phone ? user.phone : 'Aucun numéro',
      confirme: false,
    },
    {
      cle: 'email',
      libelle: 'E-mail',
      valeur: emailMasque(user?.email),
      confirme: Boolean(user?.email_confirmed_at),
    },
    {
      cle: 'naissance',
      libelle: 'Date de naissance',
      valeur: texteOuNonRenseigne(profile?.date_naissance),
      confirme: false,
    },
    {
      cle: 'pays',
      libelle: 'Région / Pays',
      valeur: texteOuNonRenseigne(profile?.country),
      confirme: false,
    },
  ];

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Sécurité & Connexion" />

        <ScrollView ref={defilement} contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-2xl p-3.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="card-outline" size={15} color="#2563EB" />
              <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">Informations du compte</Text>
            </View>

            {lignes.map((l, i) => (
              <View key={l.cle} className={`py-3.5 ${i > 0 ? 'border-t border-black/[0.06]' : 'mt-1'}`}>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[12px] font-bold text-black/70">{l.libelle}</Text>
                      {l.confirme ? (
                        <View className="bg-[#D1FAE5] rounded-full px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-[#047857]">Confirmé</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Valeurs absentes en italique gris, comme la maquette 56. */}
                    <Text
                      className="text-[13.5px] mt-1"
                      style={/^(Non renseign|Aucun num)/.test(l.valeur) ? { fontStyle: 'italic', color: 'rgba(0,0,0,0.45)' } : { fontWeight: '700', color: '#1A1A1A' }}>
                      {l.valeur}
                    </Text>
                  </View>
                  {l.cle === 'pays' ? (
                    <Pressable
                      onPress={() => {
                        setPays(typeof profile?.country === 'string' ? profile.country : '');
                        setEditionPays((v) => !v);
                      }}
                      hitSlop={10}
                      accessibilityLabel="Modifier le pays">
                      <Ionicons name={editionPays ? 'chevron-up' : 'create-outline'} size={17} color="#2563EB" />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-down" size={15} color="rgba(0,0,0,0.35)" />
                  )}
                </View>
                {l.cle === 'pays' && editionPays ? (
                  <View className="mt-2.5">
                    <SelecteurPays valeur={pays} onChange={setPays} />
                    <Pressable
                      onPress={enregistrerPays}
                      disabled={paysEnCours}
                      className="self-start rounded-full px-5 py-2.5 mt-2.5"
                      style={{ backgroundColor: '#047857', opacity: paysEnCours ? 0.5 : 1 }}>
                      <Text className="text-[13px] font-bold text-white">{paysEnCours ? 'Enregistrement…' : 'Enregistrer'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View className="bg-white rounded-2xl p-3.5 mt-3.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="key-outline" size={15} color="#2563EB" />
              <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">{aUnMotDePasse === true ? 'Changer le mot de passe' : 'Créer un mot de passe'}</Text>
            </View>

            {aUnMotDePasse === null ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#047857" />
                <Text className="text-[12px] text-black/45 mt-2">Vérification en cours…</Text>
              </View>
            ) : null}

            {aUnMotDePasse === 'echec' ? (
              <View className="bg-[#FEF2F2] rounded-xl p-3 mt-3">
                <Text className="text-[12px] text-[#B91C1C] leading-[17px]">
                  Impossible de vérifier l&apos;état de votre mot de passe pour le moment.
                </Text>
                <Pressable
                  onPress={() => {
                    setAUnMotDePasse(null);
                    setEssai((n) => n + 1);
                  }}
                  hitSlop={8}>
                  <Text className="text-[12.5px] font-bold text-[#047857] mt-2">Réessayer</Text>
                </Pressable>
              </View>
            ) : null}

            {aUnMotDePasse === false ? (
              <View className="bg-[#F7F7F5] rounded-xl p-3 mt-3">
                <Text className="text-[12px] text-black/60 leading-[17px]">
                  Ce compte n&apos;a pas encore de mot de passe (connexion Google ou téléphone). Vous pourrez ensuite aussi
                  vous connecter avec un mot de passe.
                </Text>
              </View>
            ) : null}

            {aUnMotDePasse === true ? (
              <>
                <Text className="text-[12px] font-bold text-black/55 mt-3.5">Mot de passe actuel</Text>
                <ChampMotDePasse
                  valeur={actuel}
                  onChange={(t) => {
                    setActuel(t);
                    setActuelVerifie(false);
                    setActuelFaux(false);
                  }}
                  onFocus={versLeBas}
                  onSubmit={verifierActuel}
                />
                {actuelVerifie ? (
                  <Critere ok texte="Mot de passe actuel correct" />
                ) : (
                  <>
                    {actuelFaux ? <Text className="text-[12px] font-bold text-[#B91C1C] mt-2">Mot de passe actuel incorrect.</Text> : null}
                    <Pressable
                      onPress={verifierActuel}
                      disabled={!actuel || verification}
                      className="self-start rounded-full px-5 py-2.5 mt-2.5"
                      style={{ backgroundColor: '#047857', opacity: !actuel || verification ? 0.45 : 1 }}>
                      <Text className="text-[13px] font-bold text-white">{verification ? 'Vérification…' : 'Vérifier'}</Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : null}

            {typeof aUnMotDePasse === 'boolean' ? (
              <>
                <Text className="text-[12px] font-bold text-black/55 mt-3.5">Nouveau mot de passe</Text>
                <ChampMotDePasse valeur={motDePasse} onChange={setMotDePasse} nouveau onFocus={versLeBas} desactive={aUnMotDePasse === true && !actuelVerifie} />
                <View className="mt-2 gap-1">
                  <Critere ok={assezLong} texte={`${LONGUEUR_MIN} caractères minimum`} />
                  <Critere ok={/[A-Za-z]/.test(motDePasse)} texte="Au moins une lettre (conseillé)" />
                  <Critere ok={/\d/.test(motDePasse)} texte="Au moins un chiffre (conseillé)" />
                </View>

                {aUnMotDePasse === true ? (
                  <>
                    <Text className="text-[12px] font-bold text-black/55 mt-3.5">Confirmer le nouveau mot de passe</Text>
                    <ChampMotDePasse valeur={confirmation} onChange={setConfirmation} nouveau onFocus={versLeBas} desactive={!actuelVerifie} />
                    {confirmation ? <Critere ok={confirmation === motDePasse} texte={confirmation === motDePasse ? 'Les deux mots de passe sont identiques' : 'Les deux mots de passe sont différents'} /> : null}
                  </>
                ) : null}

                <Pressable
                  onPress={definirMotDePasse}
                  disabled={!peutEnregistrer || enCours}
                  className="flex-row items-center gap-3 rounded-full mt-3.5"
                  style={{
                    backgroundColor: '#F3FBF7',
                    borderWidth: 1.5,
                    borderColor: '#34D399',
                    opacity: !peutEnregistrer || enCours ? 0.5 : 1,
                    paddingVertical: 8,
                    paddingLeft: 8,
                    paddingRight: 20,
                  }}>
                  <View className="w-11 h-11 rounded-full bg-[#D7F2EA] items-center justify-center">
                    {enCours ? (
                      <ActivityIndicator color="#047857" size="small" />
                    ) : (
                      <Ionicons name="lock-closed-outline" size={18} color="#047857" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-bold text-[#1A1A1A]">{aUnMotDePasse === true ? 'Changer le mot de passe' : 'Enregistrer le mot de passe'}</Text>
                    <Text className="text-[12px] text-black/45 mt-0.5">{aUnMotDePasse === true ? 'Vous serez déconnecté de tous vos appareils' : 'Connexion par e-mail'}</Text>
                  </View>
                </Pressable>
                {!peutEnregistrer && !enCours ? (
                  <Text className="text-[12px] mt-2" style={{ color: 'rgba(0,0,0,0.55)', lineHeight: 17 }}>
                    {aUnMotDePasse === true && !actuelVerifie
                      ? "Vérifiez d'abord votre mot de passe actuel pour activer ce bouton."
                      : !assezLong
                        ? `Saisissez au moins ${LONGUEUR_MIN} caractères pour activer ce bouton.`
                        : 'Confirmez le même mot de passe pour activer ce bouton.'}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
