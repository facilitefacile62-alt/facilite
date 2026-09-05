import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BadgeMatchingOffre from '@/components/BadgeMatchingOffre';

// Fil d'actualité natif — reproduit la mise en page réelle de ffacilite.com
// (en-tête, stories de modèles, cartes d'offres, barre d'action) en thème
// sombre dédié avec l'accent Bleu Roi validé pour l'app mobile. Données de
// démonstration : le branchement sur les vraies offres (table job_offers)
// suit au point Supabase.
type Offre = {
  id: string;
  entreprise: string;
  via?: string;
  logoTeinte: string;
  logoInitiales: string;
  date: string;
  titre: string;
  localisation: string;
  contrat: string;
  posterUri?: string;
  // Similarité 0..1 (match_job_offers) — démo ici, branchement réel prévu
  // avec les vraies offres (voir commentaire de fichier ci-dessus).
  matchScore?: number;
};

const OFFRES: Offre[] = [
  {
    id: '1',
    entreprise: 'Challenge 2000 SARL',
    via: 'C2K Staffing SARL',
    logoTeinte: 'bg-amber-500',
    logoInitiales: 'C2',
    date: '03/09/2026',
    titre: 'Opérateur Polyvalent — Conducteur de Bétonnière & Tractopelle',
    localisation: 'Thiès, Sénégal',
    contrat: 'Plein Temps',
    // Offre réelle et publique, publiée sur ffacilite.com — affiche réelle
    // du bucket public "job-offers", pas une image inventée.
    posterUri:
      'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788440280838-0.jpg',
  },
  {
    id: '2',
    entreprise: 'Teranga Digital',
    logoTeinte: 'bg-blue-500',
    logoInitiales: 'TD',
    date: '02/09/2026',
    titre: 'Développeur Full Stack',
    localisation: 'Dakar, Plateau',
    contrat: 'CDI',
    matchScore: 0.88,
  },
  {
    id: '3',
    entreprise: 'Clinique Pasteur',
    logoTeinte: 'bg-emerald-500',
    logoInitiales: 'CP',
    date: '01/09/2026',
    titre: "Infirmier(e) diplômé(e) d'État",
    localisation: 'Dakar, Fann',
    contrat: 'CDI',
    matchScore: 0.58,
  },
];

const MODELES: { id: string; label: string; teinte: string }[] = [
  { id: 'moderne', label: 'Moderne', teinte: 'bg-blue-500' },
  { id: 'minimaliste', label: 'Minimaliste', teinte: 'bg-emerald-500' },
  { id: 'classique', label: 'Classique', teinte: 'bg-amber-500' },
];

type NavItem = {
  id: string;
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

const NAV_RAPIDE: NavItem[] = [
  { id: 'accueil', label: 'Accueil', icone: 'home' },
  { id: 'offres', label: 'Offres', icone: 'briefcase-outline' },
  { id: 'messages', label: 'Messages', icone: 'chatbubble-outline' },
  { id: 'notifications', label: 'Notifs', icone: 'notifications-outline', badge: 2 },
];

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-[#0B0F17]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 pt-1 pb-3">
          <Text className="text-lg font-extrabold text-blue-500">Facilité</Text>
          <View className="flex-row items-center gap-3">
            <Pressable className="w-9 h-9 rounded-full bg-[#161E2E] items-center justify-center">
              <Ionicons name="notifications-outline" size={16} color="#94a3b8" />
              <View className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </Pressable>
            <View className="w-9 h-9 rounded-full bg-amber-500 items-center justify-center">
              <Text className="text-xs font-extrabold text-white">A</Text>
            </View>
          </View>
        </View>

        <View className="flex-row justify-around border-b border-[#1B2434] pb-3 mb-1 px-2">
          {NAV_RAPIDE.map((item) => (
            <Pressable key={item.id} className="items-center gap-1">
              <View>
                <Ionicons
                  name={item.icone}
                  size={19}
                  color={item.id === 'accueil' ? '#2563EB' : '#94a3b8'}
                />
                {item.badge ? (
                  <View className="absolute -top-1 -right-2 min-w-[13px] h-[13px] px-0.5 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-[8px] font-bold text-white">{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={`text-[9.5px] font-semibold ${
                  item.id === 'accueil' ? 'text-blue-500' : 'text-gray-500'
                }`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={OFFRES}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={
            <View className="mb-4">
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2.5 mt-1">
                Modèles de CV
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                {MODELES.map((modele) => (
                  <View key={modele.id} className="items-center mx-2 w-16">
                    <View
                      className={`w-14 h-14 rounded-full ${modele.teinte} items-center justify-center border-2 border-[#0B0F17]`}>
                      <Ionicons name="document-text-outline" size={20} color="#ffffff" />
                    </View>
                    <Text className="text-[10px] font-semibold text-gray-300 mt-1.5" numberOfLines={1}>
                      {modele.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => <CarteOffre offre={item} />}
        />
      </SafeAreaView>
    </View>
  );
}

function CarteOffre({ offre }: { offre: Offre }) {
  return (
    <View className="bg-[#161E2E] rounded-2xl border border-[#232D40] p-3.5">
      <View className="flex-row items-center gap-2.5 mb-3">
        <View className={`w-9 h-9 rounded-xl ${offre.logoTeinte} items-center justify-center`}>
          <Text className="text-[11px] font-extrabold text-white">{offre.logoInitiales}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[12.5px] font-bold text-white" numberOfLines={1}>
            {offre.entreprise}
            {offre.via ? ` (via ${offre.via})` : ''}
          </Text>
          <Text className="text-[10.5px] text-gray-500">{offre.date}</Text>
        </View>
      </View>

      <BadgeMatchingOffre score={offre.matchScore} />

      <Text className="text-[14.5px] font-bold text-white leading-5 mb-2">{offre.titre}</Text>

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        <View className="flex-row items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded-full">
          <Ionicons name="location-outline" size={11} color="#94a3b8" />
          <Text className="text-[10.5px] font-medium text-gray-400">{offre.localisation}</Text>
        </View>
        <View className="flex-row items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded-full">
          <Ionicons name="briefcase-outline" size={11} color="#94a3b8" />
          <Text className="text-[10.5px] font-medium text-gray-400">{offre.contrat}</Text>
        </View>
      </View>

      {offre.posterUri ? (
        <Image
          source={{ uri: offre.posterUri }}
          alt={`Affiche de l'offre : ${offre.titre}`}
          contentFit="cover"
          transition={150}
          className="w-full h-48 rounded-xl bg-[#0B0F17] mb-3.5"
        />
      ) : (
        <View className="rounded-xl bg-[#0B0F17] border border-dashed border-[#232D40] h-36 items-center justify-center mb-3.5">
          <Ionicons name="image-outline" size={22} color="#3d4a61" />
          <Text className="text-[10px] font-medium text-gray-600 mt-1">Affiche du recrutement</Text>
        </View>
      )}

      <Pressable className="flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3 mb-2.5">
        <Ionicons name="send" size={14} color="#ffffff" />
        <Text className="text-[13px] font-bold text-white">Postuler via Facilité</Text>
      </Pressable>

      <View className="flex-row items-center justify-around pt-1">
        <Pressable className="py-1 px-4">
          <Ionicons name="thumbs-up-outline" size={15} color="#94a3b8" />
        </Pressable>
        <Pressable className="py-1 px-4">
          <Ionicons name="share-social-outline" size={15} color="#94a3b8" />
        </Pressable>
        <Pressable className="py-1 px-4">
          <Ionicons name="bookmark-outline" size={15} color="#94a3b8" />
        </Pressable>
      </View>
    </View>
  );
}
