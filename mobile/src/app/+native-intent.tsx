import { cheminInterne } from '@/lib/lienEntrantLogique';

// Tout lien reçu du système (facilite://… après la connexion Google, https://ffacilite.com/… partagé) passe ici avant le routeur : il est ramené à un écran
// qui existe (voir lib/lienEntrantLogique.ts). Un lien inconnu mène à l'accueil, jamais à « Unmatched Route ».
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return cheminInterne(path);
  } catch {
    return '/';
  }
}
