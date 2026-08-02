-- RBAC v2 — sections 1-3 du chantier badges/accréditation.
--
-- Remplacement complet du modèle candidat/recruteur/admin/agent par
-- user/publisher/admin (décision explicite du 2026-08-02). role et status
-- déménagent dans public.user_roles, une table SANS AUCUN privilège accordé
-- à "authenticated" — ni SELECT par défaut (policy dédiée ci-dessous), ni
-- INSERT/UPDATE/DELETE du tout. Contrairement à un simple
-- REVOKE UPDATE (role) ON profiles, qui bloquerait aussi les admins (le rôle
-- Postgres "authenticated" est partagé par tous les utilisateurs connectés,
-- RLS ou pas) : ici, TOUTE écriture — y compris admin — passe par une route
-- serveur service_role avec vérification explicite (section 2, comparaison
-- des deux options demandée).
--
-- badges reste sur profiles (affichage public, ex: badge "Recruteur vérifié"
-- sur une offre) mais verrouillé en écriture (REVOKE UPDATE) : seul un
-- trigger SECURITY DEFINER pourra le synchroniser depuis badge_requests
-- (section 4, pas encore construite).

-- =====================================================================
-- 1. Table user_roles
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'publisher', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_review', 'suspended')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Aucun GRANT INSERT/UPDATE/DELETE à authenticated : la table entière n'est
-- écrivable que par service_role (les routes admin de la section 2
-- ci-dessous). REVOKE explicite malgré l'absence de policy d'écriture, pour
-- que l'intention reste lisible même si une policy INSERT/UPDATE était
-- ajoutée par erreur dans une migration future.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;

DROP POLICY IF EXISTS "Lecture de son propre role" ON public.user_roles;
CREATE POLICY "Lecture de son propre role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 2. Migration des données depuis profiles.role
-- =====================================================================
-- candidat/recruteur -> user (la distinction devient une question de badge,
-- pas de rôle). agent -> publisher (même périmètre "back-office interne").
-- admin reste admin. status='active' pour tous les comptes existants
-- (aucun d'eux n'a jamais eu besoin d'accréditation jusqu'ici).

INSERT INTO public.user_roles (user_id, role, status)
SELECT
  id,
  CASE role
    WHEN 'admin' THEN 'admin'
    WHEN 'agent' THEN 'publisher'
    ELSE 'user'
  END,
  'active'
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================================
-- 3. profiles.badges (cosmétique, verrouillé)
-- =====================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS badges JSONB NOT NULL DEFAULT '[]'::jsonb;

REVOKE UPDATE (badges) ON public.profiles FROM authenticated;
-- recruiter_verified (ajouté le 2026-08-02 pour le correctif d'audit
-- 121/122) devient dormant : plus personne n'a role='recruteur', donc plus
-- personne ne peut jamais matcher les policies qui le consultaient. On le
-- verrouille par cohérence en attendant sa migration vers badge_requests
-- (section 4, pas encore construite) plutôt que de le supprimer maintenant.
REVOKE UPDATE (recruiter_verified) ON public.profiles FROM authenticated;

