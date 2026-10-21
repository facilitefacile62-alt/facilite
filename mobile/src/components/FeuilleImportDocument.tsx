import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactElement } from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { ajouterDocument, verifierLimiteDocuments, type DocumentProfil, type SourceDocument } from '@/lib/documents';

// « Importer un document » (choix du 21/10/2026) : une feuille sombre posée en bas de l'écran, avec trois ronds — Document
// (fichier PDF), Caméra (prendre une photo), Galerie (choisir une photo). Elle s'ouvre sur place, sans changer d'écran ;
// la limite de 2 documents est vérifiée avant de l'ouvrir.
const CHOIX: { id: SourceDocument; libelle: string; icone: keyof typeof Ionicons.glyphMap; couleur: string }[] = [
  { id: 'pdf', libelle: 'Document', icone: 'document-text', couleur: '#8B5CF6' },
  { id: 'camera', libelle: 'Caméra', icone: 'camera', couleur: '#EC4899' },
  { id: 'photo', libelle: 'Galerie', icone: 'images', couleur: '#3B82F6' },
];

export function useImportDocument(onAjoute?: (d: DocumentProfil) => void): {
  ouvrir: () => void;
  occupe: boolean;
  feuille: ReactElement;
} {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const ouvrir = () => {
    if (!user?.id) {
      Alert.alert('Connexion requise', 'Connectez-vous pour importer un document.');
      return;
    }
    if (occupe) return;
    verifierLimiteDocuments(user.id)
      .then(() => setVisible(true))
      .catch((e: Error) => Alert.alert('Ajout impossible', e.message));
  };

  const choisir = (source: SourceDocument) => {
    setVisible(false);
    if (!user?.id) return;
    setOccupe(true);
    ajouterDocument(user.id, source)
      .then((d) => {
        if (!d) return;
        onAjoute?.(d);
        Alert.alert('Document ajouté', `« ${d.titre} » est dans Profil > Documents.`);
      })
      .catch((e: Error) => Alert.alert('Ajout impossible', e.message))
      .finally(() => setOccupe(false));
  };

  const feuille = (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }} onPress={() => setVisible(false)}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: '#1F2023', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 22, paddingBottom: 30, paddingHorizontal: 20 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 18 }}>Importer un document</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {CHOIX.map((c) => (
              <Pressable key={c.id} onPress={() => choisir(c.id)} accessibilityRole="button" accessibilityLabel={c.libelle} style={{ alignItems: 'center', gap: 8, width: 84 }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#2E3034', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={c.icone} size={26} color={c.couleur} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' }}>{c.libelle}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { ouvrir, occupe, feuille };
}
