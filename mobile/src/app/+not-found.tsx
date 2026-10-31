import { Link, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

// Page introuvable, en français : au lieu de la page d'erreur anglaise du routeur, un message simple, puis retour automatique à l'accueil.
export default function PageIntrouvable() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 2500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F2F0EA' }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A1A1A', textAlign: 'center' }}>Page introuvable</Text>
      <Text style={{ fontSize: 14.5, color: 'rgba(0,0,0,0.55)', textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
        Cette page n&apos;existe pas ou n&apos;est plus disponible. Vous allez être redirigé vers l&apos;accueil.
      </Text>
      <Link href="/" replace style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#10B981', overflow: 'hidden' }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Retour à l&apos;accueil</Text>
      </Link>
    </View>
  );
}