-- =====================================================================
-- 4. Retrait du trigger anti-escalade devenu obsolète
-- =====================================================================
-- prevent_role_self_escalation référence NEW.role/OLD.role sur profiles :
-- laissé tel quel, il ferait échouer TOUTE mise à jour de profiles (plus
-- seulement les tentatives d'escalade) dès que la colonne role disparaît
-- ci-dessous. user_roles n'a besoin d'aucun trigger équivalent : l'absence
-- totale de GRANT INSERT/UPDATE à authenticated (étape 1) suffit à elle
-- seule à bloquer toute auto-promotion, sans dépendre d'une logique
-- applicative qui pourrait être contournée ou oubliée dans une policy future.
DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_role_self_escalation();

-- =====================================================================
-- 5. Retrait de profiles.role (CASCADE)
-- =====================================================================
-- CASCADE supprime aussi la vue public.candidats_recherche (seule
-- dépendance directe trouvée via pg_depend) : elle référençait
-- "WHERE role = 'candidat'" en dur, une valeur qui n'existe plus. La
-- CVthèque (recherche de candidats côté recruteur) devient donc
-- indisponible jusqu'à sa reconstruction sur le modèle badge_requests
-- (section 4/5) — signalé explicitement en fin de réponse, pas une
-- régression silencieuse : la route /api/recruteur/candidats-recherche
-- renverra une erreur 500 tant que la vue n'est pas reconstruite.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role CASCADE;

-- =====================================================================
-- 6. current_user_role() / current_user_status() sur user_roles
-- =====================================================================
-- SET search_path = '' (vide) + noms entièrement qualifiés : durcissement
-- par rapport au pattern existant (search_path='public') identifié comme
-- point faible dans docs/audit-securite-2026-08.md (point 111). SECURITY
-- DEFINER reste nécessaire pour éviter la récursion RLS : une policy sur
-- user_roles qui interrogerait user_roles directement (via un sous-select)
-- réévaluerait ses propres policies SELECT en boucle — exactement le bug
-- documenté dans 20260730000200_fix_profiles_rls_recursion.sql pour
-- profiles. Alternative écartée : custom claim JWT via Auth Hook. Deux
-- raisons concrètes de ne pas l'utiliser ici : (1) un Auth Hook se
-- configure depuis le Dashboard Supabase, invisible et non vérifiable
-- depuis le code — même catégorie que les points ❓ de l'audit ; (2) un
-- claim JWT ne se met à jour qu'au rafraîchissement du token — un compte
-- tout juste suspendu garderait donc un rôle/statut périmé dans son JWT
-- jusqu'à expiration ou refresh, une fenêtre de risque inacceptable pour un
-- statut "suspended" qui doit prendre effet immédiatement. La fonction
-- SECURITY DEFINER, elle, lit l'état réel à chaque appel, sans délai.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT status FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- Policy admin sur user_roles (lecture de tous les comptes, nécessaire pour
-- l'écran d'administration) : s'appuie sur current_user_role(), pas sur un
-- sous-select direct de user_roles, pour la même raison anti-récursion.
DROP POLICY IF EXISTS "Un admin lit tous les roles" ON public.user_roles;
CREATE POLICY "Un admin lit tous les roles" ON public.user_roles
  FOR SELECT USING (public.current_user_role() = 'admin');

-- =====================================================================
-- 7. handle_new_user() — role/status ne viennent jamais du client
-- =====================================================================
-- Avant : raw_user_meta_data->>'role' pouvait valoir 'candidat' ou
-- 'recruteur' au choix du client (formulaire d'inscription). Maintenant :
-- aucune valeur cliente n'influence jamais le rôle. Tout le monde démarre
-- 'user'/'active', sans exception — la distinction candidat/recruteur
-- n'existe plus au niveau rôle, elle deviendra une question de badge
-- (section 4/5).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (NEW.id, 'user', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================================
-- 8. resolve_admin_id() — dépendance directe à profiles.role trouvée par
--    recherche exhaustive (grep sur tous les corps de fonction), pas par
--    pg_depend (les fonctions SQL/plpgsql ne sont pas analysées pour leurs
--    dépendances de colonnes à la création, seulement à l'exécution — un
--    DROP COLUMN les aurait laissées passer silencieusement jusqu'au
--    premier appel en production). Utilisée par src/lib/messages.js pour
--    router les messages de support vers un admin.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.resolve_admin_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY updated_at ASC
  LIMIT 1;
$$;

-- NB : match_resumes (20260730100000_ai_infrastructure.sql) référence aussi
-- current_user_role() = ANY(['recruteur','admin']) — 'recruteur' n'existe
-- plus, la fonction devient donc silencieusement inerte (ne peut plus
-- matcher que 'admin', jamais d'erreur). Volontairement NON corrigée ici :
-- la remplacer par 'user' rouvrirait l'exfiltration CVthèque corrigée le
-- 2026-08-02 (points 121/122 de l'audit), puisque 'user' ne distingue plus
-- un recruteur vérifié d'un candidat. Elle doit être réécrite en même temps
-- que candidats_recherche, sur le modèle badge_requests (section 4/5).
