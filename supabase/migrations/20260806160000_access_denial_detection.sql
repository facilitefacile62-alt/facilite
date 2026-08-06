-- =====================================================================
-- 4B du chantier du 2026-08-06 (docs/incident-2026-08-06.md) : détection
-- des refus d'accès répétés. « Un balayage de mes politiques RLS pendant
-- des semaines sans que rien ne s'allume » — le trou explicitement désigné
-- comme le plus important par l'utilisateur suite aux deux incidents du
-- même jour, tous deux restés invisibles faute de tout mécanisme de
-- détection.
--
-- Portée volontairement limitée au démarrage (demande explicite : ne pas
-- tout capturer d'un coup) : uniquement les Route Handlers authentifiées
-- via requireUser() sur les routes touchant à des données personnelles
-- (CVthèque, candidatures) — voir src/lib/apiAuth.js. Les accès directs
-- PostgREST (profils/messagerie, RLS pure, pas de Route Handler
-- intermédiaire dans ce projet) restent hors de portée de cette étape,
-- documenté explicitement plutôt que silencieusement absent.
-- =====================================================================

-- 1. Étend security_logs (jamais une nouvelle table security_events, comme
--    convenu dès la Partie 5 du chantier précédent) avec une colonne dédiée
--    pour l'IP — nécessaire pour un regroupement/seuil efficace, une
--    extraction JSONB à chaque requête serait plus coûteuse à indexer
--    correctement pour ce cas d'usage précis.
ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS ip_address INET;

CREATE INDEX IF NOT EXISTS idx_security_logs_actor_created ON public.security_logs(actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_created ON public.security_logs(ip_address, created_at DESC) WHERE ip_address IS NOT NULL;

-- 2. Point d'écriture dédié aux refus d'accès (401/403), appelé depuis
--    requireUser() via service_role (jamais authenticated/anon — même
--    schéma que log_security_event). Regroupe par compte ET par IP sur une
--    fenêtre de 5 minutes ; au-delà de 10 refus sur l'une ou l'autre
--    dimension, une seconde entrée d'ALERTE est créée (severity='critical',
--    event_type='repeated_access_denial') — une seule par fenêtre de 5
--    minutes glissante, pas une par refus supplémentaire, pour ne pas noyer
--    le panneau admin sous des doublons pendant un balayage prolongé.
--
-- Seuil de 10 refus / 5 minutes : un token expiré en cours de session
-- génère typiquement 1 à 3 refus (retry client) avant une reconnexion —
-- largement sous ce seuil. Un balayage actif de politiques RLS ou de
-- routes protégées produit un volume nettement supérieur en quelques
-- secondes à quelques minutes. Le seuil est pensé pour se déclencher tôt
-- (dans les premières minutes d'un balayage réel), pas pour tolérer un
-- usage normal bruyant.
CREATE OR REPLACE FUNCTION public.log_access_denial(
  p_actor_id UUID,
  p_ip_address TEXT,
  p_route TEXT,
  p_status_code INT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ip INET;
  v_new_id UUID;
  v_window_start TIMESTAMPTZ := now() - interval '5 minutes';
  v_threshold CONSTANT INT := 10;
  v_count_by_actor INT := 0;
  v_count_by_ip INT := 0;
  v_already_alerted BOOLEAN;
BEGIN
  BEGIN
    v_ip := p_ip_address::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO public.security_logs (event_type, severity, actor_id, ip_address, details)
  VALUES (
    'access_denied',
    'info',
    p_actor_id,
    v_ip,
    jsonb_build_object('route', p_route, 'status_code', p_status_code, 'reason', p_reason)
  )
  RETURNING id INTO v_new_id;

  IF p_actor_id IS NOT NULL THEN
    SELECT count(*) INTO v_count_by_actor
    FROM public.security_logs
    WHERE event_type = 'access_denied' AND actor_id = p_actor_id AND created_at >= v_window_start;
  END IF;

  IF v_ip IS NOT NULL THEN
    SELECT count(*) INTO v_count_by_ip
    FROM public.security_logs
    WHERE event_type = 'access_denied' AND ip_address = v_ip AND created_at >= v_window_start;
  END IF;

  IF v_count_by_actor >= v_threshold OR v_count_by_ip >= v_threshold THEN
    SELECT EXISTS(
      SELECT 1 FROM public.security_logs
      WHERE event_type = 'repeated_access_denial'
        AND created_at >= v_window_start
        AND ((p_actor_id IS NOT NULL AND actor_id = p_actor_id) OR (v_ip IS NOT NULL AND ip_address = v_ip))
    ) INTO v_already_alerted;

    IF NOT v_already_alerted THEN
      INSERT INTO public.security_logs (event_type, severity, actor_id, ip_address, details)
      VALUES (
        'repeated_access_denial',
        'critical',
        p_actor_id,
        v_ip,
        jsonb_build_object(
          'route', p_route,
          'count_by_actor_5min', v_count_by_actor,
          'count_by_ip_5min', v_count_by_ip,
          'threshold', v_threshold
        )
      );
    END IF;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_denial(UUID, TEXT, TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;

-- 3. Lecture pour le panneau admin : dernières alertes non résolues +
--    échecs de connexion récents (auth.audit_log_entries — jamais dupliqué
--    dans security_logs, uniquement interrogé à la demande). Admin only.
--
-- ❓ Constaté en construisant cette fonction, le 2026-08-06 : auth.audit_log_entries
-- contient actuellement 0 ligne dans ce projet, malgré de nombreuses vraies
-- connexions/inscriptions le jour même — l'audit natif Supabase ne semble
-- pas alimenté ici pour une raison non déterminable en SQL (config Auth
-- côté Dashboard, rétention agressive, ou autre). Cette fonction reste
-- correcte et prête si ça se résout ; ne pas s'étonner d'un tableau vide
-- pour cette partie tant que ce n'est pas éclairci côté Dashboard/support.
CREATE OR REPLACE FUNCTION public.get_recent_access_alerts(p_hours INT DEFAULT 24)
RETURNS TABLE(
  id UUID,
  event_type TEXT,
  severity TEXT,
  actor_id UUID,
  actor_email TEXT,
  ip_address INET,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT sl.id, sl.event_type, sl.severity, sl.actor_id, u.email::TEXT, sl.ip_address, sl.details, sl.created_at
  FROM public.security_logs sl
  LEFT JOIN auth.users u ON u.id = sl.actor_id
  WHERE sl.event_type IN ('access_denied', 'repeated_access_denial', 'cv_quota_exceeded')
    AND sl.created_at >= now() - (p_hours || ' hours')::interval
  ORDER BY sl.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_access_alerts(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recent_access_alerts(INT) TO authenticated;

-- 4. Purge de vie privée : l'IP est une donnée personnelle. Conservée 30
--    jours (assez pour repérer un balayage prolongé et enquêter), puis
--    NULLIFIÉE — jamais la ligne supprimée (security_logs reste
--    append-only, aucune suppression, pour personne, y compris via cette
--    fonction). L'événement (qui, quoi, quand) reste utile à long terme
--    pour une revue de posture de sécurité ; l'IP précise, elle, ne l'est
--    plus après 30 jours et devient un risque de vie privée sans bénéfice
--    de sécurité supplémentaire.
CREATE OR REPLACE FUNCTION public.purge_old_access_log_ips()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purged INT;
BEGIN
  UPDATE public.security_logs
  SET ip_address = NULL
  WHERE ip_address IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_purged = ROW_COUNT;
  RETURN v_purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_access_log_ips() FROM PUBLIC, anon, authenticated;
