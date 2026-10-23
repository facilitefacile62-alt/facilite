-- Anniversaires : chaque personne qui a renseigné sa date de naissance (profiles.date_naissance) reçoit une notification « Joyeux
-- anniversaire » le jour J (23/10/2026). La fonction est appelée une fois par jour par la tâche planifiée /api/cron/reminders (clé service) ;
-- elle ne crée jamais deux notifications d'anniversaire la même année pour la même personne.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade', 'marketplace_signalement', 'marketplace_commande',
    'livreur_statut', 'chauffeur_statut', 'voyage', 'anniversaire'
  ]));

CREATE OR REPLACE FUNCTION public.souhaiter_anniversaires()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre INTEGER;
BEGIN
  WITH a_souhaiter AS (
    SELECT p.id, split_part(coalesce(nullif(trim(p.full_name), ''), 'vous'), ' ', 1) AS prenom
    FROM public.profiles p
    WHERE p.date_naissance IS NOT NULL
      AND extract(month FROM p.date_naissance) = extract(month FROM now() AT TIME ZONE 'UTC')
      AND extract(day FROM p.date_naissance) = extract(day FROM now() AT TIME ZONE 'UTC')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id AND n.type = 'anniversaire'
          AND extract(year FROM n.created_at) = extract(year FROM now())
      )
  ), inseres AS (
    INSERT INTO public.notifications (user_id, type, content, link)
    SELECT id, 'anniversaire', '🎂 Joyeux anniversaire ' || prenom || ' ! Toute l''équipe Facilité vous souhaite une excellente journée.', '/'
    FROM a_souhaiter
    RETURNING 1
  )
  SELECT count(*) INTO v_nombre FROM inseres;
  RETURN v_nombre;
END;
$$;

-- Appelée uniquement par le serveur (clé service) : jamais par un utilisateur connecté ou anonyme.
REVOKE ALL ON FUNCTION public.souhaiter_anniversaires() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.souhaiter_anniversaires() TO service_role;
