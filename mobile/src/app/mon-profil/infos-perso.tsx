import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteLigne, ListeCartes, PASTILLE_CERTIFIE, PASTILLE_PRIVE, PASTILLE_PUBLIC } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Informations personnelles (demande du 25/10/2026) : six lignes — Lieu, Quartier, Ville d'origine, Membre de, Niveau d'études, Genre — chacune
// avec son pictogramme, sa valeur, une aide, une pastille et un crayon qui ouvre la modification de la ligne. Plus de date de naissance ni de lien
// d'invitation sur cet écran (la date de naissance reste enregistrée en base, elle n'est simplement plus affichée ici). Le pays est dans « Intro ».
//
// Correspondance avec la base (table profiles) : Lieu = city, Quartier = quartier, Ville d'origine = ville_origine, Niveau d'études =
// education_level, Genre = gender. « Membre de » lit les badges du profil (non modifiable ici, ils sont attribués par la plateforme).
//
// Les pastilles « Public » / « Privé » reflètent la visibilité du profil
// entier (is_public) : la base n'a pas de visibilité champ par champ.
//
// Le nom, le titre, la bio, le pays et le téléphone vivent dans « Intro » ; les coordonnées du CV dans « Contact ».

type Ligne = {
  cle: 'city' | 'quartier' | 'ville_origine' | 'membre' | 'education_level' | 'gender';
  icone: keyof typeof Ionicons.glyphMap;
  /** Libellé affiché sous la valeur (maquette du 20/10/2026). */
  nom: string;
  label: string;
  aide: string;
  bleu?: boolean;
  modifiable: boolean;
};

const LIGNES: Ligne[] = [
  { cle: 'city', icone: 'location-outline', nom: 'Lieu', label: 'LIEU', aide: 'Ville actuelle', bleu: true, modifiable: true },
  { cle: 'quartier', icone: 'home-outline', nom: 'Quartier', label: 'QUARTIER', aide: 'Peut être pré-rempli via "Scanner Document"', modifiable: true },
  { cle: 'ville_origine', icone: 'compass-outline', nom: "Ville d'origine", label: "VILLE D'ORIGINE", aide: "Ville d'origine", bleu: true, modifiable: true },
  { cle: 'membre', icone: 'business-outline', nom: 'Membre de', label: 'MEMBRE DE', aide: 'Organisation certifiée', modifiable: false },
  { cle: 'education_level', icone: 'school-outline', nom: "Niveau d'études", label: "NIVEAU D'ÉTUDES", aide: "Utilisé pour vérifier votre éligibilité aux offres d'emploi", modifiable: true },
  { cle: 'gender', icone: 'person-outline', nom: 'Genre', label: 'GENRE', aide: 'Genre du profil', modifiable: true },
];

export default function ProfilInfosPersoScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [enEdition, setEnEdition] = useState<Ligne['cle'] | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const estPublic = profile?.is_public === true;
  const badges = Array.isArray(profile?.badges) ? (profile?.badges as string[]) : [];

  function valeurDe(l: Ligne): string {
    if (l.cle === 'membre') return badges[0] ? String(badges[0]).replace(/_/g, ' ') : '';
    const v = profile?.[l.cle];
    const texte = typeof v === 'string' ? v.trim() : '';
    return texte;
  }

  const peutModifier = (l: Ligne) => l.modifiable;

  function ouvrir(l: Ligne) {
    setSaisie(valeurDe(l));
    setEnEdition(l.cle);
  }

  async function enregistrer() {
    if (!user?.id || !enEdition) return;
    setEnregistrement(true);
    try {
      await enregistrerChampsProfil(user.id, { [enEdition]: saisie.trim() });
      await refreshProfile();
      setEnEdition(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <EnteteRubrique titre="Informations personnelles" />

        <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <ListeCartes>
            {LIGNES.map((l) => {
              const valeur = valeurDe(l);
              const certifie = l.cle === 'membre' && Boolean(valeur);
              const pastille =
                l.cle === 'education_level' || (l.cle === 'membre' && !certifie)
                  ? null
                  : certifie
                    ? PASTILLE_CERTIFIE
                    : estPublic
                      ? PASTILLE_PUBLIC
                      : PASTILLE_PRIVE;
              return (
                <CarteLigne
                  key={l.cle}
                  icone={l.icone}
                  titre={valeur || 'Non renseigné'}
                  sous={enEdition === l.cle ? undefined : l.nom}
                  pastille={enEdition === l.cle ? null : pastille}
                  fleche={peutModifier(l) && enEdition !== l.cle}
                  alignHaut={enEdition === l.cle}
                  accessibilityLabel={peutModifier(l) ? `Modifier ${l.nom.toLowerCase()}` : undefined}
                  onPress={peutModifier(l) && enEdition !== l.cle ? () => ouvrir(l) : undefined}
                  enfants={
                    enEdition === l.cle ? (
                      <View className="gap-2 mt-2">
                        <TextInput
                            value={saisie}
                            onChangeText={setSaisie}
                            autoFocus
                            placeholder={l.aide}
                            placeholderTextColor="rgba(0,0,0,0.35)"
                            style={[{ height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
                        />
                        <View className="flex-row gap-2">
                          <Pressable onPress={() => setEnEdition(null)} className="flex-1 items-center justify-center bg-white" style={{ height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}>
                            <Text className="text-[13px] font-black text-[#1A1A1A]">Annuler</Text>
                          </Pressable>
                          <Pressable onPress={enregistrer} disabled={enregistrement} className="flex-1 items-center justify-center" style={{ height: 40, borderRadius: 12, backgroundColor: '#10B981', opacity: enregistrement ? 0.6 : 1 }}>
                            {enregistrement ? <ActivityIndicator color="#fff" /> : <Text className="text-[13px] font-black text-white">Enregistrer</Text>}
                          </Pressable>
                        </View>
                      </View>
                    ) : null
                  }
                />
              );
            })}
          </ListeCartes>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
