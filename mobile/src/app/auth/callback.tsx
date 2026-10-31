import { Redirect } from 'expo-router';

// Retour de connexion (facilite://auth/callback) : les jetons sont déjà lus par la fenêtre de connexion (lib/oauth.ts). Cette page n'a rien à afficher :
// elle renvoie à l'accueil, où la garde d'authentification place la personne là où elle doit être.
export default function RetourConnexion() {
  return <Redirect href="/" />;
}
