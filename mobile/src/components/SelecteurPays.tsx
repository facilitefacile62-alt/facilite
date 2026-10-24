import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

// Pays en menu déroulant. Le Sénégal d'abord, puis l'Afrique de l'Ouest et du reste du continent, puis les autres pays les plus fréquents
// pour la diaspora. La valeur enregistrée est le nom du pays en français (profiles.country, texte libre).
export const PAYS = [
  'Sénégal', 'Mali', 'Mauritanie', 'Guinée', 'Guinée-Bissau', 'Gambie', "Côte d'Ivoire", 'Burkina Faso', 'Niger', 'Togo', 'Bénin', 'Nigeria', 'Ghana',
  'Cap-Vert', 'Sierra Leone', 'Liberia', 'Cameroun', 'Gabon', 'Congo', 'République démocratique du Congo', 'Tchad', 'Centrafrique', 'Guinée équatoriale',
  'Maroc', 'Algérie', 'Tunisie', 'Libye', 'Égypte', 'Soudan', 'Éthiopie', 'Kenya', 'Tanzanie', 'Ouganda', 'Rwanda', 'Burundi', 'Angola', 'Mozambique',
  'Madagascar', 'Maurice', 'Afrique du Sud', 'Zambie', 'Zimbabwe', 'Namibie', 'Botswana',
  'France', 'Belgique', 'Suisse', 'Luxembourg', 'Allemagne', 'Italie', 'Espagne', 'Portugal', 'Royaume-Uni', 'Irlande', 'Pays-Bas', 'Suède', 'Norvège',
  'Canada', 'États-Unis', 'Brésil', 'Mexique', 'Haïti',
  'Arabie saoudite', 'Émirats arabes unis', 'Qatar', 'Liban', 'Turquie', 'Chine', 'Inde', 'Japon', 'Corée du Sud', 'Australie',
];

/** Menu déroulant des pays ; `valeur` vide = rien de choisi. Une valeur déjà enregistrée hors liste est conservée et affichée. */
export default function SelecteurPays({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const options = valeur && !PAYS.includes(valeur) ? [valeur, ...PAYS] : PAYS;
  return (
    <View>
      <Pressable
        onPress={() => setOuvert((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Choisir le pays"
        className="flex-row items-center justify-between rounded-xl px-3.5"
        style={{ height: 50, borderWidth: 1.5, borderColor: '#0B3D2A', backgroundColor: '#fff' }}>
        <Text numberOfLines={1} className="flex-1 text-[14.5px]" style={{ color: valeur ? '#1A1A1A' : 'rgba(0,0,0,0.45)', fontWeight: valeur ? '700' : '600' }}>
          {valeur || 'Choisir un pays'}
        </Text>
        <Ionicons name={ouvert ? 'chevron-up' : 'chevron-down'} size={18} color="#1A1A1A" />
      </Pressable>
      {ouvert ? (
        <View className="mt-2 rounded-xl overflow-hidden" style={{ maxHeight: 260, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#fff' }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            {options.map((p) => {
              const actif = p === valeur;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    onChange(p);
                    setOuvert(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  className="px-4 justify-center"
                  style={{ height: 46, backgroundColor: actif ? '#ECFDF5' : '#fff' }}>
                  <Text className="text-[15px]" style={{ color: '#1A1A1A', fontWeight: actif ? '800' : '500' }}>{p}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
