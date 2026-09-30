-- Corrige admin_lister_sessions_du_jour() : la page /admin/sessions échouait
-- systématiquement ("Impossible de charger les données de fréquentation"),
-- à chaque appel, depuis sa création (20260926050000_presence_heartbeats.sql).
--
-- Cause réelle (diagnostiquée en lecture seule avant ce correctif) : un
-- LAG() OVER(...) imbriqué directement dans l'expression d'un SUM() OVER(...)
-- au même niveau de SELECT — PostgreSQL refuse d'imbriquer un appel de
-- fonction fenêtrée dans un autre (erreur 42P20 "window function calls
-- cannot be nested"). Le bug n'a jamais dépendu des données : même avec des
-- battements de présence réels en base (95 aujourd'hui au moment du
-- diagnostic), la fonction levait une erreur avant de renvoyer la moindre
-- ligne.
--
-- Correctif : le calcul de LAG() est isolé dans son propre CTE
-- (heartbeats_avec_ecart), qui ne calcule qu'UNE fonction fenêtrée. Le CTE
-- suivant (heartbeats_groupes) applique ensuite SUM() OVER() sur une colonne
-- ordinaire (le booléen déjà calculé), plus sur un appel de fonction fenêtrée
-- — même logique de regroupement "gap-and-island", juste répartie sur deux
-- étapes au lieu d'une.
--
-- Second bug démasqué par cette correction (jamais atteint tant que le
-- premier bloquait tout) : auth.users.email est varchar(255), incompatible
-- avec la colonne de sortie déclarée TEXT ("structure of query does not
-- match function result type"). Cast explicite ::TEXT ajouté sur nom/email.
CREATE OR REPLACE FUNCTION public.admin_lister_sessions_du_jour()
RETURNS TABLE (
  user_id UUID,
  nom TEXT,
  email TEXT,
  minutes_aujourdhui INT,
  sessions_aujourdhui INT,
  dernier_acces TIMESTAMPTZ,
  en_ligne BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs.';
  END IF;

  RETURN QUERY
  WITH heartbeats_avec_ecart AS (
    SELECT
      h.user_id,
      h.created_at,
      (
        h.created_at - LAG(h.created_at) OVER (PARTITION BY h.user_id ORDER BY h.created_at)
        > INTERVAL '3 minutes'
      ) AS nouveau_groupe
    FROM public.presence_heartbeats h
    WHERE h.created_at >= date_trunc('day', now())
  ),
  heartbeats_groupes AS (
    SELECT
      he.user_id,
      he.created_at,
      SUM(CASE WHEN he.nouveau_groupe THEN 1 ELSE 0 END) OVER (PARTITION BY he.user_id ORDER BY he.created_at) AS groupe_session
    FROM heartbeats_avec_ecart he
  ),
  sessions AS (
    SELECT
      hg.user_id,
      hg.groupe_session,
      MIN(hg.created_at) AS debut,
      MAX(hg.created_at) AS fin
    FROM heartbeats_groupes hg
    GROUP BY hg.user_id, hg.groupe_session
  ),
  agrege AS (
    SELECT
      s.user_id,
      COUNT(*)::INT AS sessions_aujourdhui,
      SUM(GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.fin - s.debut)) / 60)))::INT AS minutes_aujourdhui,
      MAX(s.fin) AS dernier_acces
    FROM sessions s
    GROUP BY s.user_id
  )
  SELECT
    a.user_id,
    COALESCE(p.full_name, split_part(u.email, '@', 1))::TEXT AS nom,
    u.email::TEXT,
    a.minutes_aujourdhui,
    a.sessions_aujourdhui,
    a.dernier_acces,
    (a.dernier_acces >= now() - INTERVAL '2 minutes') AS en_ligne
  FROM agrege a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY a.dernier_acces DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lister_sessions_du_jour() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lister_sessions_du_jour() TO authenticated;
