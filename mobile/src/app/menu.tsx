import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { resolveSupportConversation } from '@/lib/messages';
import { SPONTANEOUS_COMPANIES } from '@/lib/spontaneousData';
import { definirUserMode } from '@/lib/userMode';
import { chargerMesBoutiques } from '@/lib/vendeur';

// Menu (maquettes 10 et 11) : une PAGE et non plus une fenêtre par-dessus
// l'app, pour que la barre du bas de Facilité reste visible (charte §1.1) et
// que « ‹ Menu » revienne à l'écran d'origine par l'historique.
//
// Le mode recherche (11) remplace l'en-tête par un champ « Rechercher une
// offre, une entreprise… » ; valider ouvre la recherche avec ce texte.
//
// « Basculer » : le second espace est la boutique du compte (son nom) ou
// « Créer sa propre boutique » si le compte n'en a pas encore.
const FOND = '#F0EEE8';
const VERT = '#10B981';
const BLEU = '#2563EB';

type Tag = { texte: string; fond: string; couleur: string };
type Raccourci = {
  id: string;
  icone: keyof typeof Ionicons.glyphMap;
  teinte: string;
  couleurIcone: string;
  titre: string;
  sous: string;
  tag?: Tag;
  route?: string;
  support?: boolean;
};

const NB_ENTREPRISES = SPONTANEOUS_COMPANIES.length;

