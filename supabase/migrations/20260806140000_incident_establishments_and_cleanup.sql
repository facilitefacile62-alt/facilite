-- =====================================================================
-- INCIDENT 2026-08-06 (suite, Partie 5 du chantier) : deux points
-- documentés mais non corrigés lors du premier passage.
-- =====================================================================

-- 1. `establishments` (annuaire pharmacies/hôpitaux/hôtels, créé hors
--    migration par backend-api/database.py via SQLAlchemy Base.metadata.
--    create_all() — confirmé : ce backend ne touche jamais Supabase
--    Storage, aucun rapport avec l'incident du bucket resumes). GRANT
--    DELETE/UPDATE à anon ET authenticated, sans aucune policy restreignant
--    ces commandes : n'importe quel visiteur pouvait vider ou modifier tout
--    l'annuaire. Aucune donnée personnelle en jeu (name/address/phone/email
--    d'entreprises, pas de particuliers), mais un annuaire public doit
--    rester en lecture seule pour le public.
REVOKE UPDATE, DELETE ON public.establishments FROM anon, authenticated;

DROP POLICY IF EXISTS "public_read_establishments" ON public.establishments;
CREATE POLICY "Lecture publique de l'annuaire" ON public.establishments
  FOR SELECT
  USING (true);

-- 2. `is_app_admin(uuid)` : orpheline (aucune référence dans supabase/migrations
--    ni dans src/), basée sur profiles.role — colonne du modèle pré-RBAC,
--    remplacée par public.user_roles depuis 20260802050000_rbac_user_roles.sql.
--    Fonctionnellement mort code (échoue silencieusement à false si la
--    colonne n'existe pas), mais SECURITY DEFINER + orphelin = surface
--    d'attaque inutile à faire disparaître plutôt qu'à documenter.
DROP FUNCTION IF EXISTS public.is_app_admin(uuid);

-- 3. is_admin(check_user_id uuid) : utilisée légitimement (RoleNavLink.jsx,
--    profil/page.js, admin/page.js), toujours appelée avec l'id de
--    l'appelant lui-même. Mais anon avait EXECUTE dessus alors qu'aucun
--    appelant anonyme n'a de raison légitime de sonder le statut admin
--    d'un uuid arbitraire (reconnaissance à faible coût : cibler les
--    comptes admin repérés). L'usage réel (self-check depuis une session
--    authentifiée) ne nécessite que authenticated.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
