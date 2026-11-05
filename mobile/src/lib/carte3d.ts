// Carte 3D (prototype) dans l'application : adresse de la page 3D du site, lue dans EXPO_PUBLIC_CARTE_3D_URL (fichier mobile/.env, jamais commité).
// Variable absente ou invalide = bouton « 3D » caché : rien ne change pour les utilisateurs. Seule une adresse https est acceptée.
export function adresseCarte3D(): string | null {
  const v = String(process.env.EXPO_PUBLIC_CARTE_3D_URL ?? '').trim();
  return /^https:\/\/[^\s]+$/i.test(v) ? v : null;
}
