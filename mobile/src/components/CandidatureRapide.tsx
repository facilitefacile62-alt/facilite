import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  chargerContexteCandidature,
  choisirFichierCv,
  dateCourte,
  dejaPostule,
  envoyerCandidature,
  type ContexteCandidature,
  type FichierLocal,
  type OffrePourCandidature,
} from '@/lib/candidature';

// « Candidature Rapide » (maquette 08) puis « Candidature Envoyée ! »
// (maquette 09). Charte §3 : « Postuler via Facilité » — sur le fil ET sur la
// fiche offre — ouvre CETTE feuille : titre + « poste • entreprise », croix,
// champs pré-remplis (Nom complet*, Votre e-mail*, E-mail du recruteur*,
// Objet*), « Votre CV ou document* » avec le compteur « N sélectionné(s) »,
// les CV déjà enregistrés sur le profil (cases cochées), la zone d'ajout,
// Message (facultatif) et « Envoyer ma candidature ».
//
// Avant ce composant, le bouton ouvrait la page du site dans une WebView.
const VERT = '#10B981';
const VERT_FLUO = '#10E688';
const VERT_FONCE = '#0B3D2A';

const champ = {
  backgroundColor: '#F7F7F5',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 14.5,
  color: '#1A1A1A',
} as const;

type Props = {
  visible: boolean;
  offre: OffrePourCandidature;
  onFermer: () => void;
  /** Appelé quand l'utilisateur ferme la confirmation : la carte passe en « postulée ». */
  onEnvoyee?: () => void;
};

/**
 * Le contenu est monté à NEUF à chaque ouverture (rien n'est rendu tant que
 * `visible` est faux) : le formulaire repart donc toujours de son état
 * initial, sans effet de réinitialisation — un setState synchrone dans un
 * effet provoque des rendus en cascade.
 */
export default function CandidatureRapide(props: Props) {
  if (!props.visible) return null;
  return <FeuilleCandidature key={props.offre.id} {...props} />;
}

