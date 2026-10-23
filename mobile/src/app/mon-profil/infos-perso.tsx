import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CarteLigne, ListeCartes, PASTILLE_CERTIFIE, PASTILLE_PRIVE, PASTILLE_PUBLIC } from '@/components/CarteProfil';
import EnteteRubrique from '@/components/EnteteRubrique';
import SelecteurDateNaissance, { dateValide } from '@/components/SelecteurDateNaissance';
import { useAuth } from '@/context/AuthContext';
import { enregistrerChampsProfil } from '@/lib/profilChamps';

// Informations personnelles (maquette 48) : six lignes — Lieu, Quartier,
// Pays / origine, Membre de, Niveau d'études, Genre — chacune avec son
// pictogramme, sa valeur, une aide, une pastille et un crayon qui ouvre la
// modification de la ligne.
//
// Correspondance avec la base (table profiles) : Lieu = city, Quartier =
// quartier, Pays / origine = country, Niveau d'études = education_level,
// Genre = gender. « Membre de » lit les badges du profil (non modifiable ici,
// ils sont attribués par la plateforme).
//
// Les pastilles « Public » / « Privé » reflètent la visibilité du profil
// entier (is_public) : la base n'a pas de visibilité champ par champ.
//
// Le nom, le titre, la biographie et les coordonnées vivent dans « Intro »
// et « Coordonnées » (maquettes 47 et 54). Le lien d'invitation reste en bas.
const SITE_URL = 'https://ffacilite.com';

type Ligne = {
  cle: 'city' | 'quartier' | 'country' | 'membre' | 'education_level' | 'gender' | 'date_naissance';
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
  { cle: 'country', icone: 'compass-outline', nom: 'Pays / origine', label: "PAYS / ORIGINE", aide: "Pays d'origine", bleu: true, modifiable: true },
  { cle: 'membre', icone: 'business-outline', nom: 'Membre de', label: 'MEMBRE DE', aide: 'Organisation certifiée', modifiable: false },
  { cle: 'education_level', icone: 'school-outline', nom: "Niveau d'études", label: "NIVEAU D'ÉTUDES", aide: "Utilisé pour vérifier votre éligibilité aux offres d'emploi", modifiable: true },
  { cle: 'gender', icone: 'person-outline', nom: 'Genre', label: 'GENRE', aide: 'Genre du profil', modifiable: true },
  { cle: 'date_naissance', icone: 'gift-outline', nom: 'Date de naissance', label: 'DATE DE NAISSANCE', aide: 'Gardée pour vous souhaiter bon anniversaire', modifiable: true },
];

export default function ProfilInfosPersoScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [enEdition, setEnEdition] = useState<Ligne['cle'] | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const estPublic = profile?.is_public === true;
  const badges = Array.isArray(profile?.badges) ? (profile?.badges as string[]) : [];
  const lienInvitation = `${SITE_URL}/in/${(profile?.slug as string | undefined) || user?.id || ''}`;

  function valeurDe(l: Ligne): string {
    if (l.cle === 'membre') return badges[0] ? String(badges[0]).replace(/_/g, ' ') : '';
    const v = profile?.[l.cle];
    const texte = typeof v === 'string' ? v.trim() : '';
    // Date de naissance affichée en toutes lettres (« 15 octobre 1990 »), enregistrée en « AAAA-MM-JJ ».
    if (l.cle === 'date_naissance' && /^\d{4}-\d{2}-\d{2}/.test(texte)) {
      const [a, m, j] = texte.slice(0, 10).split('-');
      const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][Number(m) - 1];
      return `${Number(j)} ${mois} ${a}`;
    }
    return texte;
  }

  function ouvrir(l: Ligne) {
    setSaisie(l.cle === 'date_naissance' ? (typeof profile?.date_naissance === 'string' ? profile.date_naissance.slice(0, 10) : '') : valeurDe(l));
    setEnEdition(l.cle);
  }

  async function enregistrer() {
    if (!user?.id || !enEdition) return;
    if (enEdition === 'date_naissance' && saisie && !dateValide(saisie)) {
      Alert.alert('Date de naissance', 'Choisis le jour, le mois et l’année, ou laisse les trois listes vides.');
      return;
    }
    setEnregistrement(true);
    try {
      // La date de naissance est une vraie date en base : vide = null (jamais une chaîne vide).
      await enregistrerChampsProfil(user.id, { [enEdition]: enEdition === 'date_naissance' ? saisie.trim() || null : saisie.trim() });
      await refreshProfile();
      setEnEdition(null);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer pour le moment.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function copierLien() {
    await Clipboard.setStringAsync(lienInvitation);
    Alert.alert('Lien copié', 'Le lien de votre profil public a été copié.');
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
                  fleche={l.modifiable && enEdition !== l.cle}
                  alignHaut={enEdition === l.cle}
                  accessibilityLabel={l.modifiable ? `Modifier ${l.nom.toLowerCase()}` : undefined}
                  onPress={l.modifiable && enEdition !== l.cle ? () => ouvrir(l) : undefined}
                  enfants={
                    enEdition === l.cle ? (
                      <View className="gap-2 mt-2">
                        {l.cle === 'date_naissance' ? (
                          <SelecteurDateNaissance valeur={saisie} onChange={setSaisie} />
                        ) : (
                          <TextInput
                            value={saisie}
                            onChangeText={setSaisie}
                            autoFocus
                            placeholder={l.aide}
                            placeholderTextColor="rgba(0,0,0,0.35)"
                            style={[{ height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
                          />
                        )}
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

          <View className="px-5">
          <View className="flex-row items-center justify-between mt-6">
            <View className="flex-1 min-w-0 pr-3">
              <Text className="text-[12px]" style={{ color: 'rgba(0,0,0,0.45)' }}>Lien d&apos;invitation</Text>
              <Text className="text-[12.5px] font-bold" style={{ color: '#2563EB' }} numberOfLines={1}>{lienInvitation}</Text>
            </View>
            <Pressable onPress={copierLien} className="flex-row items-center gap-1.5 bg-white" style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}>
              <Ionicons name="copy-outline" size={14} color="#1A1A1A" />
              <Text className="text-[13px] font-black text-[#1A1A1A]">Copier</Text>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
