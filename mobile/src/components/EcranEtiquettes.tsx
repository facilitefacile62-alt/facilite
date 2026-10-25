import { Text, View } from 'react-native';

import EcranRubriqueCv from '@/components/EcranRubriqueCv';
import { useAuth } from '@/context/AuthContext';
import { listeTexte } from '@/lib/profilChamps';
import { rubriquesReelles } from '@/lib/rubriquesCvLogique';

// Écran à étiquettes, partagé par « Compétences » (maquette 52) et « Centres d'intérêt » (maquette 53), en LECTURE SEULE : ces listes viennent du CV
// scanné ou importé (colonnes `profiles.skills` et `profiles.interests`, de simples tableaux de chaînes). Les compétences d'exemple de la base
// (« Gestion de projet », « Développement Web », « Stratégie Digitale ») ne sont jamais affichées : ce ne sont pas des données de la personne.
export default function EcranEtiquettes({ titre, champ }: { titre: string; champ: 'skills' | 'interests' }) {
  const { profile } = useAuth();
  const etiquettes = listeTexte(rubriquesReelles(profile)[champ]);

  return (
    <EcranRubriqueCv titre={titre} cle={champ} vide={etiquettes.length === 0}>
      <View className="mx-4 bg-white rounded-2xl p-3.5">
        <View className="flex-row flex-wrap gap-2">
          {etiquettes.map((e) => (
            <View key={e} className="bg-[#F2F0EA] rounded-[10px] px-3 py-2">
              <Text className="text-[13px] font-semibold text-[#1A1A1A]">{e}</Text>
            </View>
          ))}
        </View>
      </View>
    </EcranRubriqueCv>
  );
}
