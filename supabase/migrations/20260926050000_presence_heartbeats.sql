-- Suivi de fréquentation RÉEL du site web (remplace l'aperçu à données de
-- démonstration livré précédemment, page /admin/sessions). L'utilisateur a
-- explicitement refusé les données fictives : ce point construit le vrai
-- signal de présence, site web uniquement (l'app mobile n'a aucune
-- instrumentation de ce type pour l'instant, voir le plan mobile séparé —
-- rien ici ne dépend de ni n'affecte l'app).
--
-- Principe : le navigateur envoie un "heartbeat" (ping minimal, aucune
-- donnée que l'horodatage serveur) toutes les ~60s tant que l'onglet est
-- visible (voir AuthContext.jsx). Depuis ce journal brut, on reconstruit
-- côté SQL des "sessions" par regroupement de battements séparés de moins
-- de 3 minutes (gap-and-island, LAG() + fenêtre), puis on agrège par
-- utilisateur pour la journée en cours.

CREATE TABLE IF NOT EXISTS public.presence_heartbeats (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_user_created ON public.presence_heartbeats(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_heartbeats_created ON public.presence_heartbeats(created_at);

ALTER TABLE public.presence_heartbeats ENABLE ROW LEVEL SECURITY;

-- Aucune policy, aucun GRANT à authenticated/anon : cette table n'est
-- jamais lue ni écrite directement depuis le client. Écriture exclusive via
-- enregistrer_presence_heartbeat() (fixe user_id/created_at côté serveur,
-- un utilisateur ne peut jamais falsifier ces valeurs ni celles d'un
-- autre compte), lecture exclusive via admin_lister_sessions_du_jour()
-- (agrège, ne renvoie jamais les lignes brutes). Même doctrine que
-- ai_usage_daily/cv_consultations/assistant_faq — voir l'entrée ajoutée à
-- JUSTIFIED_ZERO_POLICY dans tests/security/invariants.spec.js.

CREATE OR REPLACE FUNCTION public.enregistrer_presence_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.presence_heartbeats (user_id) VALUES (auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.enregistrer_presence_heartbeat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_presence_heartbeat() TO authenticated;

-- Seuil quotidien minimum affiché dans le tableau de bord, pour que
-- l'admin repère d'un coup d'oeil qui est en dessous et doive le relancer
-- ("c'est moi qui vais surveiller les tableaux et les rappeler"). Une
-- seule ligne (singleton), modifiable via admin_definir_minimum_session
-- sans nouvelle migration à chaque ajustement.
CREATE TABLE IF NOT EXISTS public.session_analytics_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  minimum_minutes_jour INT NOT NULL DEFAULT 30 CHECK (minimum_minutes_jour > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.session_analytics_config (id, minimum_minutes_jour)
VALUES (1, 30)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.session_analytics_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seuls les admins lisent le seuil de presence" ON public.session_analytics_config;
CREATE POLICY "Seuls les admins lisent le seuil de presence" ON public.session_analytics_config
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Lecture directe (pas de RPC nécessaire pour un simple entier) : la
-- policy ci-dessus filtre déjà à 0 ligne pour un non-admin, le GRANT ne
-- fait qu'autoriser la requête à s'exécuter. Écriture exclusivement via
-- admin_definir_minimum_session ci-dessous, jamais un UPDATE direct.
GRANT SELECT ON public.session_analytics_config TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_definir_minimum_session(p_minutes INT)
RETURNS public.session_analytics_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.session_analytics_config;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs.';
  END IF;

  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RAISE EXCEPTION 'Le minimum doit etre un nombre de minutes positif.';
  END IF;

  UPDATE public.session_analytics_config
  SET minimum_minutes_jour = p_minutes,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 1
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_definir_minimum_session(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_minimum_session(INT) TO authenticated;

-- admin_lister_sessions_du_jour : agrégation du jour en cours (Sénégal =
-- UTC+0, donc now()/date_trunc('day', now()) correspondent déjà à la
-- journée locale, pas de conversion de fuseau nécessaire). Regroupement
-- "gap-and-island" : un nouvel écart de plus de 3 minutes entre deux
-- battements démarre une nouvelle session. Chaque session compte au moins
-- 1 minute (un battement isolé représente une vraie présence, pas 0).
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
  WITH heartbeats_groupes AS (
    SELECT
      h.user_id,
      h.created_at,
      SUM(
        CASE
          WHEN h.created_at - LAG(h.created_at) OVER (PARTITION BY h.user_id ORDER BY h.created_at) > INTERVAL '3 minutes'
          THEN 1 ELSE 0
        END
      ) OVER (PARTITION BY h.user_id ORDER BY h.created_at) AS groupe_session
    FROM public.presence_heartbeats h
    WHERE h.created_at >= date_trunc('day', now())
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
    COALESCE(p.full_name, split_part(u.email, '@', 1)) AS nom,
    u.email,
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
