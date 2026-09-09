import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useAuth } from '@/context/AuthContext';
import { resolveSupportConversation } from '@/lib/messages';

// Reproduction de design_handoff_facilite/pages/08-menu-profil.html.
//
// menuSearchOpen : le handoff exprime la paire "en-tête recherche" /
// "en-tête normal" via DEUX sc-if sur la MÊME variable avec des hints par
// défaut contradictoires (false puis true) — artefact d'export du même
// type que les paires isCandidateSpace/notCandidateSpace plus bas dans ce
// fichier. Traité ici comme un simple booléen à deux états, pas deux
// conditions indépendantes.
//
// menuShortcuts : le mock ne fournit pas de données d'exemple pour ce
// sc-for (aucune cible précisée). Les 10 raccourcis ci-dessous pointent
// vers les écrans réellement disponibles à ce stade du dépôt (onglets +
// Aide/Assistance qui rouvre le Support déjà câblé au Point A) ; les
// autres (Candidature Spontanée, Fonctionnalités, Recherche, Diagnostic
// CV) arrivent aux points suivants de la feuille de route — alerte
// honnête en attendant, comme le reste des raccourcis non câblés de
// l'app (cf. FaciliteHeader, messages.tsx).
type Raccourci = {
  id: string;
  icone: string;
  bg: string;
  titre: string;
  sous: string;
  action: (ctx: { router: ReturnType<typeof useRouter>; ouvrirSupport: () => void; fermer: () => void }) => void;
};

const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

const RACCOURCIS: Raccourci[] = [
  {
    id: 'extracteur',
    icone: '⚡',
    bg: '#FEF3C7',
    titre: 'Extracteur IA',
    sous: 'Candidature depuis une annonce',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/extracteur');
    },
  },
  {
    id: 'offres',
    icone: '💼',
    bg: '#DBEAFE',
    titre: "Offres d'emploi",
    sous: 'Catalogue complet',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/offres');
    },
  },
  {
    id: 'messages',
    icone: '💬',
    bg: '#D1FAE5',
    titre: 'Messages',
    sous: 'Discussions et support',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/messages');
    },
  },
  {
    id: 'profil',
    icone: '👤',
    bg: '#E5E7EB',
    titre: 'Mon profil',
    sous: 'Informations et documents',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/profil');
    },
  },
  {
    id: 'notifications',
    icone: '🔔',
    bg: '#FEE2E2',
    titre: 'Notifications',
    sous: 'Alertes et mises à jour',
    action: ({ fermer }) => {
      fermer();
      BIENTOT('Notifications');
    },
  },
  {
    id: 'aide',
    icone: '❓',
    bg: '#DBEAFE',
    titre: 'Aide & Assistance',
    sous: 'Discuter avec le support',
    action: ({ fermer, ouvrirSupport }) => {
      fermer();
      ouvrirSupport();
    },
  },
  {
    id: 'candidature_spontanee',
    icone: '📇',
    bg: '#EDE9FE',
    titre: 'Candidature Spontanée',
    sous: 'Répertoire des entreprises',
    action: () => BIENTOT('Candidature Spontanée'),
  },
  {
    id: 'fonctionnalites',
    icone: '🛠️',
    bg: '#F3F4F6',
    titre: 'Fonctionnalités',
    sous: 'Tous les outils',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/fonctionnalites');
    },
  },
  {
    id: 'recherche',
    icone: '🔍',
    bg: '#DBEAFE',
    titre: 'Recherche',
    sous: 'Offres, entreprises...',
    action: ({ router, fermer }) => {
      fermer();
      router.push('/recherche');
    },
  },
  {
    id: 'diagnostic_cv',
    icone: '📄',
    bg: '#D1FAE5',
    titre: 'Diagnostic CV Gratuit',
    sous: 'Analyse IA de votre CV',
    action: () => BIENTOT('Diagnostic CV'),
  },
];

