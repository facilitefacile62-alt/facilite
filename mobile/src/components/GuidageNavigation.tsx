import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceLisible, type EtatGuidage, type TypeVirage } from '@/lib/guidage';

// Interface de guidage « Démarrer », sur le modèle de Google Maps : bandeau vert en haut (flèche, direction à prendre, « Puis »
// le virage suivant), pastille de vitesse en bas à gauche, bouton « Recentrer », et en bas une barre sombre avec la fermeture
// (X), la durée restante, la distance et l'heure d'arrivée. Tout est calculé dans l'application (jamais Google Maps).
const VERT_BANDEAU = '#0F6E5E';
const VERT_TEMPS = '#34D399';

const ANGLE: Record<TypeVirage | 'tout-droit', number> = {
  'tout-droit': 0,
  'droite-legere': 45,
  droite: 90,
  'gauche-legere': -45,
  gauche: -90,
  'demi-tour': 180,
};

function Fleche({ type, taille }: { type: TypeVirage | 'tout-droit'; taille: number }) {
  return (
    <View style={{ transform: [{ rotate: `${ANGLE[type]}deg` }] }}>
      <Ionicons name="arrow-up" size={taille} color="#fff" />
    </View>
  );
}

export function heureArrivee(minutes: number, maintenant: Date = new Date()): string {
  const d = new Date(maintenant.getTime() + minutes * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Props = {
  etat: EtatGuidage | null;
  destination: string;
  /** Minutes restantes jusqu'à l'arrivée (null : inconnu). */
  minutes: number | null;
  vitesseKmh: number;
  onArreter: () => void;
  onRecentrer: () => void;
  /** Carte orientée nord en haut (true) ou dans le sens de la marche (false), comme la boussole de Google Maps. */
  nordHaut: boolean;
  onBoussole: () => void;
  /** Vue 3D (carte inclinée) ou 2D (à plat). */
  vue3d: boolean;
  onVue3d: () => void;
};

export default function GuidageNavigation({ etat, destination, minutes, vitesseKmh, onArreter, onRecentrer, nordHaut, onBoussole, vue3d, onVue3d }: Props) {
  const insets = useSafeAreaInsets();
  const prochain = etat?.prochain ?? null;
  const type: TypeVirage | 'tout-droit' = prochain && prochain.distanceM < 400 ? prochain.type : 'tout-droit';
  const titre = !etat ? 'Recherche de votre position…' : etat.instruction;
  const detail = !etat
    ? ''
    : etat.arrive || etat.horsTrace
      ? ''
      : prochain
        ? distanceLisible(prochain.distanceM)
        : `pendant ${distanceLisible(etat.restantM)}`;
  const distanceTotale = etat ? distanceLisible(etat.restantM) : '';

  return (
    <>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 10, right: 10 }}>
        <View style={{ backgroundColor: VERT_BANDEAU, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Fleche type={etat?.arrive ? 'tout-droit' : type} taille={46} />
          <View style={{ flex: 1 }}>
            {detail ? <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{detail}</Text> : null}
            <Text style={{ color: '#fff', fontSize: detail ? 17 : 24, fontWeight: '700' }} numberOfLines={2}>
              {titre}
            </Text>
          </View>
        </View>
        {etat?.ensuite && !etat.arrive ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: VERT_BANDEAU,
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              marginTop: -6,
              paddingTop: 8,
              paddingBottom: 6,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Puis</Text>
            <Fleche type={etat.ensuite} taille={22} />
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onBoussole}
        accessibilityLabel={nordHaut ? 'Orienter la carte dans le sens de la marche' : 'Mettre le nord en haut'}
        style={{ position: 'absolute', right: 14, top: '42%', width: 52, height: 52, borderRadius: 26, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
        <Ionicons name="compass" size={28} color={nordHaut ? '#fff' : '#F87171'} />
      </Pressable>

      <Pressable
        onPress={onVue3d}
        accessibilityLabel={vue3d ? 'Passer en vue 2D' : 'Passer en vue 3D'}
        style={{ position: 'absolute', right: 14, top: '42%', marginTop: 62, width: 52, height: 52, borderRadius: 26, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{vue3d ? '2D' : '3D'}</Text>
      </Pressable>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, bottom: 12, gap: 10 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View
            accessibilityLabel={`Vitesse ${vitesseKmh} kilomètres par heure`}
            style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#0B0F14', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 22 }}>{vitesseKmh}</Text>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>km/h</Text>
          </View>
          <Pressable
            onPress={onRecentrer}
            accessibilityLabel="Recentrer sur ma position"
            style={{ backgroundColor: '#0B0F14', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Recentrer</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: 'rgba(24,28,34,0.97)', borderRadius: 26, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            onPress={onArreter}
            accessibilityLabel="Arrêter le guidage"
            hitSlop={8}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#0B0F14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: VERT_TEMPS, fontSize: 24, fontWeight: '800' }}>{minutes != null ? `${minutes} min` : '—'}</Text>
            <Text style={{ color: '#B6BDC6', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
              {distanceTotale}
              {minutes != null ? ` • ${heureArrivee(minutes)}` : ''}
            </Text>
            <Text style={{ color: '#7F8893', fontSize: 11 }} numberOfLines={1}>
              Vers {destination}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
