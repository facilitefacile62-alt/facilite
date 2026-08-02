/**
 * Mapping rôle -> page d'accueil par défaut. Partagé entre le login (UX,
 * redirection après connexion) et le middleware (contrôle d'accès réel).
 */
export function roleHomePath(role) {
  if (role === "admin" || role === "publisher") return "/admin";
  return "/messagerie";
}
