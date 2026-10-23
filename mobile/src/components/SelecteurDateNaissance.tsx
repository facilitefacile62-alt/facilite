import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';

// Date de naissance en trois listes déroulantes (Jour, Mois, Année), comme sur Facebook — partagée par « Modifier le profil » (Locaux),
// l'inscription (« Comment t'appelles-tu ? ») et « Informations personnelles » (Facilité). Valeur : « AAAA-MM-JJ », ou « » si rien n'est choisi.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « AAAA-MM-JJ » valide (mois 1-12, jour existant dans ce mois, année plausible). */
export function dateValide(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (annee < 1900 || annee > new Date().getFullYear() || mois < 1 || mois > 12 || jour < 1) return false;
  return jour <= new Date(annee, mois, 0).getDate();
}

/** Date de naissance en trois listes déroulantes (Jour, Mois, Année), comme sur Facebook ; enregistrée sous la forme « AAAA-MM-JJ ». */
export default function SelecteurDateNaissance({ valeur, onChange, onFocus, onLayout }: { valeur: string; onChange: (v: string) => void; onFocus?: () => void; onLayout?: (e: LayoutChangeEvent) => void }) {
  const [a0, m0, j0] = valeur ? valeur.split('-') : ['', '', ''];
  const [jour, setJour] = useState(j0 ? String(Number(j0)) : '');
  const [mois, setMois] = useState(m0 ? String(Number(m0)) : '');
  const [annee, setAnnee] = useState(a0 && Number(a0) > 0 ? a0 : '');
  const [ouvert, setOuvert] = useState<'jour' | 'mois' | 'annee' | null>(null);

  function maj(j: string, m: string, a: string) {
    setJour(j);
    setMois(m);
    setAnnee(a);
    // Rien de choisi : valeur vide. Sinon la valeur composée (même incomplète : la validation à l'enregistrement la refuse).
    onChange(!j && !m && !a ? '' : `${(a || '0').padStart(4, '0')}-${(m || '0').padStart(2, '0')}-${(j || '0').padStart(2, '0')}`);
  }

  const anneeCourante = new Date().getFullYear();
  const choix: { cle: 'jour' | 'mois' | 'annee'; libelle: string; texte: string; flex: number; options: { valeur: string; texte: string }[] }[] = [
    { cle: 'jour', libelle: 'Jour', texte: jour, flex: 2, options: Array.from({ length: 31 }, (_, i) => ({ valeur: String(i + 1), texte: String(i + 1) })) },
    { cle: 'mois', libelle: 'Mois', texte: mois ? MOIS[Number(mois) - 1] : '', flex: 3, options: MOIS.map((nom, i) => ({ valeur: String(i + 1), texte: nom })) },
    { cle: 'annee', libelle: 'Année', texte: annee, flex: 2.4, options: Array.from({ length: anneeCourante - 1899 }, (_, i) => ({ valeur: String(anneeCourante - i), texte: String(anneeCourante - i) })) },
  ];
  const liste = choix.find((c) => c.cle === ouvert);

  return (
    <View className="bg-white rounded-[14px] px-3.5 pt-2.5 pb-3" style={{ borderWidth: 1.5, borderColor: '#0B3D2A' }} onLayout={onLayout}>
      <Text className="text-[11px] font-bold" style={{ color: '#047857' }}>Date de naissance</Text>
      <View className="flex-row gap-2.5 mt-2">
        {choix.map((c) => (
          <Pressable
            key={c.cle}
            onPress={() => {
              setOuvert((o) => (o === c.cle ? null : c.cle));
              onFocus?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${c.libelle} de naissance`}
            className="flex-row items-center justify-between rounded-xl px-3"
            style={{ flex: c.flex, height: 50, borderWidth: 1, borderColor: ouvert === c.cle ? '#1A1A1A' : 'rgba(0,0,0,0.15)', backgroundColor: '#fff' }}>
            <Text numberOfLines={1} className="flex-1 text-[14.5px]" style={{ color: c.texte ? '#1A1A1A' : 'rgba(0,0,0,0.45)', fontWeight: c.texte ? '700' : '600' }}>
              {c.texte || c.libelle}
            </Text>
            <Ionicons name={ouvert === c.cle ? 'chevron-up' : 'chevron-down'} size={18} color="#1A1A1A" />
          </Pressable>
        ))}
      </View>
      {liste ? (
        <View className="mt-2 rounded-xl overflow-hidden" style={{ maxHeight: 230, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#fff' }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {liste.options.map((o) => {
              const actif = o.valeur === (liste.cle === 'jour' ? jour : liste.cle === 'mois' ? mois : annee);
              return (
                <Pressable
                  key={o.valeur}
                  onPress={() => {
                    maj(liste.cle === 'jour' ? o.valeur : jour, liste.cle === 'mois' ? o.valeur : mois, liste.cle === 'annee' ? o.valeur : annee);
                    setOuvert(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                  className="px-4 justify-center"
                  style={{ height: 46, backgroundColor: actif ? '#ECFDF5' : '#fff' }}>
                  <Text className="text-[15px]" style={{ color: '#1A1A1A', fontWeight: actif ? '800' : '500' }}>{o.texte}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

