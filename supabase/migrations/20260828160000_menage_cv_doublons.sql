-- Ménage des CV en double sur les comptes réels.
--
-- Cause racine corrigée par le commit 5804168 (creer-cv/page.js faisait un
-- .insert() à chaque sauvegarde de brouillon au lieu de mettre à jour la
-- ligne existante). Cette migration ne traite que les lignes déjà créées.
--
-- Périmètre volontairement restreint aux deux comptes réels concernés :
--   facilitefacile@gmail.com   « Mon CV Facilité »        3 lignes -> 1
--   sokhnaawan408@gmail.com    « CV_2026-08-22_805.pdf »  2 lignes -> 1
--
-- Le compte de test e2e-test-candidate@facilite-demo.local porte 167 autres
-- doublons ; ils sont LAISSÉS EN PLACE. Deux raisons : une vingtaine de
-- suites Playwright s'appuient sur ce compte, et 32 commandes au statut
-- pending pointent sur ces lignes via orders.resume_id (ON DELETE SET NULL) —
-- les supprimer effacerait la trace du CV associé à ces commandes.
--
-- La ligne conservée dans chaque groupe est la plus complète, et à contenu
-- égal la plus récente. Ici les contenus sont identiques en taille au sein
-- de chaque groupe, la plus récente l'emporte donc.

BEGIN;

-- Suppression par identifiant explicite, doublée d'un contrôle sur le
-- propriétaire et le titre : si un identifiant avait été recopié de travers,
-- la clause ne trouve rien plutôt que d'effacer le CV de quelqu'un d'autre.
WITH supprimees AS (
  DELETE FROM public.resumes r
  USING auth.users u
  WHERE r.user_id = u.id
    AND (
      (r.id = 'aa127477-b0c3-4808-8672-52e8ace8126a'::uuid
        AND u.email = 'facilitefacile@gmail.com' AND r.title = 'Mon CV Facilité')
      OR (r.id = 'ce540991-3291-4a32-9c31-ad5474183b3c'::uuid
        AND u.email = 'facilitefacile@gmail.com' AND r.title = 'Mon CV Facilité')
      OR (r.id = 'c67066b6-d944-41de-a029-a9b3c19ac876'::uuid
        AND u.email = 'sokhnaawan408@gmail.com' AND r.title = 'CV_2026-08-22_805.pdf')
    )
  RETURNING r.id
)
SELECT count(*) FROM supprimees;

-- Garde-fou : aucun des deux comptes ne doit plus porter de doublon strict.
-- Rejouer la migration après coup est sans effet (les identifiants n'existent
-- plus) et ce contrôle reste vrai, la migration est donc idempotente.
DO $$
DECLARE restants int;
BEGIN
  SELECT count(*) INTO restants
  FROM (
    SELECT r.user_id, r.title
    FROM public.resumes r
    JOIN auth.users u ON u.id = r.user_id
    WHERE u.email IN ('facilitefacile@gmail.com', 'sokhnaawan408@gmail.com')
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) d;
  IF restants > 0 THEN
    RAISE EXCEPTION 'doublons encore présents sur les comptes réels : %', restants;
  END IF;
END $$;

COMMIT;
