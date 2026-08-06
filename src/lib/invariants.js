/**
 * REGULATION ET INVARIANTS DU MODÈLE DE DONNÉES & RBAC
 *
 * Cette source de vérité garantit qu'aucun lien de navigation, aucun composant UI,
 * ni aucune requête de base de données ne peut dépendre d'une colonne obsolète ou
 * d'un rôle inexistant du modèle de données actuel.
 */

export const VALID_USER_ROLES = ["admin", "publisher", "user"];

export const VALID_BADGES = [
  "verified_recruiter",
  "administrateur",
  "candidat",
  "ambassadeur",
  "expert_ia",
];

// Liste noire des attributs et colonnes supprimés du modèle Supabase pour éviter les régressions (ex: 400 Bad Request)
export const OBSOLETE_COLUMNS = {
  profiles: ["role", "headline", "user_type"],
  user_roles: ["recruteur", "candidat"], // Ces rôles ont fusionné en 'user' avec badge 'verified_recruiter'
};

/**
 * Vérification à la volée (runtime) du respect de l'invariant de rôle.
 * Signale immédiatement ou lève une exception si un composant tente d'autoriser
 * une action ou d'afficher un lien sur un rôle supprimé.
 */
export function assertValidRole(roleToTest, context = "Inconnu") {
  if (!roleToTest) return true;
  if (OBSOLETE_COLUMNS.user_roles.includes(roleToTest)) {
    const errorMsg = `[VIOLATION D'INVARIANT - ${context}] Le rôle '${roleToTest}' n'existe plus dans user_roles (remplacé par le badge 'verified_recruiter' sous le rôle 'user').`;
    console.error(errorMsg);
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      throw new Error(errorMsg);
    }
    return false;
  }
  return VALID_USER_ROLES.includes(roleToTest);
}

/**
 * Vérifie qu'un sélecteur Supabase ne tente pas de lire une colonne supprimée du modèle de base de données.
 */
export function assertValidColumns(tableName, selectQuery) {
  const obsoleteForTable = OBSOLETE_COLUMNS[tableName];
  if (!obsoleteForTable || typeof selectQuery !== "string") return true;

  const violations = obsoleteForTable.filter(col => 
    new RegExp(`\\b${col}\\b`).test(selectQuery)
  );

  if (violations.length > 0) {
    const errorMsg = `[VIOLATION D'INVARIANT SQL] Requête sur la table '${tableName}' sollicitant des colonnes obsolètes: ${violations.join(", ")}.`;
    console.error(errorMsg);
    if (process.env.NODE_ENV !== "production") {
      throw new Error(errorMsg);
    }
    return false;
  }
  return true;
}
