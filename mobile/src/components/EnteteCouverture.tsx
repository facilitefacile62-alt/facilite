import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

// En-tête de profil à photo de couverture (Facilité et Locaux), façon profil TikTok : la couverture occupe le haut, se fond
// progressivement dans la couleur de la page, et le nom, le sous-titre et la photo ronde se posent dans la partie fondue.
// Un appui sur la couverture ouvre la VRAIE photo, en plein écran (visionneuse d'images de l'application).
// Sans couverture, rien ne change : le contenu s'affiche seul, comme avant.
export const HAUTEUR_COUVERTURE = 220;
const HAUTEUR_FONDU = 120;

export function urlVisionneuseCouverture(uri: string, titre = 'Photo de couverture'): string {
  return `/document?url=${encodeURIComponent(uri)}&titre=${encodeURIComponent(titre)}&image=1`;
}

type Props = {
  /** Adresse de la photo de couverture ; absente ou vide : pas de couverture. */
  couvertureUri?: string | null;
  /** Couleur de fond de la page (la couverture s'y fond). */
  fond: string;
  /** Bouton « Retour » posé sur la couverture, en haut à gauche (si une couverture est affichée). */
  retour?: ReactNode;
  /** Nom, sous-titre, photo ronde, boutons : posés dans la partie fondue de la couverture. */
  children: ReactNode;
};

export default function EnteteCouverture({ couvertureUri, fond, retour, children }: Props) {
  const router = useRouter();
  const uri = typeof couvertureUri === 'string' && couvertureUri.trim() ? couvertureUri : null;
  if (!uri) return <>{children}</>;

  return (
    <View>
      <Pressable
        onPress={() => router.push(urlVisionneuseCouverture(uri) as never)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Voir la photo de couverture"
        style={{ height: HAUTEUR_COUVERTURE, backgroundColor: '#D9D4C7' }}>
        <Image source={{ uri }} alt="Photo de couverture" style={{ width: '100%', height: '100%' }} contentFit="cover" />
        <LinearGradient
          pointerEvents="none"
          colors={[`${fond}00`, `${fond}CC`, fond]}
          locations={[0, 0.55, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_FONDU }}
        />
      </Pressable>
      {retour ? <View style={{ position: 'absolute', top: 12, left: 16 }}>{retour}</View> : null}
      <View style={{ marginTop: -78 }}>{children}</View>
    </View>
  );
}
