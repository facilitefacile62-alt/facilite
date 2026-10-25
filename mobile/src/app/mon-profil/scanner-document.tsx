import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GrosBoutonsChoix from '@/components/GrosBoutonsChoix';
import { useAuth } from '@/context/AuthContext';
import { terminerOnboarding } from '@/lib/onboarding';
import { lireCvChoisi, memoriserCvChoisi } from '@/lib/mesCv';
import { appliquerRubriquesCv } from '@/lib/rubriquesCv';
import { changements, rubriquesReelles, rubriquesVides, type Rubriques } from '@/lib/rubriquesCvLogique';
import { supabase } from '@/lib/supabase';
import {
  analyserDocument,
  scannerPieceIdentite,
  type DonneesExtraites,
  type ExperienceExtraite,
  type FormationExtraite,
  type LangueExtraite,
} from '@/lib/scanDocument';

// Port mobile de handleImportAndParseCv (src/app/profil/page.js) : CNI/
// passeport -> pré-remplissage nom/prénom/quartier ; sinon CV/document ->
// /api/parse-document -> revue éditable avant écrasement du profil. Pas de
// restriction de format côté app (photo OU PDF/Word) : voir scanDocument.ts.
// Les cinq rubriques du CV (langues, expériences, formation, compétences, centres d'intérêt) ne sont JAMAIS remplacées en silence : si la personne
// en a déjà, un écran très simple demande « Remplacer mes informations par celles de ce CV ? » (deux gros boutons) ; l'ancienne version est gardée
// par le serveur et reste récupérable (mon-profil/versions-cv.tsx).
type Etat =
  | { phase: 'choix' }
  | { phase: 'analyse'; message: string }
  | { phase: 'identite'; prenom: string; nom: string; quartier: string }
  | { phase: 'revue'; donnees: DonneesExtraites }
  | { phase: 'confirmation'; donnees: DonneesExtraites }
  | { phase: 'erreur'; message: string };

