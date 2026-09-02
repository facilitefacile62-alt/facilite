-- Même règle de position pour les établissements que pour les boutiques.
--
-- definir_mon_activite écrasait la position à chaque appel
-- (`coalesce(p_lat, activity_latitude)`). L'écran, lui, la présentait comme
-- fixée dès le premier relevé — un verrou d'interface sans garantie en base,
-- c'est-à-dire une promesse fausse : il suffisait d'appeler la fonction
-- directement pour déplacer sa pharmacie au centre-ville.
--
-- Le motif est le même que pour marketplace_stores : c'est la position qui
-- rend la distance croyable. Un établissement qui se déplace librement fait
-- remonter sa fiche en tête de liste chez des gens qui ne le trouveront pas.
--
-- Comme pour les boutiques, le premier relevé est offert et daté ; ensuite la
-- position est ignorée en silence plutôt que de lever une erreur — l'appel
-- sert aussi à changer de métier, et refuser bloquerait ce cas légitime.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_position_definie_le TIMESTAMPTZ;

UPDATE public.profiles
SET activity_position_definie_le = coalesce(activity_position_definie_le, activity_updated_at, now())
WHERE activity_latitude IS NOT NULL
  AND activity_longitude IS NOT NULL
  AND activity_position_definie_le IS NULL;

CREATE OR REPLACE FUNCTION public.definir_mon_activite(
  p_type public.user_activity_type,
  p_lat  DOUBLE PRECISION DEFAULT NULL,
  p_lng  DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.user_activity_type
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  UPDATE public.profiles
  SET activity_type = p_type,
      -- La position n'est écrite QUE si elle n'a jamais été fixée. Un appel
      -- ultérieur avec d'autres coordonnées ne la déplace pas.
      activity_latitude = CASE
        WHEN activity_position_definie_le IS NULL THEN coalesce(p_lat, activity_latitude)
        ELSE activity_latitude END,
      activity_longitude = CASE
        WHEN activity_position_definie_le IS NULL THEN coalesce(p_lng, activity_longitude)
        ELSE activity_longitude END,
      activity_position_definie_le = CASE
        WHEN activity_position_definie_le IS NOT NULL THEN activity_position_definie_le
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN now()
        ELSE NULL END,
      -- Repasser candidat éteint le statut : laisser `is_open = true` sur un
      -- ancien point Wave le ferait apparaître ouvert pour toujours.
      is_open = CASE WHEN p_type = 'candidate' THEN false ELSE is_open END,
      pharmacy_status = CASE WHEN p_type = 'pharmacy' THEN coalesce(pharmacy_status, 'closed') ELSE NULL END,
      activity_updated_at = now()
  WHERE id = v_moi;

  RETURN p_type;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_mon_activite(public.user_activity_type, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_mon_activite(public.user_activity_type, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
