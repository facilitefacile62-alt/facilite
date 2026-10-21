import { Stack } from 'expo-router';

import { estSombre, fondSombre } from '@/components/themeSombre';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: estSombre() ? fondSombre('#FAF6F1') : '#FAF6F1' } }} />;
}
