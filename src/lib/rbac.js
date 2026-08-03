/**
 * Vérification serveur du rôle de l'appelant pour les routes admin du
 * système RBAC (role/status/badges — colonnes verrouillées, aucune écriture
 * directe possible depuis le client, cf. 20260802050000_rbac_user_roles.sql).
 * Utilise le client service_role : user_roles n'accorde aucun privilège à
 * "authenticated", même en lecture universelle, donc même vérifier "cet
 * appelant est-il admin ?" doit passer par service_role.
 */
export async function isCallerAdmin(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, status")
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;
  // status vérifié explicitement : un compte suspendu qui avait le rôle
  // admin avant sa suspension ne doit pas pouvoir continuer à agir depuis
  // les routes qui passent par ce helper (elles écrivent via service_role,
  // donc hors RLS/current_user_role() — ce contrôle est leur seule barrière).
  return data.role === "admin" && data.status === "active";
}
