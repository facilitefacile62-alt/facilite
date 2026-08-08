-- =====================================================================
-- Corrige 6 fonctions trouvées défaillantes en production pendant le
-- chantier d'isolation des tests E2E (2026-08-08, facilite-e2e-test) —
-- validées et testées sur le projet de test avant réplication ici.
--
-- 1-5. delete_own_resume(), archive_own_job_offer(),
-- clear_own_assistant_messages(), get_candidats_recherche(),
-- get_recruiter_candidatures() sont des fonctions LANGUAGE sql/plpgsql
-- normales (prosecdef=false) : elles s'exécutent avec les droits de
-- l'appelant (authenticated), donc soumises au RLS des tables qu'elles
-- lisent/écrivent (resumes, job_offers, assistant_messages, profiles,
-- candidatures). Aucune policy RLS ne permet à un utilisateur normal de
-- voir/modifier les lignes d'un AUTRE utilisateur sur ces tables — même
-- quand la fonction fait elle-même toute la vérification de propriété
-- nécessaire avant d'agir (delete_own_resume/archive_own_job_offer/
-- clear_own_assistant_messages : IF owner_id <> auth.uid() THEN RAISE
-- EXCEPTION ; get_candidats_recherche/get_recruiter_candidatures :
-- filtrage explicite par badge/rôle/is_test_account). Conséquence réelle :
-- ces 5 fonctions échouent aujourd'hui pour un utilisateur normal
-- (RLS bloque leur propre lecture/écriture avant que leur logique
-- métier s'applique) — pas seulement sur le projet de test, identique en
-- prod. SECURITY DEFINER fait tourner la fonction avec les droits de son
-- owner (postgres) au lieu de ceux de l'appelant, ce qui ne réintroduit
-- aucun trou puisque chaque fonction fait déjà sa propre vérification
-- d'autorisation en interne. SET search_path = '' (défense en profondeur
-- contre le search_path hijacking d'une fonction SECURITY DEFINER) ne
-- casse rien : les 5 corps de fonction n'utilisent que des noms
-- pleinement qualifiés (public.xxx, auth.uid()).
--
-- 6. log_security_event() est déjà SECURITY DEFINER, mais authenticated
-- avait EXECUTE dessus sans aucune vérification de l'identité de
-- l'appelant dans son corps — n'importe quel compte authentifié pouvait
-- insérer une entrée dans security_logs en se faisant passer pour
-- n'importe quel autre acteur (p_actor_id fourni librement), avec
-- n'importe quelle sévérité : vecteur de forgerie de journal de sécurité.
-- Seul service_role (et l'owner postgres) doit pouvoir l'appeler
-- directement désormais ; les utilisateurs authentifiés passent par des
-- fonctions dédiées déjà existantes (ex. log_own_storage_deletion_failure(),
-- SECURITY DEFINER, force auth.uid() comme acteur) qui appellent
-- log_security_event() en interne — l'appel interne depuis une autre
-- fonction SECURITY DEFINER n'a pas besoin du GRANT EXECUTE retiré ici.
-- =====================================================================

ALTER FUNCTION public.delete_own_resume(uuid)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.archive_own_job_offer(uuid)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.clear_own_assistant_messages(uuid)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_candidats_recherche()
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.get_recruiter_candidatures(uuid, integer)
  SECURITY DEFINER SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.log_security_event(
  text, text, uuid, uuid, jsonb)
FROM authenticated, anon;
