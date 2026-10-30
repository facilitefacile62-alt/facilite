import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ScrollView } from 'react-native';

import { CarteMenu, GroupeCartes } from '@/components/CarteMenu';

// Contenu de l'onglet « À propos » de « Modifier infos » (page du glisseur ModifierInfosPager). Maquette 47 (version du 12/10/2026) : en-tête
// Facilité, ligne « ← Retour  Modifier infos », trois onglets (À propos ·
// Scanner · Paramètres) et HUIT rubriques, chacune avec son sous-titre, icône
// grise dans un rond clair. Confidentialité et Sécurité & Connexion ne sont
// plus ici : elles sont dans l'onglet Paramètres. Le bouton « Importer mon
// CV » n'existe pas sur la maquette (l'onglet Scanner joue ce rôle).
const RUBRIQUES: { id: string; icone: keyof typeof Ionicons.glyphMap; label: string; sous: string; route: Href }[] = [
  { id: 'intro', icone: 'mic-outline', label: 'Intro', sous: 'Votre présentation en quelques mots', route: '/mon-profil/intro' as Href },
  { id: 'infos-perso', icone: 'id-card-outline', label: 'Informations personnelles', sous: "Lieu, quartier, ville d'origine, études, genre", route: '/mon-profil/infos-perso' as Href },
  { id: 'langues', icone: 'globe-outline', label: 'Langue du CV', sous: 'Langues indiquées sur votre CV', route: '/mon-profil/langues' as Href },
  { id: 'experiences', icone: 'briefcase-outline', label: 'Expériences professionnelles', sous: 'Vos postes et missions', route: '/mon-profil/experiences' as Href },
  { id: 'formation', icone: 'school-outline', label: 'Formation', sous: 'Diplômes et écoles', route: '/mon-profil/formation' as Href },
  { id: 'competences', icone: 'bulb-outline', label: 'Compétences', sous: 'Vos savoir-faire', route: '/mon-profil/competences' as Href },
  { id: 'interets', icone: 'shield-outline', label: "Centres d'intérêt", sous: 'Loisirs et engagements', route: '/mon-profil/centres-interet' as Href },
  { id: 'coordonnees', icone: 'call-outline', label: 'Contact', sous: 'Téléphone, e-mail et ville de votre CV', route: '/mon-profil/coordonnees-cv' as Href },
];

export default function ContenuAPropos() {
  const router = useRouter();

  return (
    // Même DESIGN que les Réglages de Locaux : cartes séparées à icône verte (éléments propres à Facilité).
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-4 pb-7">
      <GroupeCartes>
        {RUBRIQUES.map((r) => (
          <CarteMenu key={r.id} icone={r.icone} titre={r.label} sous={r.sous} onPress={() => router.push(r.route)} />
        ))}
      </GroupeCartes>
    </ScrollView>
  );
}
