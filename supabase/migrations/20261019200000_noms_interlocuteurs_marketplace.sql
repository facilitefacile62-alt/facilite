-- Noms des interlocuteurs des discussions Locaux (Marketplace).
--
-- Constat (19/10/2026) : la liste et l'en-tête d'une discussion Locaux affichaient « Acheteur / vendeur » à la place du
-- nom de l'autre personne. Cause : public.profiles est privée (un utilisateur ne lit que SON profil) — c'est voulu, la
-- table contient téléphone, e-mail, date de naissance… — donc l'application ne pouvait pas lire le nom de l'interlocuteur.
--
-- Cette fonction n'expose que ce qui est nécessaire pour afficher une discussion, et seulement à ses participants :
--  - si l'interlocuteur a une boutique active : le NOM DE LA BOUTIQUE (c'est ainsi que l'acheteur connaît le vendeur) ;
--  - sinon : son prénom et l'initiale de son nom (« Awa D. »), jamais le nom complet ni aucune autre colonne.
-- Seules les conversations de l'appelant qui contiennent au moins un message Marketplace sont concernées : la fonction ne
-- permet ni de lire le nom d'un inconnu, ni celui d'un interlocuteur Facilité (Support RH, candidatures).

CREATE OR REPLACE FUNCTION public.noms_interlocuteurs_marketplace(p_conversation_ids UUID[])
RETURNS TABLE (conversation_id UUID, nom TEXT, est_boutique BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    COALESCE(
      boutique.nom,
      NULLIF(
        btrim(
          split_part(btrim(p.full_name), ' ', 1)
          || CASE
               WHEN position(' ' IN btrim(p.full_name)) > 0
                 THEN ' ' || upper(left(btrim(substring(btrim(p.full_name) FROM position(' ' IN btrim(p.full_name)) + 1)), 1)) || '.'
               ELSE ''
             END
        ),
        ''
      )
    ) AS nom,
    (boutique.nom IS NOT NULL) AS est_boutique
  FROM public.conversations c
  LEFT JOIN public.profiles p
    ON p.id = CASE WHEN c.user_1_id = v_moi THEN c.user_2_id ELSE c.user_1_id END
  LEFT JOIN LATERAL (
    SELECT s.nom
    FROM public.marketplace_stores s
    WHERE s.owner_id = CASE WHEN c.user_1_id = v_moi THEN c.user_2_id ELSE c.user_1_id END
      AND s.actif = true
    ORDER BY s.created_at DESC
    LIMIT 1
  ) boutique ON true
  WHERE c.id = ANY (p_conversation_ids)
    AND (c.user_1_id = v_moi OR c.user_2_id = v_moi)
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.conversation_id = c.id AND m.type_discussion = 'MARKETPLACE'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.noms_interlocuteurs_marketplace(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noms_interlocuteurs_marketplace(UUID[]) TO authenticated;
