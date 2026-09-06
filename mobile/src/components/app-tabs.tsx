import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

// Barre d'onglets réelle de l'app (remplace le gabarit "Expo Starter"
// Home/Explore jamais personnalisé). La navigation "hifi" pixel-perfect du
// dossier de design vit dans FaciliteHeader (rangée d'icônes en haut de
// chaque écran, fidèle au HTML fourni) ; cette barre native du bas reste la
// convention de plateforme habituelle et un filet de secours si jamais
// FaciliteHeader n'est pas affiché. Les deux naviguent vers les mêmes
// routes, donc toujours synchronisées.
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#1A1A1A',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="extracteur"
        options={{
          title: 'Extracteur',
          tabBarIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          title: 'Offres',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