export default function ScannerDocumentScreen() {
  const router = useRouter();
  const { onboarding, depuis } = useLocalSearchParams<{ onboarding?: string; depuis?: string }>();
  const { user, profile, refreshProfile } = useAuth();

  // Ouvert depuis l'écran 24 de l'onboarding : une fois le document
  // enregistré, le parcours est terminé et on arrive sur l'accueil Facilité.
  async function terminerParcours() {
    if (onboarding === '1' && user?.id) {
      await terminerOnboarding(user.id);
      await refreshProfile();
      router.replace('/');
      return;
    }
    router.back();
  }
  // Ouvert depuis « Mes CV » (CV déjà enregistré sur Facilité) : on passe directement à la relecture, comme après une analyse.
  const [etat, setEtat] = useState<Etat>(() => {
    const choisi = depuis === 'mes-cv' ? lireCvChoisi() : null;
    return choisi ? { phase: 'revue', donnees: choisi } : { phase: 'choix' };
  });
  const [enregistrement, setEnregistrement] = useState(false);

  async function traiterFichier(uri: string, nomFichier: string, type: string) {
    setEtat({ phase: 'analyse', message: '🔍 Analyse du contenu réel du document...' });
    const relaisPatience = setTimeout(() => {
      setEtat({ phase: 'analyse', message: 'Analyse en cours, ça peut prendre jusqu\'à une minute sur un document lourd…' });
    }, 6000);

    try {
      const identite = await scannerPieceIdentite(uri, nomFichier, type);
      if (identite.isIdentityDocument) {
        setEtat({ phase: 'identite', prenom: identite.prenom || '', nom: identite.nom || '', quartier: identite.quartier || '' });
        return;
      }

      const resultat = await analyserDocument(uri, nomFichier, type);
      if (!resultat.ok) {
        setEtat({ phase: 'erreur', message: resultat.erreur });
        return;
      }
      setEtat({ phase: 'revue', donnees: resultat.donnees });
    } catch {
      setEtat({ phase: 'erreur', message: "Erreur réseau pendant l'analyse. Réessayez." });
    } finally {
      clearTimeout(relaisPatience);
    }
  }

  // "Prendre une photo" ouvrait en réalité la galerie (launchImageLibraryAsync) : le bouton promettait
  // l'appareil photo sans jamais l'ouvrir — signalé le 25/09/2026. Deux boutons séparés maintenant, comme
  // pour la pièce jointe du chat (voir chat/[id].tsx) : l'un ouvre vraiment l'appareil photo, l'autre la galerie.
  async function prendrePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder à l'appareil photo.");
      return;
    }
    const resultat = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await traiterFichier(asset.uri, asset.fileName || 'photo.jpg', asset.mimeType || 'image/jpeg');
    }
  }

  async function choisirPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Facilité a besoin d'accéder à vos photos.");
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await traiterFichier(asset.uri, asset.fileName || 'photo.jpg', asset.mimeType || 'image/jpeg');
    }
  }

  async function choisirFichier() {
    const resultat = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/webp',
      ],
      copyToCacheDirectory: true,
    });
    const asset = resultat.assets?.[0];
    if (!resultat.canceled && asset) {
      await traiterFichier(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
    }
  }

  async function enregistrerIdentite(prenom: string, nom: string, quartier: string) {
    if (!user?.id) return;
    setEnregistrement(true);
    const fullName = `${prenom} ${nom}`.trim();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName || undefined, quartier: quartier || undefined, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setEnregistrement(false);
    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
      return;
    }
    await refreshProfile();
    Alert.alert('✓ Pièce d\'identité reconnue', 'Nom, prénom et quartier enregistrés sur votre profil.');
    await terminerParcours();
  }

  // Rubriques déjà présentes (les valeurs d'exemple de la base ne comptent pas) : rien à perdre → on enregistre ; sinon, écran de confirmation.
  function confirmerEcrasement(donnees: DonneesExtraites) {
    if (rubriquesVides(rubriquesReelles(profile))) {
      enregistrerRevue(donnees);
      return;
    }
    setEtat({ phase: 'confirmation', donnees });
  }

  async function enregistrerRevue(donnees: DonneesExtraites) {
    if (!user?.id) return;
    setEnregistrement(true);
    try {
      // 1) Les cinq rubriques, par le serveur : il garde d'abord une copie de l'état actuel (version récupérable), puis écrit. Une rubrique que ce
      //    CV ne contient pas reste telle quelle (jamais effacée par une extraction qui n'a rien trouvé).
      await appliquerRubriquesCv(rubriquesDeLaRevue(donnees));
      // 2) Identité lue sur le CV (nom, titre, bio, ville) et coordonnées du CV : vérifiées par la personne sur l'écran de revue.
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: donnees.fullName || undefined,
          headline: donnees.headline || undefined,
          bio: donnees.bio || undefined,
          city: donnees.city || undefined,
          // Les coordonnées lues sur le CV vont dans « Coordonnées du CV » (colonnes à part) : le téléphone du compte n'est jamais remplacé.
          cv_telephone: donnees.phone || undefined,
          cv_email: donnees.email || undefined,
          cv_ville: donnees.city || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
    } catch {
      setEnregistrement(false);
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
      return;
    }
    setEnregistrement(false);
    memoriserCvChoisi(null);
    await refreshProfile();
    Alert.alert('✓ CV enregistré', 'Vos informations ont été mises à jour. Les anciennes sont gardées : vous pouvez les retrouver.');
    await terminerParcours();
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-5 py-4">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
          </Pressable>
          <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Scanner un document</Text>
        </View>
        <View className="h-px bg-black/[0.08] mx-5 mb-3.5" />

        {etat.phase === 'choix' && (
          <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
            <Text className="text-[12.5px] text-black/50 leading-5">
              Importez une photo (CNI, passeport, CV scanné) ou un fichier PDF/Word. L&apos;IA reconnaît
              automatiquement le type de document et pré-remplit votre profil — vous vérifiez tout avant
              d&apos;enregistrer.
            </Text>

            {/* Un CV déjà enregistré sur Facilité (créé sur le site ou importé) : la mise à jour du profil en un geste */}
            <Pressable onPress={() => router.push('/mon-profil/choisir-cv' as Href)} className="flex-row items-center gap-3 bg-white rounded-full mt-4" style={{ paddingVertical: 9, paddingLeft: 10, paddingRight: 22 }}>
              <View className="w-11 h-11 rounded-full bg-[#D1FAE5] items-center justify-center">
                <Ionicons name="documents-outline" size={20} color="#047857" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Utiliser un CV déjà sur Facilité</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">Un CV créé ou importé</Text>
              </View>
            </Pressable>

            <Pressable onPress={prendrePhoto} className="flex-row items-center gap-3 bg-white rounded-full mt-3" style={{ paddingVertical: 9, paddingLeft: 10, paddingRight: 22 }}>
              <View className="w-11 h-11 rounded-full bg-[#d7f2ea] items-center justify-center">
                <Ionicons name="camera-outline" size={20} color="#0d3b34" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Prendre une photo</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">CNI, passeport, CV imprimé</Text>
              </View>
            </Pressable>

            <Pressable onPress={choisirPhoto} className="flex-row items-center gap-3 bg-white rounded-full mt-3" style={{ paddingVertical: 9, paddingLeft: 10, paddingRight: 22 }}>
              <View className="w-11 h-11 rounded-full bg-[#fdf1d9] items-center justify-center">
                <Ionicons name="images-outline" size={20} color="#b45309" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Choisir dans la galerie</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">Une photo déjà prise</Text>
              </View>
            </Pressable>

            <Pressable onPress={choisirFichier} className="flex-row items-center gap-3 bg-white rounded-full mt-3" style={{ paddingVertical: 9, paddingLeft: 10, paddingRight: 22 }}>
              <View className="w-11 h-11 rounded-full bg-[#dbe8fc] items-center justify-center">
                <Ionicons name="document-outline" size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Choisir un fichier</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">PDF, Word, image</Text>
              </View>
            </Pressable>

            {/* Pas encore de CV : un seul lien pour en créer un */}
            <Pressable onPress={() => router.push('/web/creer-cv' as Href)} accessibilityRole="link" className="items-center justify-center mt-4" style={{ minHeight: 48 }}>
              <Text className="text-[14px] font-bold" style={{ color: '#2563EB' }}>Je n&apos;ai pas de CV : en créer un</Text>
            </Pressable>
          </ScrollView>
        )}

        {etat.phase === 'analyse' && (
          <View className="flex-1 items-center justify-center px-8 gap-3">
            <ActivityIndicator color="#10B981" size="large" />
            <Text className="text-[13px] text-black/55 text-center">{etat.message}</Text>
          </View>
        )}

        {etat.phase === 'erreur' && (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Text className="text-[13px] text-black/55 text-center">{etat.message}</Text>
            <Pressable onPress={() => setEtat({ phase: 'choix' })} className="bg-[#2563EB] rounded-full px-5 py-2.5">
              <Text className="text-white text-[13px] font-bold">Réessayer</Text>
            </Pressable>
          </View>
        )}

        {etat.phase === 'identite' && (
          <IdentiteReview
            prenomInitial={etat.prenom}
            nomInitial={etat.nom}
            quartierInitial={etat.quartier}
            enregistrement={enregistrement}
            onValider={enregistrerIdentite}
          />
        )}

        {etat.phase === 'revue' && (
          <RevueDocument donnees={etat.donnees} enregistrement={enregistrement} onValider={confirmerEcrasement} />
        )}

        {etat.phase === 'confirmation' && (
          <GrosBoutonsChoix
            question="Remplacer mes informations par celles de ce CV ?"
            details={[
              ...changements(rubriquesReelles(profile), rubriquesDeLaRevue(etat.donnees)).map((c) => c.texte),
              'Votre nom, titre, bio et ville seront aussi mis à jour.',
              'Vos anciennes informations sont gardées : vous pourrez les récupérer.',
            ]}
            oui="Oui, remplacer"
            non="Non, garder les miennes"
            occupe={enregistrement}
            onOui={() => enregistrerRevue(etat.donnees)}
            onNon={() => setEtat({ phase: 'revue', donnees: etat.donnees })}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function IdentiteReview({
  prenomInitial,
  nomInitial,
  quartierInitial,
  enregistrement,
  onValider,
}: {
  prenomInitial: string;
  nomInitial: string;
  quartierInitial: string;
  enregistrement: boolean;
  onValider: (prenom: string, nom: string, quartier: string) => void;
}) {
  const [prenom, setPrenom] = useState(prenomInitial);
  const [nom, setNom] = useState(nomInitial);
  const [quartier, setQuartier] = useState(quartierInitial);

  return (
    <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
      <View className="bg-[#d7f2ea] rounded-2xl p-3.5 flex-row gap-2.5 items-start">
        <Ionicons name="shield-checkmark-outline" size={18} color="#0d3b34" />
        <Text className="flex-1 text-[12.5px] text-[#0d3b34] leading-5">
          Pièce d&apos;identité reconnue — le document n&apos;a pas été conservé. Vérifiez ces informations avant
          d&apos;enregistrer.
        </Text>
      </View>

      <ChampRevue label="PRÉNOM" valeur={prenom} onChange={setPrenom} />
      <ChampRevue label="NOM" valeur={nom} onChange={setNom} />
      <ChampRevue label="QUARTIER" valeur={quartier} onChange={setQuartier} />

      <Pressable
        onPress={() => onValider(prenom, nom, quartier)}
        disabled={enregistrement}
        className="bg-[#2563EB] rounded-full py-3.5 items-center mt-5">
        <Text className="text-white text-[14px] font-bold">
          {enregistrement ? 'Enregistrement…' : '✓ Enregistrer sur mon profil'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function RevueDocument({
  donnees,
  enregistrement,
  onValider,
}: {
  donnees: DonneesExtraites;
  enregistrement: boolean;
  onValider: (donnees: DonneesExtraites) => void;
}) {
  const [fullName, setFullName] = useState(donnees.fullName);
  const [headline, setHeadline] = useState(donnees.headline);
  const [bio, setBio] = useState(donnees.bio);
  const [city, setCity] = useState(donnees.city);
  const [phone, setPhone] = useState(donnees.phone);
  const [languages, setLanguages] = useState<LangueExtraite[]>(donnees.languages);
  const [experiences, setExperiences] = useState<ExperienceExtraite[]>(donnees.experiences);
  const [educations, setEducations] = useState<FormationExtraite[]>(donnees.educations);
  const [skills, setSkills] = useState<string[]>(donnees.skills);
  const [interests, setInterests] = useState<string[]>(donnees.interests);

  return (
    <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
      {donnees.degrade && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3.5">
          <Text className="text-[12px] text-amber-700 leading-5">
            Analyse partielle : seules quelques informations ont pu être devinées. Complétez ce qui manque.
          </Text>
        </View>
      )}

      <Text className="text-[11px] font-bold text-black/40 tracking-wide">✓ Document analysé — vérifiez avant d&apos;enregistrer</Text>

      <ChampRevue label="NOM COMPLET" valeur={fullName} onChange={setFullName} />
      <ChampRevue label="TITRE PROFESSIONNEL" valeur={headline} onChange={setHeadline} />
      <ChampRevue label="VILLE" valeur={city} onChange={setCity} />
      <ChampRevue label="TÉLÉPHONE" valeur={phone} onChange={setPhone} />
      <View className="mt-2.5">
        <Text className="text-[10.5px] text-black/40">BIO</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          textAlignVertical="top"
          className="text-[13.5px] text-[#1A1A1A] mt-1 bg-white rounded-xl px-3 py-2.5 min-h-[70px]"
        />
      </View>

      {languages.length > 0 && (
        <View className="mt-4">
          <Text className="text-[11px] font-bold text-black/40 tracking-wide">🌐 LANGUES DÉTECTÉES</Text>
          <View className="gap-2 mt-2">
            {languages.map((l, i) => (
              <View key={`${l.name}-${i}`} className="flex-row items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5">
                <Text className="flex-1 text-[13px] font-semibold text-[#1A1A1A]">
                  {l.name}
                  {l.level ? ` — ${l.level}` : ''}
                </Text>
                <Pressable onPress={() => setLanguages((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close-circle-outline" size={18} color="rgba(0,0,0,0.35)" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {experiences.length > 0 && (
        <View className="mt-4">
          <Text className="text-[11px] font-bold text-black/40 tracking-wide">💼 EXPÉRIENCES DÉTECTÉES</Text>
          <View className="gap-2 mt-2">
            {experiences.map((x, i) => (
              <View key={`${x.title}-${i}`} className="flex-row items-start gap-2.5 bg-white rounded-xl px-3.5 py-2.5">
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">{x.title}</Text>
                  <Text className="text-[11.5px] text-black/50 mt-0.5">
                    {x.company}
                    {x.location ? ` • ${x.location}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => setExperiences((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close-circle-outline" size={18} color="rgba(0,0,0,0.35)" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {educations.length > 0 && (
        <View className="mt-4">
          <Text className="text-[11px] font-bold text-black/40 tracking-wide">🎓 FORMATIONS DÉTECTÉES</Text>
          <View className="gap-2 mt-2">
            {educations.map((f, i) => (
              <View key={`${f.school}-${f.degree}-${i}`} className="flex-row items-start gap-2.5 bg-white rounded-xl px-3.5 py-2.5">
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-[#1A1A1A]">{f.school || f.degree}</Text>
                  <Text className="text-[11.5px] text-black/50 mt-0.5">{f.school ? [f.degree, f.field].filter(Boolean).join(' - ') : f.field}</Text>
                </View>
                <Pressable onPress={() => setEducations((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close-circle-outline" size={18} color="rgba(0,0,0,0.35)" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {skills.length > 0 && (
        <View className="mt-4">
          <Text className="text-[11px] font-bold text-black/40 tracking-wide">💡 COMPÉTENCES DÉTECTÉES</Text>
          <View className="flex-row flex-wrap gap-2 mt-2">
            {skills.map((c, i) => (
              <Pressable key={`${c}-${i}`} onPress={() => setSkills((prev) => prev.filter((_, idx) => idx !== i))} className="flex-row items-center gap-1.5 bg-white rounded-[10px] px-3 py-2">
                <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">{c}</Text>
                <Ionicons name="close" size={13} color="rgba(0,0,0,0.4)" />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {interests.length > 0 && (
        <View className="mt-4">
          <Text className="text-[11px] font-bold text-black/40 tracking-wide">🎯 CENTRES D&apos;INTÉRÊT DÉTECTÉS</Text>
          <View className="flex-row flex-wrap gap-2 mt-2">
            {interests.map((c, i) => (
              <Pressable key={`${c}-${i}`} onPress={() => setInterests((prev) => prev.filter((_, idx) => idx !== i))} className="flex-row items-center gap-1.5 bg-white rounded-[10px] px-3 py-2">
                <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">{c}</Text>
                <Ionicons name="close" size={13} color="rgba(0,0,0,0.4)" />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={() => onValider({ fullName, headline, bio, city, phone, email: donnees.email, languages, experiences, educations, skills, interests, degrade: donnees.degrade })}
        disabled={enregistrement}
        className="bg-emerald-500 rounded-full py-3.5 items-center mt-5">
        <Text className="text-white text-[14px] font-bold">
          {enregistrement ? 'Enregistrement…' : '✓ Valider et enregistrer'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/** Les cinq rubriques telles qu'elles ont été relues et validées sur l'écran de revue. */
function rubriquesDeLaRevue(d: DonneesExtraites): Rubriques {
  return {
    languages: d.languages.map((l) => ({ id: `lang-${l.name}`, name: l.name, level: l.level })),
    experiences: d.experiences,
    educations: d.educations,
    skills: d.skills,
    interests: d.interests,
  };
}

function ChampRevue({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <View className="mt-2.5">
      <Text className="text-[10.5px] text-black/40">{label}</Text>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor="rgba(0,0,0,0.3)"
        className="text-[14px] font-bold text-[#1A1A1A] mt-1 bg-white rounded-xl px-3 py-2.5"
      />
    </View>
  );
}
