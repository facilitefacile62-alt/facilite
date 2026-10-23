import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { AVATARS_PREDEFINIS, choisirAvatarPredefini, retirerPhotoProfil } from '@/lib/avatarsPredefinis';
import { changerPhotoProfil } from '@/lib/photoProfil';

const VERT = '#10B981';

/** Feuille « Ma photo » : un avatar au choix, OU sa photo / le logo de son entreprise depuis la galerie. */
export default function FeuillePhotoProfil({ visible, onClose, aUneImage }: { visible: boolean; onClose: () => void; aUneImage: boolean }) {
  const { user, refreshProfile } = useAuth();
  const [enCours, setEnCours] = useState(false);

  async function executer(action: (userId: string) => Promise<unknown>) {
    if (!user?.id || enCours) return;
    setEnCours(true);
    try {
      const resultat = await action(user.id);
      // `false` = la personne a annulé le choix dans la galerie : on reste sur la feuille.
      if (resultat !== false) {
        await refreshProfile();
        onClose();
      }
    } catch (e) {
      Alert.alert('Photo de profil', e instanceof Error ? e.message : 'Action impossible pour le moment.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} accessibilityLabel="Fermer" />
      <View style={{ backgroundColor: '#F2F0EA', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[20px] font-black text-[#111]">Ma photo</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
        </View>

        <Pressable
          onPress={() => executer(changerPhotoProfil)}
          disabled={enCours}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-[16px] px-4"
          style={{ height: 60, backgroundColor: VERT }}>
          <Ionicons name="image-outline" size={22} color="#fff" />
          <View className="flex-1">
            <Text className="text-[15px] font-black text-white">Ma photo ou le logo de mon entreprise</Text>
            <Text className="text-[12px] text-white/85">Depuis la galerie du téléphone</Text>
          </View>
          {enCours ? <ActivityIndicator color="#fff" /> : null}
        </Pressable>

        <Text className="text-[13.5px] font-black text-[#111] mt-5 mb-3">Ou choisis un avatar</Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {AVATARS_PREDEFINIS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => executer((id) => choisirAvatarPredefini(id, a.id))}
              disabled={enCours}
              accessibilityRole="button"
              accessibilityLabel={`Avatar ${a.emoji}`}
              className="items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: a.fond, borderWidth: 2, borderColor: '#fff' }}>
              <Text style={{ fontSize: 34 }}>{a.emoji}</Text>
            </Pressable>
          ))}
        </View>

        {aUneImage ? (
          <Pressable onPress={() => executer(retirerPhotoProfil)} disabled={enCours} hitSlop={8} className="mt-5 self-center">
            <Text className="text-[14.5px] font-black" style={{ color: '#DC2626' }}>Retirer ma photo</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