export default function PanneauMenuProfil({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [espaceActif, setEspaceActif] = useState<'candidat' | 'business'>('candidat');

  async function ouvrirSupport() {
    if (!user?.id) return;
    const resolu = await resolveSupportConversation(user.id);
    if (resolu) {
      router.push(`/chat/${resolu.conversationId}`);
    } else {
      Alert.alert('Support RH Facilité', "Impossible d'ouvrir la discussion pour le moment.");
    }
  }

  function selectionnerBusiness() {
    Alert.alert('Facilite Business', "L'espace vendeur & marketplace arrive dans une prochaine mise à jour.");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onFermer}>
      <View className="flex-1 bg-[#F2F0EA]">
        {rechercheOuverte ? (
          <View className="flex-row items-center gap-2.5 px-4 py-3.5 bg-white border-b border-black/[0.06]">
            <View className="flex-1 flex-row items-center gap-2 border-[1.5px] border-[#1A1A1A] rounded-full px-3.5 py-2.5">
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Circle cx={10.5} cy={10.5} r={6.5} stroke="#1A1A1A" strokeWidth={1.8} />
                <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
              <TextInput
                placeholder="Rechercher une offre, une entreprise..."
                placeholderTextColor="rgba(0,0,0,0.4)"
                className="flex-1 text-[13px] text-[#1A1A1A]"
              />
            </View>
            <Pressable onPress={() => setRechercheOuverte(false)}>
              <Text className="text-[13px] font-bold text-red-600">Annuler ×</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <Pressable onPress={onFermer} className="flex-row items-center gap-1.5">
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M15 5L8 12L15 19" stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Menu</Text>
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setRechercheOuverte(true)}
                className="w-8 h-8 rounded-full bg-white items-center justify-center">
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Circle cx={10.5} cy={10.5} r={6.5} stroke="#1A1A1A" strokeWidth={1.8} />
                  <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Pressable onPress={onFermer} className="w-8 h-8 rounded-full bg-white items-center justify-center">
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Line x1={5} y1={5} x2={19} y2={19} stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={19} y1={5} x2={5} y2={19} stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          </View>
        )}

        <ScrollView className="flex-1 px-3.5" contentContainerClassName="pb-6">
          <View className="bg-white rounded-2xl p-3.5 mt-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10.5px] font-bold tracking-wider text-black/40">VOS ESPACES</Text>
              <Text className="text-[12px] font-bold text-emerald-500">
                Mode {espaceActif === 'candidat' ? 'Candidat' : 'Business'}
              </Text>
            </View>

            <Pressable onPress={() => setEspaceActif('candidat')} className="flex-row items-center gap-3 py-3">
              <View className="w-[38px] h-[38px] rounded-full bg-blue-600 items-center justify-center">
                <Text className="text-white font-bold text-[14px]">
                  {(profile?.full_name || 'FD').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]" numberOfLines={1}>
                  {profile?.full_name || 'Mon compte'}
                </Text>
                <Text className="text-[11.5px] text-black/45">Espace Candidature & CV</Text>
              </View>
              {espaceActif === 'candidat' ? (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={9} stroke="#10B981" strokeWidth={1.8} />
                  <Path d="M8 12L11 15L16 9" stroke="#10B981" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <Text className="text-[12px] font-semibold text-black/40">Basculer →</Text>
              )}
            </Pressable>

            <Pressable
              onPress={selectionnerBusiness}
              className="flex-row items-center gap-3 py-3 border-t border-black/[0.06]">
              <View className="w-[38px] h-[38px] rounded-full bg-[#1d2547] items-center justify-center">
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 8L12 3L20 8V20H4V8Z" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
                  <Path d="M9 20V13H15V20" stroke="#fff" strokeWidth={1.6} />
                </Svg>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[13.5px] font-bold text-[#1A1A1A]">Facilite Business</Text>
                <Text className="text-[11.5px] text-black/45">Espace Vendeur & Marketplace</Text>
              </View>
              <Text className="text-[12px] font-semibold text-black/40">Basculer →</Text>
            </Pressable>

            <View className="flex-row gap-4 mt-1 pt-3 border-t border-black/[0.06]">
              <Pressable
                onPress={() => {
                  onFermer();
                  router.push('/profil');
                }}>
                <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">📄 Gérer mon profil</Text>
              </Pressable>
              <Pressable onPress={() => BIENTOT('Ma boutique')}>
                <Text className="text-[12.5px] font-semibold text-[#1A1A1A]">🔗 Ma boutique</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => BIENTOT('Diagnostic CV')} className="rounded-2xl p-4 mt-3 relative overflow-hidden">
            <View className="absolute inset-0 bg-[#1d2547]" />
            <View className="absolute top-3.5 right-3.5 bg-emerald-500 px-2.5 py-0.5 rounded-full">
              <Text className="text-white text-[9.5px] font-bold">GRATUIT</Text>
            </View>
            <Text className="text-white text-[14.5px] font-extrabold">Diagnostic CV Gratuit</Text>
            <Text className="text-white/70 text-[12px] leading-5 mt-1.5 max-w-[88%]">
              Importez votre CV pour obtenir une analyse IA complète de votre score ATS et vos mots-clés.
            </Text>
            <View className="mt-3 bg-emerald-500 rounded-full py-3 items-center">
              <Text className="text-white text-[13px] font-bold">🔍 Diagnostiquer mon CV</Text>
            </View>
          </Pressable>

          <Text className="text-[11px] font-bold tracking-wider text-black/40 mt-4 mb-2.5 ml-1">
            TOUS LES RACCOURCIS
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {RACCOURCIS.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => r.action({ router, ouvrirSupport, fermer: onFermer })}
                className="bg-white rounded-2xl p-3 gap-4"
                style={{ width: '47.5%' }}>
                <View className="w-8 h-8 rounded-[9px] items-center justify-center" style={{ backgroundColor: r.bg }}>
                  <Text className="text-[15px]">{r.icone}</Text>
                </View>
                <View>
                  <Text className="text-[12.5px] font-bold text-[#1A1A1A]">{r.titre}</Text>
                  <Text className="text-[11px] text-black/45 mt-0.5">{r.sous}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View className="gap-2 mt-3.5">
            <Pressable
              onPress={() => BIENTOT('Paramètres et langue')}
              className="bg-white rounded-2xl px-4 py-3.5 flex-row items-center justify-between">
              <Text className="text-[13.5px] font-bold text-[#1A1A1A]">⚙ Paramètres et langue</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9L12 15L18 9" stroke="rgba(0,0,0,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => {
                onFermer();
                ouvrirSupport();
              }}
              className="bg-white rounded-2xl px-4 py-3.5 flex-row items-center justify-between">
              <Text className="text-[13.5px] font-bold text-[#1A1A1A]">❓ Aide et assistance</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M6 9L12 15L18 9" stroke="rgba(0,0,0,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Déconnexion',
                    style: 'destructive',
                    onPress: () => {
                      onFermer();
                      signOut();
                    },
                  },
                ])
              }
              className="bg-white rounded-2xl px-4 py-3.5">
              <Text className="text-[13.5px] font-bold text-red-600">↪ Déconnexion</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
