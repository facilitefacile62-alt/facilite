import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// Reproduction de design_handoff_facilite/pages/09-fonctionnalites.html —
// clair, avec son propre en-tête (pas FaciliteHeader ni la barre d'onglets :
// écran poussé depuis l'Extracteur/le menu profil). Liste d'outils
// statique — le mock ne fournit aucune source dynamique pour outilsList,
// et le web n'a pas non plus de table "outils" en base ; ce catalogue
// reflète les vraies fonctionnalités PDF/IA du dépôt (voir src/app/api/
// côté web : pdf2doc, extract-email, process-resume, diagnostic-cv,
// voice-assistant...). Seul "Extracteur 1-Clic" mène à un écran mobile
// réellement construit ; les autres affichent l'alerte honnête déjà
// utilisée ailleurs dans l'app en attendant leur propre point.
type TypeOutil = 'tous' | 'pdf' | 'ia';

type Outil = {
  id: string;
  type: 'pdf' | 'ia';
  icone: string;
  bg: string;
  titre: string;
  sous: string;
  ouvrir: (router: ReturnType<typeof useRouter>) => void;
};

const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

const OUTILS: Outil[] = [
  {
    id: 'compresser',
    type: 'pdf',
    icone: '📉',
    bg: '#E0E7FF',
    titre: 'Compresser un PDF',
    sous: 'Réduire la taille du fichier',
    ouvrir: () => BIENTOT('Compresser un PDF'),
  },
  {
    id: 'fusionner',
    type: 'pdf',
    icone: '📎',
    bg: '#DBEAFE',
    titre: 'Fusionner des PDF',
    sous: 'Combiner plusieurs documents',
    ouvrir: () => BIENTOT('Fusionner des PDF'),
  },
  {
    id: 'convertir',
    type: 'pdf',
    icone: '🔄',
    bg: '#D1FAE5',
    titre: 'Convertir PDF ↔ Word',
    sous: 'Éditer un CV ou une lettre',
    ouvrir: () => BIENTOT('Convertir PDF ↔ Word'),
  },
  {
    id: 'extraire_pages',
    type: 'pdf',
    icone: '✂️',
    bg: '#FEF3C7',
    titre: 'Extraire des pages',
    sous: "Isoler une partie d'un document",
    ouvrir: () => BIENTOT('Extraire des pages'),
  },
  {
    id: 'extracteur_ia',
    type: 'ia',
    icone: '⚡',
    bg: '#FEF3C7',
    titre: 'Extracteur 1-Clic',
    sous: "Candidature depuis une annonce",
    ouvrir: (router) => router.push('/extracteur'),
  },
  {
    id: 'diagnostic_cv',
    type: 'ia',
    icone: '📄',
    bg: '#D1FAE5',
    titre: 'Diagnostic CV Gratuit',
    sous: 'Analyse ATS et mots-clés',
    ouvrir: () => BIENTOT('Diagnostic CV'),
  },
  {
    id: 'assistant_vocal',
    type: 'ia',
    icone: '🎙️',
    bg: '#DBEAFE',
    titre: 'Assistant vocal',
    sous: 'Postuler en dictant',
    ouvrir: () => BIENTOT('Assistant vocal'),
  },
  {
    id: 'conseils_carriere',
    type: 'ia',
    icone: '💡',
    bg: '#EDE9FE',
    titre: 'Conseils carrière IA',
    sous: 'Orientation personnalisée',
    ouvrir: () => BIENTOT('Conseils carrière'),
  },
  {
    id: 'lettre_motivation',
    type: 'ia',
    icone: '✍️',
    bg: '#FCE7F3',
    titre: 'Générateur de lettre',
    sous: 'Lettre de motivation sur mesure',
    ouvrir: () => BIENTOT('Générateur de lettre'),
  },
];

const ONGLETS: { id: TypeOutil; label: string }[] = [
  { id: 'tous', label: 'Tous les outils' },
  { id: 'pdf', label: 'Outils PDF & Documents' },
  { id: 'ia', label: 'Outils IA & Carrière' },
];

export default function FonctionnalitesScreen() {
  const router = useRouter();
  const [ongletActif, setOngletActif] = useState<TypeOutil>('tous');

  const outilsAffiches = useMemo(
    () => (ongletActif === 'tous' ? OUTILS : OUTILS.filter((o) => o.type === ongletActif)),
    [ongletActif]
  );

  return (
    <View className="flex-1 bg-[#F2F0EA]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="bg-white border-b border-black/[0.06] px-4 py-3.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-[38px] h-[38px] rounded-xl bg-[#F2F0EA] items-center justify-center">
                <Text className="text-[17px]">🛠️</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-[16px] font-extrabold text-[#1A1A1A]">Fonctionnalités</Text>
                <View className="bg-[#E7E5E4] px-2 py-1 rounded-full">
                  <Text className="text-[10px] font-bold text-[#44403C]">OUTILS ACTIFS</Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => router.replace('/')}
              className="flex-row items-center gap-1.5 bg-[#F2F0EA] rounded-full px-3.5 py-2.5">
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M4 11L12 4L20 11V20H14V14H10V20H4V11Z" stroke="#1A1A1A" strokeWidth={1.8} strokeLinejoin="round" />
              </Svg>
              <Text className="text-[12.5px] font-bold text-[#1A1A1A]">Accueil</Text>
            </Pressable>
          </View>
        </View>

        <View className="bg-white px-4 pb-3.5">
          <View className="flex-row gap-1 bg-[#F2F0EA] rounded-full p-1">
            {ONGLETS.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setOngletActif(o.id)}
                className={`flex-1 py-2 rounded-full items-center ${
                  ongletActif === o.id ? 'bg-[#1A1A1A]' : ''
                }`}>
                <Text
                  className={`text-[11.5px] font-bold text-center ${
                    ongletActif === o.id ? 'text-white' : 'text-black/55'
                  }`}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FlatList
          data={outilsAffiches}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 py-3.5 gap-2.5"
          ItemSeparatorComponent={() => <View className="h-2.5" />}
          renderItem={({ item }) => <LigneOutil outil={item} onPress={() => item.ouvrir(router)} />}
        />

        <Pressable
          onPress={() => BIENTOT('Assistant vocal')}
          className="absolute right-4 bottom-4 w-[52px] h-[52px] rounded-full overflow-hidden shadow-lg">
          <LinearGradient colors={['#10B981', '#0ea975']} className="w-full h-full items-center justify-center">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M9 3H15V14A3 3 0 0 1 9 14V3Z" stroke="#fff" strokeWidth={1.8} />
              <Path d="M6 11V12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12V11" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
              <Path d="M12 18V21" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function LigneOutil({ outil, onPress }: { outil: Outil; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="bg-white rounded-2xl p-3 flex-row items-center gap-3">
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: outil.bg }}>
        <Text className="text-[18px]">{outil.icone}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[14px] font-bold text-[#1A1A1A]">{outil.titre}</Text>
        <Text className="text-[12px] text-black/45 mt-0.5">{outil.sous}</Text>
      </View>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M9 5L16 12L9 19" stroke="rgba(0,0,0,0.3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}
