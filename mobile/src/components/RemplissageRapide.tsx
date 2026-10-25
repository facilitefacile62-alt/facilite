import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { analyserDocument, scannerPieceIdentite } from '@/lib/scanDocument';

// Remplissage rapide du profil vendeur par scan : carte d'identité (recto puis verso), passeport, CV ou autre document. Rien n'est enregistré
// ici : les informations reconnues REMPLISSENT le formulaire, le vendeur les vérifie puis appuie sur « Enregistrer ». Les pièces d'identité
// passent par l'analyse éphémère (rien n'est conservé) ; un CV passe par l'analyse de document.
export type InfosScannees = { prenom?: string; nom?: string; nomComplet?: string; ville?: string; telephone?: string };

type TypeDoc = 'cni' | 'passeport' | 'cv';
const TYPES: { cle: TypeDoc; libelle: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { cle: 'cni', libelle: "Carte d'identité", icone: 'card-outline' },
  { cle: 'passeport', libelle: 'Passeport', icone: 'book-outline' },
  { cle: 'cv', libelle: 'CV / autre', icone: 'document-text-outline' },
];

export default function RemplissageRapide({ onRempli }: { onRempli: (infos: InfosScannees) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<TypeDoc>('cni');
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState('');
  // Informations déjà lues (le recto peut donner le nom, le verso le reste) : on garde la première valeur non vide de chaque champ.
  const [lu, setLu] = useState<InfosScannees>({});

  function fusionner(a: InfosScannees, b: InfosScannees): InfosScannees {
    return { prenom: a.prenom || b.prenom, nom: a.nom || b.nom, nomComplet: a.nomComplet || b.nomComplet, ville: a.ville || b.ville, telephone: a.telephone || b.telephone };
  }

  async function analyser(uri: string, nomFichier: string, mime: string) {
    setEnCours(true);
    setMessage('Analyse du document en cours…');
    try {
      let trouve: InfosScannees = {};
      if (type !== 'cv') {
        const id = await scannerPieceIdentite(uri, nomFichier, mime);
        if (!id.isIdentityDocument) {
          setMessage(id.error || "Ce document n'a pas été reconnu comme une pièce d'identité. Recommencez avec une photo nette, bien cadrée.");
          return;
        }
        trouve = { prenom: id.prenom || undefined, nom: id.nom || undefined };
      } else {
        const r = await analyserDocument(uri, nomFichier, mime);
        if (!r.ok) {
          setMessage(r.erreur);
          return;
        }
        trouve = { nomComplet: r.donnees.fullName || undefined, ville: r.donnees.city || undefined, telephone: r.donnees.phone || undefined };
      }
      const total = fusionner(lu, trouve);
      setLu(total);
      if (type === 'cni' && face === 'recto') {
        setFace('verso');
        setMessage('Recto lu. Scannez maintenant le verso (ou terminez avec le recto seulement).');
        return;
      }
      terminer(total);
    } catch {
      setMessage("Erreur réseau pendant l'analyse. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  function terminer(infos: InfosScannees = lu) {
    if (!infos.prenom && !infos.nom && !infos.nomComplet && !infos.ville && !infos.telephone) {
      setMessage("Aucune information n'a pu être lue. Réessayez avec une photo plus nette.");
      return;
    }
    onRempli(infos);
    Alert.alert('Formulaire rempli', 'Vérifiez les informations ci-dessous, corrigez si besoin, puis appuyez sur « Enregistrer ».');
    reinitialiser();
    setOuvert(false);
  }

  function reinitialiser() {
    setLu({});
    setFace('recto');
    setMessage('');
  }

  async function photo(source: 'camera' | 'galerie') {
    if (enCours) return;
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', source === 'camera' ? "Facilité a besoin d'accéder à l'appareil photo." : "Facilité a besoin d'accéder à vos photos.");
      return;
    }
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.85 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    const a = r.assets?.[0];
    if (!r.canceled && a) await analyser(a.uri, a.fileName || 'photo.jpg', a.mimeType || 'image/jpeg');
  }

  async function fichier() {
    if (enCours) return;
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/webp'],
      copyToCacheDirectory: true,
    });
    const a = r.assets?.[0];
    if (!r.canceled && a) await analyser(a.uri, a.name, a.mimeType || 'application/octet-stream');
  }

  if (!ouvert) {
    return (
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-[18px] px-4 py-3.5"
        style={{ backgroundColor: '#F3FBF7', borderWidth: 1.5, borderColor: '#34D399' }}>
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#D7F2EA' }}>
          <Ionicons name="scan-outline" size={20} color="#047857" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[14px] font-extrabold text-[#1A1A1A]">Remplissage rapide par scan</Text>
          <Text className="text-[11.5px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>Carte d&apos;identité, passeport, CV…</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.35)" />
      </Pressable>
    );
  }

  const consigne = type === 'cni' ? (face === 'recto' ? 'Scannez le RECTO de la carte' : 'Scannez le VERSO de la carte') : type === 'passeport' ? 'Scannez la page de la photo du passeport' : 'Scannez ou importez votre CV';
  return (
    <View className="bg-white rounded-[18px] px-4 py-4 gap-3">
      <View className="flex-row items-center">
        <Text className="flex-1 text-[14px] font-extrabold text-[#1A1A1A]">Remplissage rapide par scan</Text>
        <Pressable
          onPress={() => {
            reinitialiser();
            setOuvert(false);
          }}
          hitSlop={10}
          accessibilityLabel="Fermer">
          <Ionicons name="close" size={20} color="rgba(0,0,0,0.5)" />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        {TYPES.map((t) => {
          const actif = t.cle === type;
          return (
            <Pressable
              key={t.cle}
              onPress={() => {
                setType(t.cle);
                reinitialiser();
              }}
              disabled={enCours}
              className="flex-1 items-center rounded-xl py-2.5"
              style={{ borderWidth: 1.5, borderColor: actif ? '#047857' : 'rgba(0,0,0,0.12)', backgroundColor: actif ? '#ECFDF5' : '#fff' }}>
              <Ionicons name={t.icone} size={18} color={actif ? '#047857' : 'rgba(0,0,0,0.5)'} />
              <Text className="text-[11.5px] mt-1" style={{ fontWeight: actif ? '800' : '600', color: actif ? '#047857' : 'rgba(0,0,0,0.6)' }}>{t.libelle}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-[13px] font-bold text-[#1A1A1A]">{consigne}</Text>

      {enCours ? (
        <View className="flex-row items-center gap-2.5 py-2">
          <ActivityIndicator color="#047857" />
          <Text className="flex-1 text-[12.5px]" style={{ color: 'rgba(0,0,0,0.6)' }}>{message}</Text>
        </View>
      ) : (
        <>
          {message ? <Text className="text-[12.5px] leading-[18px]" style={{ color: 'rgba(0,0,0,0.65)' }}>{message}</Text> : null}
          <View className="flex-row gap-2">
            <Pressable onPress={() => photo('camera')} className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3" style={{ backgroundColor: '#047857' }}>
              <Ionicons name="camera-outline" size={17} color="#fff" />
              <Text className="text-[13px] font-bold text-white">Appareil photo</Text>
            </Pressable>
            <Pressable onPress={() => photo('galerie')} className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3" style={{ borderWidth: 1.5, borderColor: '#047857' }}>
              <Ionicons name="images-outline" size={17} color="#047857" />
              <Text className="text-[13px] font-bold" style={{ color: '#047857' }}>Galerie</Text>
            </Pressable>
          </View>
          {type === 'cv' ? (
            <Pressable onPress={fichier} className="flex-row items-center justify-center gap-2 rounded-full py-3" style={{ borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)' }}>
              <Ionicons name="document-outline" size={17} color="#1A1A1A" />
              <Text className="text-[13px] font-bold text-[#1A1A1A]">Importer un PDF ou un fichier Word</Text>
            </Pressable>
          ) : null}
          {type === 'cni' && face === 'verso' ? (
            <Pressable onPress={() => terminer()} className="items-center py-2">
              <Text className="text-[12.5px] font-bold" style={{ color: '#2563EB' }}>Terminer avec le recto seulement</Text>
            </Pressable>
          ) : null}
        </>
      )}
      <Text className="text-[11px] leading-[16px]" style={{ color: 'rgba(0,0,0,0.45)' }}>
        Rien n&apos;est enregistré tant que vous n&apos;avez pas vérifié et appuyé sur « Enregistrer ». Une pièce d&apos;identité n&apos;est jamais conservée.
      </Text>
    </View>
  );
}
