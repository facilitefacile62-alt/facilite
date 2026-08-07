-- =====================================================================
-- 4C (suite) — suppression de birth_date, marital_status, driver_license.
-- docs/incident-2026-08-06.md.
--
-- Décision finale après vérification complète du réel : ces 3 colonnes
-- étaient éditables/affichées dans src/app/profil/page.js (section "À
-- propos", contexte strictement privé — le compte consulte/modifie ses
-- propres données) et, en théorie, exposables via le mécanisme "détails
-- épinglés" (pinned_details) — mais AUCUNE interface fonctionnelle ne
-- permet d'ajouter un pin (setTempPinnedDetails() n'est jamais appelée par
-- une action utilisateur, seulement au chargement/reset). Un seul compte
-- réel sur 11 a des pinned_details non vides, aucun n'inclut ces champs.
-- Ce sont exactement les colonnes qu'exposait l'incident profiles du même
-- jour. Une donnée non collectée ne peut plus jamais fuiter.
--
-- src/app/creer-cv/page.js a des champs de même nom (birthDate,
-- maritalStatus) mais totalement indépendants : stockés dans
-- resumes.content (JSONB), jamais dans profiles — vérifié, aucun call site
-- .from("profiles") dans ce fichier. Cette suppression ne les affecte pas.
-- =====================================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS marital_status,
  DROP COLUMN IF EXISTS driver_license;

-- Réémet le GRANT UPDATE colonne par colonne de
-- 20260802060000_profiles_deny_by_default.sql SANS les 3 colonnes retirées
-- — la migration originale reste inchangée (jamais modifier une migration
-- déjà appliquée) mais rejouer TOUTES les migrations depuis zéro sur une
-- base neuve échouerait sinon : cette migration-ci s'exécute après, et
-- réémettre un GRANT sur une colonne déjà supprimée par cette même
-- migration lèverait une erreur — d'où l'ordre (DROP puis GRANT corrigé,
-- pas l'inverse) et la liste de colonnes ci-dessous qui reflète l'état
-- final, pas la liste d'origine.
GRANT UPDATE (
  id, email, updated_at,
  full_name, avatar_url, cover_url, bio, headline, location,
  experiences, skills, interests, educations, languages, pinned_details,
  cv_url, cv_name,
  city, country, gender,
  phone, contact_email, website_url, education_level,
  is_public, show_contact, profile_views
) ON public.profiles TO authenticated;
