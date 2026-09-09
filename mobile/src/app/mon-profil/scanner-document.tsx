import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  analyserDocument,
  scannerPieceIdentite,
  type DonneesExtraites,
  type ExperienceExtraite,
  type LangueExtraite,
} from '@/lib/scanDocument';

// Port mobile de handleImportAndParseCv (src/app/profil/page.js) : CNI/
// passeport -> pré-remplissage nom/prénom/quartier ; sinon CV/document ->
// /api/parse-document -> revue éditable avant écrasement du profil. Pas de
// restriction de format côté app (photo OU PDF/Word) : voir scanDocument.ts.
// La revue CV n'inclut pas les formations (profiles.educations) : aucun
// écran mobile ne les affiche encore (voir mon-profil/a-propos.tsx), donc
// rien n'est écrit dans une colonne qu'on ne peut pas relire ici.
type Etat =
  | { phase: 'choix' }
  | { phase: 'analyse'; message: string }
  | { phase: 'identite'; prenom: string; nom: string; quartier: string }
  | { phase: 'revue'; donnees: DonneesExtraites }
  | { phase: 'erreur'; message: string };

export default function ScannerDocumentScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [etat, setEtat] = useState<Etat>({ phase: 'choix' });
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
    router.back();
  }

  function confirmerEcrasement(donnees: DonneesExtraites) {
    Alert.alert(
      'Remplacer vos informations ?',
      'Les champs remplis ci-dessous vont remplacer vos informations personnelles, langues et expériences actuelles.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Remplacer', style: 'destructive', onPress: () => enregistrerRevue(donnees) },
      ]
    );
  }

  async function enregistrerRevue(donnees: DonneesExtraites) {
    if (!user?.id) return;
    setEnregistrement(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: donnees.fullName || undefined,
        headline: donnees.headline || undefined,
        bio: donnees.bio || undefined,
        city: donnees.city || undefined,
        phone: donnees.phone || undefined,
        // Un tableau vide n'écrase les langues/expériences existantes que
        // si la revue en propose au moins une (voir le bandeau de
        // confirmation) — sinon une extraction qui n'a rien trouvé
        // effacerait silencieusement des données réelles déjà enregistrées.
        languages: donnees.languages.length > 0 ? donnees.languages : undefined,
        experiences: donnees.experiences.length > 0 ? donnees.experiences : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    setEnregistrement(false);
    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
      return;
    }
    await refreshProfile();
    Alert.alert('✓ Document analysé', 'Les informations du profil ont été mises à jour.');
    router.back();
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

            <Pressable onPress={choisirPhoto} className="flex-row items-center gap-3 bg-white rounded-2xl p-4 mt-4">
              <View className="w-11 h-11 rounded-xl bg-[#d7f2ea] items-center justify-center">
                <Ionicons name="camera-outline" size={20} color="#0d3b34" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Prendre une photo / Galerie</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">CNI, passeport, CV imprimé</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
            </Pressable>

            <Pressable onPress={choisirFichier} className="flex-row items-center gap-3 bg-white rounded-2xl p-4 mt-3">
              <View className="w-11 h-11 rounded-xl bg-[#dbe8fc] items-center justify-center">
                <Ionicons name="document-outline" size={20} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Choisir un fichier</Text>
                <Text className="text-[11.5px] text-black/45 mt-0.5">PDF, Word, image</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.3)" />
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

      <Pressable
        onPress={() => onValider({ fullName, headline, bio, city, phone, email: donnees.email, languages, experiences, degrade: donnees.degrade })}
        disabled={enregistrement}
        className="bg-emerald-500 rounded-full py-3.5 items-center mt-5">
        <Text className="text-white text-[14px] font-bold">
          {enregistrement ? 'Enregistrement…' : '✓ Valider et enregistrer'}
        </Text>
      </Pressable>
    </ScrollView>
  );
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