function FeuilleCandidature({ visible, offre, onFermer, onEnvoyee }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  // Hauteur maximale en pixels : un pourcentage est ignoré quand le parent n'a
  // pas de hauteur définie (constaté sur le web : la feuille débordait de
  // l'écran et l'en-tête sortait par le haut).
  const { height: hauteurEcran } = useWindowDimensions();

  const [contexte, setContexte] = useState<ContexteCandidature | null>(null);
  const [nomComplet, setNomComplet] = useState('');
  const [email, setEmail] = useState('');
  const [emailRecruteur, setEmailRecruteur] = useState(offre.contactEmail ?? '');
  const [objet, setObjet] = useState(offre.titre);
  const [message, setMessage] = useState('');
  const [cvCoches, setCvCoches] = useState<string[]>([]);
  const [fichiers, setFichiers] = useState<FichierLocal[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoyee, setEnvoyee] = useState(false);

  // À chaque ouverture : on recharge le profil et les CV, et on contrôle les
  // deux règles qui rendent le formulaire inutile (déjà postulé, e-mail non
  // confirmé) AVANT de faire remplir quoi que ce soit.
  useEffect(() => {
    if (!visible || !userId) return;
    let annule = false;

    (async () => {
      try {
        if (await dejaPostule(userId, offre.id)) {
          if (annule) return;
          Alert.alert('Candidature déjà envoyée', 'Vous avez déjà postulé à cette offre.');
          onFermer();
          return;
        }
        const ctx = await chargerContexteCandidature(userId);
        if (annule) return;
        if (!ctx.emailConfirme) {
          Alert.alert(
            'E-mail confirmé requis',
            "Un e-mail confirmé est obligatoire pour postuler. Ajoutez et confirmez le vôtre dans Sécurité & Connexion.",
            [
              { text: 'Plus tard', style: 'cancel' },
              { text: 'Ajouter mon e-mail', onPress: () => router.push('/web/securite') },
            ]
          );
          onFermer();
          return;
        }
        setContexte(ctx);
        setNomComplet(ctx.nomComplet);
        setEmail(ctx.email);
        // Le CV épinglé / le plus récent est présélectionné, comme sur le site.
        setCvCoches(ctx.cvs[0] ? [ctx.cvs[0].id] : []);
      } catch {
        if (!annule) setErreur("Impossible de charger votre profil pour le moment.");
      }
    })();
    return () => {
      annule = true;
    };
    // onFermer et router sont stables pour l'usage fait ici ; relancer à chaque
    // rendu du parent rechargerait le formulaire en pleine saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId, offre.id]);

  const totalSelection = cvCoches.length + fichiers.length;

  const basculerCv = (id: string) =>
    setCvCoches((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function ajouterFichier() {
    try {
      const f = await choisirFichierCv();
      if (f) setFichiers((l) => [...l, f]);
    } catch (e) {
      Alert.alert('Fichier refusé', e instanceof Error ? e.message : 'Ce fichier ne peut pas être ajouté.');
    }
  }

  async function envoyer() {
    if (envoi) return;
    // L'e-mail du recruteur n'est exigé que si l'offre en publie un : sans
    // adresse, c'est la route /api/postuler qui applique son repli (on ne
    // devine jamais une adresse).
    const recruteurManquant = Boolean(offre.contactEmail) && !emailRecruteur.trim();
    if (!nomComplet.trim() || !email.trim() || recruteurManquant || !objet.trim()) {
      setErreur('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (totalSelection === 0) {
      setErreur('Sélectionnez ou ajoutez au moins un CV.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      await envoyerCandidature({
        offre,
        nomComplet,
        email,
        emailRecruteur,
        objet,
        message,
        cvExistantsIds: cvCoches,
        nouveauxFichiers: fichiers,
      });
      setEnvoyee(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Une erreur est survenue lors de l'envoi.");
    } finally {
      setEnvoi(false);
    }
  }

  function fermerConfirmation() {
    setEnvoyee(false);
    onEnvoyee?.();
    onFermer();
  }

  // ─────────────── « Candidature Envoyée ! » (maquette 09) ───────────────
  if (envoyee) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={fermerConfirmation}>
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="bg-white rounded-[24px] w-full px-6 pt-5 pb-6 items-center">
            <Pressable onPress={fermerConfirmation} accessibilityLabel="Fermer" hitSlop={10} className="self-end">
              <Ionicons name="close" size={22} color="rgba(0,0,0,0.4)" />
            </Pressable>
            <View
              className="items-center justify-center"
              style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: '#D5F5E6', marginTop: 2 }}>
              <View
                className="items-center justify-center"
                style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: VERT }}>
                <Ionicons name="checkmark" size={42} color="#fff" />
              </View>
            </View>
            <Text className="text-[23px] font-black text-[#1A1A1A] mt-4">Candidature Envoyée !</Text>
            <Text className="text-[14px] text-center mt-3 leading-[21px]" style={{ color: 'rgba(0,0,0,0.6)' }}>
              Votre candidature pour <Text className="font-extrabold text-[#1A1A1A]">{offre.titre}</Text> chez{' '}
              <Text className="font-extrabold text-[#1A1A1A]">{offre.entreprise}</Text> a bien été transmise avec toutes vos
              pièces jointes.
            </Text>
            <Text className="text-[12.5px] text-center mt-3" style={{ color: 'rgba(0,0,0,0.45)' }}>
              Vous recevrez un e-mail de confirmation à l&apos;adresse{' '}
              <Text className="font-extrabold text-[#1A1A1A]">{email}</Text>.
            </Text>
            <Pressable
              onPress={fermerConfirmation}
              className="w-full items-center justify-center mt-5 rounded-[14px]"
              style={{ height: 54, backgroundColor: VERT_FLUO }}>
              <Text className="text-[16px] font-black text-[#0B3D2A]">J&apos;ai compris</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ─────────────── « Candidature Rapide » (maquette 08) ───────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <View className="flex-1 bg-black/55 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="bg-white rounded-t-[28px] overflow-hidden" style={{ maxHeight: hauteurEcran * 0.92 }}>
            <View className="px-5 pt-5 pb-3 flex-row items-start justify-between" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2.5">
                  <Ionicons name="paper-plane" size={20} color={VERT} />
                  <Text className="text-[20px] font-black text-[#1A1A1A]">Candidature Rapide</Text>
                </View>
                <Text className="text-[12.5px] mt-1.5" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>
                  {offre.titre} • {offre.entreprise}
                </Text>
              </View>
              <Pressable onPress={onFermer} accessibilityLabel="Fermer" hitSlop={10}>
                <Ionicons name="close" size={24} color="rgba(0,0,0,0.45)" />
              </Pressable>
            </View>

            {!contexte && !erreur ? (
              <View className="py-16 items-center">
                <ActivityIndicator color={VERT} />
              </View>
            ) : (
              <ScrollView contentContainerClassName="px-5 pt-4 pb-6 gap-3.5" keyboardShouldPersistTaps="handled">
                <Champ libelle="Nom complet *">
                  <TextInput value={nomComplet} onChangeText={setNomComplet} style={champ} />
                </Champ>
                <Champ libelle="Votre e-mail *">
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={champ}
                  />
                </Champ>
                <Champ libelle={offre.contactEmail ? "E-mail du recruteur *" : "E-mail du recruteur"}>
                  <TextInput
                    value={emailRecruteur}
                    onChangeText={setEmailRecruteur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="recrutement@entreprise.com"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    style={[champ, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }]}
                  />
                </Champ>
                <Champ libelle="Objet *">
                  <TextInput value={objet} onChangeText={setObjet} style={champ} />
                </Champ>

                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-[13.5px] font-extrabold text-[#1A1A1A]">Votre CV ou document *</Text>
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: '#D5F5E6' }}>
                      <Text className="text-[11.5px] font-black text-[#047857]">
                        {totalSelection} sélectionné(s)
                      </Text>
                    </View>
                  </View>

                  {(contexte?.cvs.length ?? 0) > 0 ? (
                    <View className="rounded-[16px] p-3 gap-2" style={{ backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
                      <Text className="text-[12px] font-extrabold text-[#1A1A1A]">CVs enregistrés sur votre profil :</Text>
                      {contexte?.cvs.map((cv) => {
                        const coche = cvCoches.includes(cv.id);
                        return (
                          <Pressable
                            key={cv.id}
                            onPress={() => basculerCv(cv.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: coche }}
                            className="flex-row items-center gap-2.5 rounded-[12px] px-3 py-3 bg-white"
                            style={{ borderWidth: 1.5, borderColor: coche ? VERT : 'rgba(0,0,0,0.08)' }}>
                            <View
                              className="items-center justify-center rounded-[6px]"
                              style={{ width: 22, height: 22, backgroundColor: coche ? VERT_FONCE : '#fff', borderWidth: coche ? 0 : 1.5, borderColor: 'rgba(0,0,0,0.25)' }}>
                              {coche ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                            </View>
                            <Ionicons name="document-text-outline" size={16} color="rgba(0,0,0,0.4)" />
                            <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]" numberOfLines={1}>
                              {cv.titre}
                            </Text>
                            <Text className="text-[11.5px]" style={{ color: 'rgba(0,0,0,0.45)' }}>{dateCourte(cv.creeLe)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {fichiers.map((f, i) => (
                    <View key={`${f.uri}-${i}`} className="flex-row items-center gap-2.5 rounded-[12px] px-3 py-3 mt-2" style={{ backgroundColor: '#D5F5E6' }}>
                      <Ionicons name="attach" size={16} color="#047857" />
                      <Text className="flex-1 text-[13px] font-semibold text-[#0B3D2A]" numberOfLines={1}>{f.nom}</Text>
                      <Pressable onPress={() => setFichiers((l) => l.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Retirer ce fichier">
                        <Ionicons name="close-circle" size={18} color="rgba(0,0,0,0.4)" />
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={ajouterFichier}
                    className="items-center justify-center rounded-[16px] mt-3 py-6"
                    style={{ borderWidth: 1.5, borderColor: VERT, borderStyle: 'dashed' }}>
                    <Ionicons name="arrow-up" size={20} color="#047857" />
                    <Text className="text-[13.5px] font-extrabold mt-1.5" style={{ color: '#047857' }}>
                      Glissez votre CV ici ou cliquez pour parcourir
                    </Text>
                    <Text className="text-[12px] mt-1" style={{ color: 'rgba(0,0,0,0.45)' }}>PDF, DOCX jusqu&apos;à 10 Mo</Text>
                  </Pressable>
                </View>

                <Champ libelle="Message (facultatif)">
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    placeholder="Présentez-vous en quelques mots…"
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    style={[champ, { minHeight: 96 }]}
                  />
                </Champ>

                {erreur ? (
                  <View className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <Text className="text-[12px] font-bold text-red-600">{erreur}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={envoyer}
                  disabled={envoi}
                  className="items-center justify-center rounded-[14px] flex-row gap-2"
                  style={{ height: 56, backgroundColor: VERT, opacity: envoi ? 0.7 : 1 }}>
                  {envoi ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane" size={17} color="#fff" />}
                  <Text className="text-[16px] font-black text-white">{envoi ? 'Envoi en cours…' : 'Envoyer ma candidature'}</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-[13.5px] font-extrabold text-[#1A1A1A] mb-1.5">{libelle}</Text>
      {children}
    </View>
  );
}