const RACCOURCIS: Raccourci[] = [
  { id: 'fonctionnalites', icone: 'hammer-outline', teinte: '#EDE7FB', couleurIcone: '#7C3AED', titre: 'Fonctionnalités', sous: 'Tous les outils & modèles', tag: { texte: 'TOUS', fond: '#E5E7EB', couleur: '#4B5563' }, route: '/fonctionnalites' },
  { id: 'messages', icone: 'chatbubble-ellipses-outline', teinte: '#EDE7FB', couleurIcone: '#7C3AED', titre: 'Messages', sous: 'Échanges directs', route: '/messages' },
  { id: 'offres', icone: 'briefcase', teinte: '#D1FAE5', couleurIcone: '#B91C1C', titre: "Offres d'emploi", sous: 'Catalogue complet', tag: { texte: 'LIVE', fond: '#D1FAE5', couleur: '#047857' }, route: '/offres' },
  { id: 'candidature_spontanee', icone: 'business', teinte: '#DBEAFE', couleurIcone: '#1D4ED8', titre: 'Candidature Spontanée', sous: 'Répertoire des entreprises', tag: { texte: `${NB_ENTREPRISES} ENTR.`, fond: '#DBEAFE', couleur: '#1D4ED8' }, route: '/candidature-spontanee' },
  { id: 'extracteur', icone: 'flash', teinte: '#FEF3C7', couleurIcone: '#D97706', titre: 'Extracteur IA', sous: 'Candidature depuis une annonce', route: '/extracteur' },
  { id: 'profil', icone: 'person', teinte: '#E5E7EB', couleurIcone: '#4B5563', titre: 'Mon profil', sous: 'Informations et documents', route: '/profil' },
  { id: 'aide', icone: 'help-circle', teinte: '#DBEAFE', couleurIcone: '#1D4ED8', titre: 'Aide & Assistance', sous: 'Discuter avec le support', support: true },
  { id: 'marketplace', icone: 'storefront', teinte: '#D1FAE5', couleurIcone: '#047857', titre: 'Marketplace', sous: 'Acheter et vendre', route: '/marketplace' },
  { id: 'ma_boutique', icone: 'bag-handle', teinte: '#FEF3C7', couleurIcone: '#D97706', titre: 'Ma boutique', sous: 'Publier et gérer mes articles', route: '/marketplace/vendre' },
  { id: 'recherche', icone: 'search', teinte: '#DBEAFE', couleurIcone: '#1D4ED8', titre: 'Recherche', sous: 'Offres, entreprises...', route: '/recherche' },
  { id: 'diagnostic_cv', icone: 'document-text', teinte: '#D1FAE5', couleurIcone: '#047857', titre: 'Diagnostic CV Gratuit', sous: 'Analyse IA de votre CV', route: '/web/importer-cv' },
];

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [terme, setTerme] = useState('');
  const [espaceActif, setEspaceActif] = useState<'candidat' | 'business'>('candidat');
  const [nomBoutique, setNomBoutique] = useState<string | null | undefined>(undefined);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let annule = false;
    chargerMesBoutiques(userId)
      .then((b) => {
        if (!annule) setNomBoutique(b[0]?.nom ?? null);
      })
      .catch(() => {
        if (!annule) setNomBoutique(null);
      });
    return () => {
      annule = true;
    };
  }, [userId]);

  function retour() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function ouvrirSupport() {
    if (!userId) return;
    const resolu = await resolveSupportConversation(userId);
    if (resolu) router.push(`/chat/${resolu.conversationId}`);
    else Alert.alert('Support RH Facilité', "Impossible d'ouvrir la discussion pour le moment.");
  }

  function basculerBoutique() {
    setEspaceActif('business');
    definirUserMode('business').catch(() => {});
    router.push('/marketplace/vendre');
  }

  function lancerRecherche() {
    const q = terme.trim();
    router.push((q ? `/recherche?q=${encodeURIComponent(q)}` : '/recherche') as Href);
  }

  function confirmerDeconnexion() {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const nom = (profile?.full_name as string | undefined) || 'Mon compte';
  const initiales = nom.slice(0, 2).toUpperCase();

  return (
    <View className="flex-1" style={{ backgroundColor: FOND }}>
      <View style={{ paddingTop: insets.top }}>
        {rechercheOuverte ? (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 flex-row items-center gap-2.5 bg-white" style={{ height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#1A1A1A', paddingHorizontal: 16 }}>
              <Ionicons name="search" size={16} color="#1A1A1A" />
              <TextInput
                value={terme}
                onChangeText={setTerme}
                onSubmitEditing={lancerRecherche}
                autoFocus
                returnKeyType="search"
                placeholder="Rechercher une offre, une entreprise..."
                placeholderTextColor="rgba(0,0,0,0.45)"
                style={[{ flex: 1, fontSize: 14, color: '#1A1A1A' }, { outlineStyle: 'none' } as object]}
              />
            </View>
            <Pressable
              onPress={() => {
                setRechercheOuverte(false);
                setTerme('');
              }}>
              <Text className="text-[14px] font-extrabold" style={{ color: '#DC2626' }}>Annuler ×</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable onPress={retour} accessibilityLabel="Retour" className="flex-row items-center gap-2">
              <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
              <Text className="text-[20px] font-black text-[#1A1A1A]">Menu</Text>
            </Pressable>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => setRechercheOuverte(true)} accessibilityLabel="Rechercher" className="items-center justify-center bg-white" style={{ width: 40, height: 40, borderRadius: 20 }}>
                <Ionicons name="search" size={17} color="#1A1A1A" />
              </Pressable>
              <Pressable onPress={retour} accessibilityLabel="Fermer" className="items-center justify-center bg-white" style={{ width: 40, height: 40, borderRadius: 20 }}>
                <Ionicons name="close" size={19} color="#1A1A1A" />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Vos espaces */}
        <View className="bg-white" style={{ borderRadius: 20, padding: 14, marginTop: 6 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[11.5px] font-extrabold" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>VOS ESPACES</Text>
            <Text className="text-[13px] font-extrabold" style={{ color: VERT }}>Mode {espaceActif === 'candidat' ? 'Candidat' : 'Business'}</Text>
          </View>

          <Pressable
            onPress={() => setEspaceActif('candidat')}
            className="flex-row items-center gap-3 mt-3"
            style={{ backgroundColor: espaceActif === 'candidat' ? FOND : 'transparent', borderRadius: 14, padding: 10 }}>
            <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#EFEDE7' }}>
              <Text className="text-[14px] font-extrabold" style={{ color: 'rgba(0,0,0,0.35)' }}>{initiales}</Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={1}>{nom}</Text>
              <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>Espace Candidat & CV</Text>
            </View>
            {espaceActif === 'candidat' ? <Ionicons name="checkmark-circle-outline" size={22} color={VERT} /> : <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>Basculer →</Text>}
          </Pressable>

          <Pressable onPress={basculerBoutique} className="flex-row items-center gap-3" style={{ padding: 10 }}>
            <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#EFEDE7' }}>
              <Ionicons name="storefront-outline" size={19} color="rgba(0,0,0,0.35)" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[16px] font-black text-[#1A1A1A]" numberOfLines={1}>{nomBoutique || 'Créer sa propre boutique'}</Text>
              <Text className="text-[12.5px]" style={{ color: 'rgba(0,0,0,0.5)' }} numberOfLines={1}>Espace Vendeur & Marketplace</Text>
            </View>
            <Text className="text-[12.5px] font-bold" style={{ color: 'rgba(0,0,0,0.45)' }}>↻ Basculer →</Text>
          </Pressable>

          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
          <View className="flex-row items-center justify-between px-2.5 py-1.5">
            <Pressable onPress={() => router.navigate('/')} className="flex-row items-center gap-2">
              <Ionicons name="id-card-outline" size={18} color={VERT} />
              <Text className="text-[15px] font-black" style={{ color: VERT }}>Facilité</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/marketplace')} className="flex-row items-center gap-2">
              <Ionicons name="storefront" size={18} color={BLEU} />
              <Text className="text-[15px] font-black" style={{ color: BLEU }}>Marketplace</Text>
            </Pressable>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 }} />
          <Pressable onPress={confirmerDeconnexion} className="flex-row items-center gap-2 px-2.5 py-1.5">
            <Ionicons name="log-out-outline" size={17} color="#DC2626" />
            <Text className="text-[14px] font-black" style={{ color: '#DC2626' }}>Se déconnecter</Text>
          </Pressable>
        </View>

        {/* Diagnostic CV */}
        <View style={{ backgroundColor: '#161B3A', borderRadius: 20, padding: 18, marginTop: 14 }}>
          <View className="flex-row items-start justify-between">
            <Text className="text-[17px] font-black text-white">Diagnostic CV Gratuit</Text>
            <View style={{ backgroundColor: VERT, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text className="text-[10.5px] font-black text-white">GRATUIT</Text>
            </View>
          </View>
          <Text className="text-[13.5px] mt-2" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 20 }}>
            Importez votre CV pour obtenir une analyse IA complète de votre score ATS et vos mots-clés.
          </Text>
          <Pressable
            onPress={() => router.push('/web/importer-cv' as Href)}
            className="items-center justify-center mt-4"
            style={{ backgroundColor: '#F3FBF7', borderRadius: 14, borderWidth: 1.5, borderColor: '#34D399', height: 52 }}>
            <Text className="text-[14.5px] font-black text-[#1A1A1A]">🔍 Diagnostiquer mon CV</Text>
          </Pressable>
        </View>

        <Text className="text-[12px] font-extrabold mt-5 mb-3 ml-1" style={{ color: 'rgba(0,0,0,0.45)', letterSpacing: 0.6 }}>TOUS LES RACCOURCIS</Text>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {RACCOURCIS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => (r.support ? ouvrirSupport() : router.push(r.route as Href))}
              className="bg-white"
              style={{ width: '48%', borderRadius: 18, padding: 14, minHeight: 120, justifyContent: 'space-between' }}>
              <View className="flex-row items-start justify-between">
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: r.teinte }}>
                  <Ionicons name={r.icone} size={19} color={r.couleurIcone} />
                </View>
                {r.tag ? (
                  <View style={{ backgroundColor: r.tag.fond, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text className="text-[10px] font-black" style={{ color: r.tag.couleur }}>{r.tag.texte}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ marginTop: 18 }}>
                <Text className="text-[14.5px] font-black text-[#1A1A1A]">{r.titre}</Text>
                <Text className="text-[12px] mt-0.5" style={{ color: 'rgba(0,0,0,0.5)' }}>{r.sous}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View className="gap-2.5 mt-4">
          <Pressable onPress={() => router.push('/mon-profil/parametres')} className="bg-white flex-row items-center justify-between" style={{ borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15 }}>
            <Text className="text-[14.5px] font-black text-[#1A1A1A]">⚙ Paramètres et langue</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.4)" />
          </Pressable>
          <Pressable onPress={ouvrirSupport} className="bg-white flex-row items-center justify-between" style={{ borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15 }}>
            <Text className="text-[14.5px] font-black text-[#1A1A1A]">❓ Aide et assistance</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.4)" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
