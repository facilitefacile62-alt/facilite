import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import type { CleEcranWeb } from '@/lib/webEcrans';

// Paramètres et pages du compte : chaque ligne ouvre la vraie page du site
// (déjà connecté, voir web/[cle].tsx) — mêmes pages, mêmes règles que sur le
// site. Les espaces Recruteur et Administration ne sont proposés qu'aux rôles
// concernés ; le serveur applique de toute façon le contrôle de rôle.
type Ligne = { cle: CleEcranWeb; icone: keyof typeof Ionicons.glyphMap; label: string; sous: string };
type Groupe = { titre: string; lignes: Ligne[] };

const GROUPES: Groupe[] = [
  {
    titre: 'Mon compte',
    lignes: [
      { cle: 'securite', icone: 'shield-checkmark-outline', label: 'Sécurité du compte', sous: 'Mot de passe et connexions' },
      { cle: 'facturation', icone: 'card-outline', label: 'Facturation', sous: 'Paiements et factures' },
      { cle: 'premium', icone: 'star-outline', label: 'Premium', sous: 'Abonnement et avantages' },
      { cle: 'suppression-compte', icone: 'trash-outline', label: 'Supprimer mon compte', sous: 'Effacer mes données' },
    ],
  },
  {
    titre: 'Mes espaces',
    lignes: [
      { cle: 'mes-cvs', icone: 'document-text-outline', label: 'Mes CV et documents', sous: 'Tous mes CV enregistrés' },
      { cle: 'candidatures', icone: 'paper-plane-outline', label: 'Mes candidatures', sous: 'Suivi de mes envois' },
      { cle: 'mon-activite', icone: 'pulse-outline', label: 'Mon activité', sous: 'Historique sur Facilité' },
      { cle: 'profil', icone: 'person-circle-outline', label: 'Profil complet', sous: 'Toutes les rubriques du profil' },
      { cle: 'candidat', icone: 'grid-outline', label: 'Espace candidat', sous: 'Tableau de bord complet' },
    ],
  },
  {
    titre: 'Outils et services',
    lignes: [
      { cle: 'creer-cv', icone: 'create-outline', label: 'Créer mon CV', sous: 'Éditeur et modèles' },
      { cle: 'modeles', icone: 'albums-outline', label: 'Modèles de CV', sous: 'Choisir un modèle' },
      { cle: 'importer-cv', icone: 'cloud-upload-outline', label: 'Importer mon CV', sous: 'Et diagnostic gratuit' },
      { cle: 'aide-candidature', icone: 'help-buoy-outline', label: 'Aide à la candidature', sous: 'Être accompagné' },
      { cle: 'fonctionnalites', icone: 'construct-outline', label: 'Outils PDF et documents', sous: 'Compresser, fusionner, diviser…' },
      { cle: 'concours', icone: 'ribbon-outline', label: 'Concours', sous: 'Concours et recrutements publics' },
      { cle: 'formations', icone: 'school-outline', label: 'Formations', sous: 'Se former' },
      { cle: 'recrutement-journalier', icone: 'today-outline', label: 'Recrutement journalier', sous: 'Missions du jour' },
      { cle: 'etablissements', icone: 'business-outline', label: 'Établissements', sous: 'Annuaire' },
      { cle: 'boite-a-idees', icone: 'bulb-outline', label: 'Boîte à idées', sous: 'Proposer une amélioration' },
      { cle: 'service', icone: 'briefcase-outline', label: 'Nos services', sous: 'Ce que propose Facilité' },
    ],
  },
  {
    titre: 'Informations',
    lignes: [
      { cle: 'faq', icone: 'help-circle-outline', label: 'Questions fréquentes', sous: 'FAQ' },
      { cle: 'conditions-utilisation', icone: 'reader-outline', label: "Conditions d'utilisation", sous: '' },
      { cle: 'confidentialite', icone: 'lock-closed-outline', label: 'Confidentialité', sous: 'Vos données personnelles' },
    ],
  },
];

const LIGNES_PRO: Ligne[] = [
  { cle: 'recruteur', icone: 'people-outline', label: 'Espace recruteur', sous: 'Publier et gérer mes offres' },
  { cle: 'admin', icone: 'construct-outline', label: 'Administration', sous: 'Gestion de la plateforme' },
];

export default function ParametresScreen() {
  const router = useRouter();
  const { role } = useAuth();

  const lignesPro = LIGNES_PRO.filter((l) =>
    l.cle === 'recruteur' ? role === 'publisher' || role === 'admin' : role === 'admin'
  );
  const groupes: Groupe[] = lignesPro.length ? [{ titre: 'Espaces professionnels', lignes: lignesPro }, ...GROUPES] : GROUPES;

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-2.5 px-4 py-3 bg-white border-b border-black/[0.06]">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            className="w-9 h-9 rounded-full bg-[#F2F0EA] items-center justify-center">
            <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
          </Pressable>
          <Text className="flex-1 text-[16px] font-extrabold text-[#1A1A1A]">Paramètres</Text>
        </View>

        <ScrollView contentContainerClassName="px-4 pt-4 pb-10 gap-5" showsVerticalScrollIndicator={false}>
          {groupes.map((g) => (
            <View key={g.titre}>
              <Text className="text-[11px] font-extrabold text-black/40 uppercase tracking-wider mb-2 px-1">{g.titre}</Text>
              <View className="bg-white rounded-2xl overflow-hidden">
                {g.lignes.map((l, i) => (
                  <Pressable
                    key={l.cle}
                    onPress={() => router.push(`/web/${l.cle}`)}
                    className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-black/[0.05]' : ''}`}>
                    <View className="w-9 h-9 rounded-[10px] bg-[#eef1fb] items-center justify-center">
                      <Ionicons name={l.icone} size={17} color="#2563EB" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13.5px] font-bold text-[#1A1A1A]">{l.label}</Text>
                      {l.sous ? <Text className="text-[11.5px] text-black/45 mt-0.5">{l.sous}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="rgba(0,0,0,0.3)" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
