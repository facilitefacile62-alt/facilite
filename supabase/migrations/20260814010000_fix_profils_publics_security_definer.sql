-- =====================================================================
-- Point 1 du chantier en cours — /in/[username] affichait "Profil
-- introuvable" pour tout visiteur non connecté (ou tout utilisateur
-- autre que le propriétaire/un admin) : get_profils_publics() est en
-- SECURITY INVOKER, et aucune policy RLS sur public.profiles n'autorise
-- la lecture d'un profil is_public=true par quelqu'un d'autre que son
-- propriétaire ou un admin.
--
-- Correctif choisi (le plus cohérent avec l'existant) : SECURITY
-- DEFINER + search_path figé, même schéma que get_candidats_recherche
-- (autre fonction de recherche publique du projet). La fonction ne
-- référence déjà que des identifiants qualifiés (public.profiles), donc
-- search_path = '' ne casse rien. Le WHERE is_public = true AND
-- deleted_at IS NULL reste le seul filtre — aucune colonne
-- supplémentaire exposée par rapport à avant.
-- =====================================================================

ALTER FUNCTION public.get_profils_publics() SECURITY DEFINER;
ALTER FUNCTION public.get_profils_publics() SET search_path = '';
