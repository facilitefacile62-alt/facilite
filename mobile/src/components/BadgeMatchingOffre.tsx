import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

// Équivalent React Native de src/components/BadgeMatchingOffre.jsx (web) —
// même contrat (score 0..1, seuil à 75%), palette différente par choix
// assumé : le web garde ses couleurs actuelles (vert menthe/émeraude), cet
// écran mobile a sa propre direction Bleu Roi (#2563EB) / Vert Menthe
// (#10B981) validée pour l'app. Le score lui-même vient du même moteur
// (match_job_offers, embeddings pgvector) — aucun nouvel algorithme.
export const SEUIL_RECOMMANDATION = 0.75;

type Props = {
  score?: number | null;
};

export default function BadgeMatchingOffre({ score }: Props) {
  if (score == null) return null;

  const pourcentage = Math.round(score * 100);
  const recommande = score >= SEUIL_RECOMMANDATION;

  return (
    <View className="self-start mb-2">
      <View
        className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full border ${
          recommande ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-blue-500/10 border-blue-500/30'
        }`}>
        <Ionicons name="checkmark-circle" size={12} color={recommande ? '#10B981' : '#2563EB'} />
        <Text className={`text-[10.5px] font-extrabold ${recommande ? 'text-emerald-400' : 'text-blue-400'}`}>
          {recommande ? `Recommandé pour vous · ${pourcentage}%` : `${pourcentage}% compatible`}
        </Text>
      </View>
      {recommande && (
        <Text className="text-[10.5px] font-medium text-emerald-400/90 mt-1">
          Cette offre correspond parfaitement à votre profil
        </Text>
      )}
    </View>
  );
}
