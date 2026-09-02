-- Gardes de rôle robustes face à NULL.
--
-- L'invariant 8 a rejeté deux fonctions de la migration 20260902200000, et il
-- avait raison sur les deux — dont une avec une conséquence réelle.
--
-- 1. enregistrer_prestation vérifiait :
--
--      IF (SELECT activity_type FROM profiles WHERE id = v_moi) <> 'clinic'
--
--    Si le compte n'a pas de ligne dans profiles, la sous-requête ne renvoie
--    pas 'candidate' : elle renvoie NULL. Or `NULL <> 'clinic'` ne vaut pas
--    TRUE mais NULL, donc le IF ne se déclenche pas et la garde est franchie.
--    N'importe quel compte sans profil pouvait publier une prestation au nom
--    d'une clinique. C'est exactement le motif que l'invariant traque.
--
-- 2. etablissements_ouverts_proches filtrait avec `activity_type <> 'candidate'`.
--    La colonne est NOT NULL, donc sans conséquence aujourd'hui — mais la
--    garantie tient à une contrainte qu'une migration future pourrait lever,
--    et alors les lignes à NULL disparaîtraient silencieusement de la carte.
--
-- IS DISTINCT FROM traite NULL comme une valeur ordinaire : `NULL IS DISTINCT
-- FROM 'clinic'` vaut TRUE. La garde échoue alors du bon côté.

CREATE OR REPLACE FUNCTION public.enregistrer_prestation(p_specialite TEXT, p_tarif INTEGER)
RETURNS public.clinic_services
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.clinic_services;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF (SELECT activity_type FROM public.profiles WHERE id = v_moi) IS DISTINCT FROM 'clinic' THEN
    RAISE EXCEPTION 'Réservé aux cliniques.';
  END IF;
  IF btrim(coalesce(p_specialite, '')) = '' THEN
    RAISE EXCEPTION 'La spécialité est obligatoire.';
  END IF;

  INSERT INTO public.clinic_services (clinic_id, specialite, tarif_xof)
  VALUES (v_moi, btrim(p_specialite), greatest(0, coalesce(p_tarif, 0)))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_prestation(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_prestation(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.etablissements_ouverts_proches(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_rayon_km DOUBLE PRECISION DEFAULT 10,
  p_type     public.user_activity_type DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  nom             TEXT,
  activity_type   public.user_activity_type,
  is_open         BOOLEAN,
  pharmacy_status public.pharmacy_status,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  quartier        TEXT,
  telephone       TEXT,
  maj_le          TIMESTAMPTZ,
  distance_km     DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    p.id, p.full_name, p.activity_type, p.is_open, p.pharmacy_status,
    p.activity_latitude, p.activity_longitude, p.quartier, p.phone,
    p.activity_updated_at,
    round(public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude)::numeric, 2)::double precision
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND p.activity_type IS DISTINCT FROM 'candidate'
    AND p.activity_latitude IS NOT NULL
    AND p.activity_longitude IS NOT NULL
    AND (p_type IS NULL OR p.activity_type = p_type)
    AND public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude) <= p_rayon_km
  ORDER BY p.is_open DESC,
           public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude) ASC
  LIMIT 60;
$$;

REVOKE ALL ON FUNCTION public.etablissements_ouverts_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, public.user_activity_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.etablissements_ouverts_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, public.user_activity_type) TO anon, authenticated;
