import { useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import {
  IconAccueil,
  IconAdmin,
  IconExtracteur,
  IconMenuHamburger,
  IconMessages,
  IconNotifs,
  IconOffres,
  IconProfilCercle,
  IconRecherche,
} from '@/components/facilite-icons';
import { useAuth } from '@/context/AuthContext';

// En-tête + rangée de navigation à 6 icônes, identiques pixel pour pixel sur
// tous les écrans du dossier de design (design_handoff_facilite/pages/
// 01-accueil, 02-extracteur, 03-offres, 05-messages...) — d'où sa mise en
// commun ici plutôt qu'une duplication par écran. Les destinations hors
// périmètre de ce lot (profil, recherche, menu ☰, notifications, admin)
// affichent un message "Bientôt disponible" : leurs écrans natifs ne sont
// pas encore construits, plutôt que de simuler une fausse navigation.
type EcranActif = 'accueil' | 'extracteur' | 'offres' | 'messages';

const BIENTOT = (titre: string) => Alert.alert(titre, 'Cet écran arrive dans une prochaine mise à jour.');

export default function FaciliteHeader({ ecranActif }: { ecranActif: EcranActif }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const initiale = (profile?.full_name || user?.email || 'F').charAt(0).toUpperCase();

  const vertActif = '#10B981';
  const noir = '#1A1A1A';

  return (
    <View className="bg-[#FAF6F1] border-b border-gray-200">
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2.5">
        <Pressable
          onPress={() => BIENTOT('Profil')}
          className="w-[34px] h-[34px] rounded-full border-[1.6px] border-black/55 items-center justify-center">
          <IconProfilCercle />
        </Pressable>
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={() => BIENTOT('Recherche')}>
            <IconRecherche />
          </Pressable>
          <Pressable onPress={() => BIENTOT('Mon profil')} className="w-7 h-7 rounded-full bg-violet-500 items-center justify-center">
            <Text className="text-white text-[11px] font-extrabold">{initiale}</Text>
          </Pressable>
          <Pressable onPress={() => BIENTOT('Menu')}>
            <IconMenuHamburger />
          </Pressable>
        </View>
      </View>

      <View className="flex-row px-1 pb-2.5 pt-0.5">
        <NavItem
          label="Accueil"
          active={ecranActif === 'accueil'}
          onPress={() => router.replace('/')}
          icon={<IconAccueil active={ecranActif === 'accueil'} color={ecranActif === 'accueil' ? vertActif : noir} />}
        />
        <NavItem
          label="Extracteur"
          active={ecranActif === 'extracteur'}
          onPress={() => router.replace('/extracteur')}
          icon={
            <IconExtracteur active={ecranActif === 'extracteur'} color={ecranActif === 'extracteur' ? vertActif : noir} />
          }
        />
        <NavItem
          label="Offres"
          active={ecranActif === 'offres'}
          onPress={() => router.replace('/offres')}
          icon={<IconOffres color={ecranActif === 'offres' ? vertActif : noir} />}
        />
        <NavItem
          label="Messages"
          active={ecranActif === 'messages'}
          onPress={() => router.replace('/messages')}
          icon={<IconMessages color={ecranActif === 'messages' ? vertActif : noir} />}
        />
        <NavItem
          label="Notifs"
          onPress={() => BIENTOT('Notifications')}
          icon={<IconNotifs />}
          badge="8+"
        />
        <NavItem label="Admin" onPress={() => BIENTOT('Espace Admin')} icon={<IconAdmin />} labelColor="#EA580C" />
      </View>
    </View>
  );
}

function NavItem({
  label,
  icon,
  onPress,
  active,
  badge,
  labelColor,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  badge?: string;
  labelColor?: string;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-[3px]">
      <View>
        {icon}
        {badge ? (
          <View className="absolute -top-1 -right-2.5 bg-red-600 rounded-full px-1 py-[1px]">
            <Text className="text-white text-[8px] font-bold leading-[10px]">{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text
        className="text-[10px]"
        style={{
          fontWeight: active ? '700' : '600',
          color: active ? '#10B981' : labelColor || '#1A1A1A',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
