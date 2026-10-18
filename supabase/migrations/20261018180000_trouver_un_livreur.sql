-- « Trouver un livreur » : liste des livreurs accrédités et actifs, par zone.
--
-- Demande du propriétaire (18/10/2026) : « Devenir livreur » est public pour que les acheteurs trouvent des
-- livreurs dans leur zone. Les livreurs s'inscrivent précisément pour être contactés : on expose donc leur
-- prénom, leur véhicule, leur zone et leur numéro, mais seulement aux comptes CONNECTÉS (jamais aux visiteurs
-- ni à anon, pour qu'un robot ne moissonne pas les numéros), et jamais un livreur suspendu.
-- La table `livreurs` garde sa RLS stricte (soi-même, administrateurs, acheteur de la commande) : cette
-- fonction est la seule porte de lecture élargie, avec des colonnes choisies une à une.
-- p_zone : texte libre comparé sans accents ni majuscules à la zone du livreur (NULL = toutes les zones).

CREATE OR REPLACE FUNCTION public.lister_livreurs_actifs(p_zone TEXT DEFAULT NULL, p_limite INTEGER DEFAULT 30)
RETURNS TABLE (prenom TEXT, type_vehicule TEXT, zone TEXT, telephone TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_zone TEXT := nullif(btrim(coalesce(p_zone, '')), '');
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour trouver un livreur.';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(
      nullif(split_part(btrim(coalesce((
        SELECT d.nom_complet
        FROM public.livreurs_demandes d
        WHERE d.user_id = l.user_id AND d.status = 'approved'
        ORDER BY d.reviewed_at DESC NULLS LAST, d.created_at DESC
        LIMIT 1
      ), '')), ' ', 1), ''),
      'Livreur'
    ) AS prenom,
    l.type_vehicule,
    l.zone_principale AS zone,
    l.telephone
  FROM public.livreurs l
  WHERE l.statut = 'actif'
    AND l.user_id IS DISTINCT FROM v_moi
    AND (v_zone IS NULL OR public.sans_accent(coalesce(l.zone_principale, '')) LIKE '%' || public.sans_accent(v_zone) || '%')
  ORDER BY l.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limite, 30), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.lister_livreurs_actifs(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_livreurs_actifs(TEXT, INTEGER) TO authenticated;
