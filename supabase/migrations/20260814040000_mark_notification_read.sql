-- NOTIFICATIONS — étape B : marquage "lu" via fonction SECURITY DEFINER.
-- Aucun GRANT UPDATE table direct (voir 20260814030000_notifications.sql) :
-- l'appartenance (auth.uid() = user_id) est vérifiée DANS le prédicat WHERE
-- de l'UPDATE lui-même, pas via un SELECT préalable séparé — évite toute
-- fenêtre TOCTOU entre la vérification et l'écriture. Retourne FALSE aussi
-- bien si la ligne n'existe pas que si elle appartient à un autre
-- utilisateur : ne révèle jamais lequel des deux cas s'est produit.

CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = notification_id AND user_id = auth.uid();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
