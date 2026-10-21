import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

// Lignes des pages « À propos » du profil Facilité (maquette PhonePreview du 20/10/2026) : carte blanche, bordure #D9D1C1 de
// 1,5 px, coins de 16 px, légère ombre, hauteur d'au moins 64 px ; rond vert menthe de 40 px avec icône verte ; titre en gras
// (la valeur), sous-titre gris (ce que c'est) ; pastille Public / Certifié / Principal et flèche › à droite.
export const FOND_PROFIL = '#F2F0EA';

export type PastilleProfil = { texte: string; couleur: string; fond: string };
export const PASTILLE_PUBLIC: PastilleProfil = { texte: 'Public', couleur: '#2563EB', fond: '#DBE8FC' };
export const PASTILLE_PRIVE: PastilleProfil = { texte: 'Privé', couleur: '#4B5563', fond: '#E5E7EB' };
export const PASTILLE_CERTIFIE: PastilleProfil = { texte: 'Certifié', couleur: '#10B981', fond: '#D7F2EA' };

const CARTE = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 14,
  minHeight: 64,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 16,
  backgroundColor: '#FFFFFF',
  borderWidth: 1.5,
  borderColor: '#D9D1C1',
  boxShadow: '0 2px 6px rgba(60,45,20,0.08)',
} as const;

function Pastille({ p }: { p: PastilleProfil }) {
  return (
    <View style={{ backgroundColor: p.fond, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '600', color: p.couleur }}>{p.texte}</Text>
    </View>
  );
}

export function ListeCartes({ children }: { children: ReactNode }) {
  return <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 10 }}>{children}</View>;
}

export function CarteLigne({
  icone,
  titre,
  sous,
  pastille,
  badgeTitre,
  onPress,
  droite,
  fleche,
  alignHaut,
  enfants,
  accessibilityLabel,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titre: string;
  sous?: string;
  pastille?: PastilleProfil | null;
  /** Petite pastille à côté du titre (ex. « Principal »). */
  badgeTitre?: PastilleProfil;
  onPress?: () => void;
  /** Élément à droite (corbeille…) ; remplace la flèche. */
  droite?: ReactNode;
  fleche?: boolean;
  alignHaut?: boolean;
  /** Contenu supplémentaire sous le titre (ex. champ de modification). */
  enfants?: ReactNode;
  accessibilityLabel?: string;
}) {
  const contenu = (
    <>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#D1FAE5',
          borderWidth: 1,
          borderColor: '#A7F3D0',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icone} size={19} color="#059669" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#111111', flexShrink: 1 }}>{titre}</Text>
          {badgeTitre ? <Pastille p={badgeTitre} /> : null}
        </View>
        {sous ? <Text style={{ fontSize: 12, marginTop: 2, color: 'rgba(0,0,0,0.58)' }}>{sous}</Text> : null}
        {enfants}
      </View>
      {pastille ? <Pastille p={pastille} /> : null}
      {droite}
      {fleche && !droite ? <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" /> : null}
    </>
  );
  const style = { ...CARTE, alignItems: alignHaut ? ('flex-start' as const) : ('center' as const), paddingVertical: alignHaut ? 14 : 10 };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>
      {contenu}
    </Pressable>
  ) : (
    <View style={style}>{contenu}</View>
  );
}

/** Ligne verte « + Ajouter… » en bas d'une liste. */
export function CarteAjouter({ libelle, onPress }: { libelle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={CARTE}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="add" size={20} color="#059669" />
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: '#059669' }}>{libelle}</Text>
    </Pressable>
  );
}

export function TexteVide({ texte }: { texte: string }) {
  return <Text style={{ fontSize: 12.5, color: 'rgba(0,0,0,0.4)', textAlign: 'center', paddingVertical: 16 }}>{texte}</Text>;
}
