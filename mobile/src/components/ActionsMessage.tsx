import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

// Actions sur un message (appui long, maquette 21) : barre de réactions emoji, puis le menu — Répondre, Copier,
// Transférer, Épingler, Marquer comme important, | Sélectionner, Enregistrer sous, Partager, Ouvrir avec, |
// Signaler, Supprimer. « Enregistrer sous » et « Ouvrir avec » ne concernent que les pièces jointes (grisés sinon) ;
// « Signaler » ne concerne que les messages reçus.
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type Element = {
  id: string;
  libelle: string;
  icone: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  desactive?: boolean;
  separateurAvant?: boolean;
};

export type ActionMessage =
  | 'repondre'
  | 'copier'
  | 'transferer'
  | 'epingler'
  | 'important'
  | 'selectionner'
  | 'enregistrer'
  | 'partager'
  | 'ouvrir'
  | 'signaler'
  | 'supprimer';

export default function ActionsMessage({
  visible,
  moi,
  y,
  aUnePieceJointe,
  epingle,
  important,
  reactionActuelle,
  onReaction,
  onAction,
  onFermer,
  sansSuppression,
}: {
  visible: boolean;
  moi: boolean;
  /** Position verticale (écran) du toucher, pour poser le menu au niveau du message. */
  y: number;
  aUnePieceJointe: boolean;
  epingle: boolean;
  important: boolean;
  reactionActuelle?: string;
  onReaction: (emoji: string) => void;
  onAction: (a: ActionMessage) => void;
  onFermer: () => void;
  /** Discussions Locaux : un message ne se supprime jamais (ni ne se modifie), même seulement sur son propre écran. */
  sansSuppression?: boolean;
}) {
  const { height } = useWindowDimensions();

  const elements: Element[] = [
    { id: 'repondre', libelle: 'Répondre', icone: 'arrow-undo-outline' },
    { id: 'copier', libelle: 'Copier', icone: 'copy-outline' },
    { id: 'transferer', libelle: 'Transférer', icone: 'arrow-redo-outline' },
    { id: 'epingler', libelle: epingle ? 'Désépingler' : 'Épingler', icone: 'pin-outline' },
    { id: 'important', libelle: important ? 'Retirer des importants' : 'Marquer comme important', icone: important ? 'star' : 'star-outline' },
    { id: 'selectionner', libelle: 'Sélectionner', icone: 'checkbox-outline', separateurAvant: true },
    { id: 'enregistrer', libelle: 'Enregistrer sous', icone: 'download-outline', desactive: !aUnePieceJointe },
    { id: 'partager', libelle: 'Partager', icone: 'share-outline' },
    { id: 'ouvrir', libelle: 'Ouvrir avec', icone: 'open-outline', desactive: !aUnePieceJointe },
    ...(moi ? [] : [{ id: 'signaler', libelle: 'Signaler', icone: 'flag-outline' as const, danger: true, separateurAvant: true }]),
    ...(sansSuppression ? [] : [{ id: 'supprimer', libelle: 'Supprimer', icone: 'trash-outline' as const, danger: true, separateurAvant: moi }]),
  ];

  // Hauteur approximative du bloc (réactions + menu) pour qu'il reste entièrement à l'écran.
  const hauteurBloc = 62 + elements.length * 44 + 24;
  const haut = Math.max(70, Math.min(y - 60, height - hauteurBloc - 24));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable onPress={onFermer} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' }}>
        <View style={{ position: 'absolute', top: haut, left: moi ? undefined : 14, right: moi ? 14 : undefined, width: 252, gap: 10 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 10, paddingVertical: 6, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
            {REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => onReaction(e)}
                accessibilityLabel={`Réagir ${e}`}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: reactionActuelle === e ? '#E5F5EE' : 'transparent' }}>
                <Text style={{ fontSize: 21 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => {}} style={{ backgroundColor: '#fff', borderRadius: 20, paddingVertical: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.22)' }}>
            {elements.map((el) => (
              <View key={el.id}>
                {el.separateurAvant ? <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 4 }} /> : null}
                <Pressable
                  onPress={() => !el.desactive && onAction(el.id as ActionMessage)}
                  disabled={el.desactive}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, height: 44, opacity: el.desactive ? 0.35 : 1 }}>
                  <Ionicons name={el.icone} size={19} color={el.danger ? '#B91C1C' : '#1A1A1A'} />
                  <Text style={{ fontSize: 15, color: el.danger ? '#B91C1C' : '#1A1A1A' }}>{el.libelle}</Text>
                </Pressable>
              </View>
            ))}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
