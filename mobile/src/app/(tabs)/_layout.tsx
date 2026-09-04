import AppTabs from '@/components/app-tabs';

// Isolé du layout racine : ce groupe ne s'affiche que pour une session
// connectée (voir le garde d'authentification dans src/app/_layout.tsx).
export default function TabsLayout() {
  return <AppTabs />;
}
