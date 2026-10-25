import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { MOTIFS_SIGNALEMENT, signalerAnnonce, type MotifSignalement } from '@/lib/signalement';

// Fenêtre « Signaler cette annonce » : un motif, un commentaire facultatif, deux gros boutons. Le vendeur n'est jamais prévenu qu'il a été signalé.
export default function SignalerAnnonceModal({ visible, annonceId, titre, onFermer }: { visible: boolean; annonceId: string; titre: string; onFermer: () => void }) {
  const [motif, setMotif] = useState<MotifSignalement>(MOTIFS_SIGNALEMENT[0].id);
  const [details, setDetails] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoye, setEnvoye] = useState(false);

  const fermer = () => {
    onFermer();
    // On remet la fenêtre à zéro une fois fermée.
    setTimeout(() => {
      setMotif(MOTIFS_SIGNALEMENT[0].id);
      setDetails('');
      setErreur('');
      setEnvoye(false);
    }, 300);
  };

  async function envoyer() {
    if (envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      await signalerAnnonce(annonceId, motif, details);
      setEnvoye(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Le signalement a échoué. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fermer}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <ScrollView className="bg-white" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }} contentContainerClassName="p-5 gap-3" keyboardShouldPersistTaps="handled">
          {envoye ? (
            <>
              <Text className="text-[22px] font-black text-[#1A1A1A]">Signalement transmis</Text>
              <Text className="text-[15.5px] leading-[22px]" style={{ color: 'rgba(0,0,0,0.7)' }}>
                Une personne de l'équipe va l'examiner. Le vendeur ne saura pas que vous êtes à l'origine du signalement.
              </Text>
              <Pressable onPress={fermer} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 60, borderRadius: 18, backgroundColor: '#10B981' }}>
                <Text className="text-[17px] font-black text-white">Fermer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="text-[22px] font-black text-[#1A1A1A]">Signaler cette annonce</Text>
              <Text className="text-[14px]" style={{ color: 'rgba(0,0,0,0.55)' }} numberOfLines={1}>{titre}</Text>
              {MOTIFS_SIGNALEMENT.map((m) => {
                const actif = motif === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMotif(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    className="flex-row items-center gap-3 rounded-[14px] px-4"
                    style={{ minHeight: 52, borderWidth: 1.5, borderColor: actif ? '#DC2626' : 'rgba(0,0,0,0.12)', backgroundColor: actif ? '#FEF2F2' : '#FFFFFF' }}>
                    <View className="items-center justify-center rounded-full" style={{ width: 20, height: 20, borderWidth: 2, borderColor: actif ? '#DC2626' : 'rgba(0,0,0,0.3)' }}>
                      {actif ? <View className="rounded-full" style={{ width: 10, height: 10, backgroundColor: '#DC2626' }} /> : null}
                    </View>
                    <Text className="flex-1 text-[15px] font-bold text-[#1A1A1A]">{m.libelle}</Text>
                  </Pressable>
                );
              })}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Précisez (facultatif)"
                placeholderTextColor="rgba(0,0,0,0.4)"
                multiline
                maxLength={500}
                className="rounded-[14px] px-4 py-3 text-[15px] text-[#1A1A1A]"
                style={{ minHeight: 72, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', textAlignVertical: 'top' }}
              />
              {erreur ? (
                <Text accessibilityRole="alert" className="text-[14px] font-bold rounded-[12px] p-3" style={{ color: '#991B1B', backgroundColor: '#FEE2E2' }}>
                  {erreur}
                </Text>
              ) : null}
              <Pressable onPress={envoyer} disabled={envoi} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 60, borderRadius: 18, backgroundColor: '#DC2626', opacity: envoi ? 0.6 : 1 }}>
                {envoi ? <ActivityIndicator color="#fff" /> : <Text className="text-[17px] font-black text-white">Envoyer le signalement</Text>}
              </Pressable>
              <Pressable onPress={fermer} accessibilityRole="button" className="items-center justify-center bg-white" style={{ minHeight: 60, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.15)' }}>
                <Text className="text-[17px] font-black text-[#1A1A1A]">Annuler</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
