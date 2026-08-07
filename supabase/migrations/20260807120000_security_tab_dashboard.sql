-- =====================================================================
-- Partie D du chantier admin (2026-08-07) : onglet Sécurité dédié.
-- Trois ajouts distincts :
--   1. Résolution des alertes (resolved_status/resolved_by/resolved_at sur
--      security_logs existante) + RPC resolve_security_alert, admin-only.
--      Pas de suppression possible (interdit explicite du client) : seul un
--      changement de statut, jamais un DELETE.
--   2. get_security_alert_history() : même contrat que get_recent_access_alerts
--      (20260806160000) mais paramétrable (fenêtre en jours + filtres
--      type/gravité) et incluant le statut de résolution — utilisée par
--      l'historique 30 jours, get_recent_access_alerts reste inchangée pour
--      ne pas risquer de régression sur l'encart du tableau de bord existant.
--   3. invariant_status : table alimentée par tests/security/invariants.spec.js
--      (afterEach, écriture privilégiée hors PostgREST) à chaque exécution
--      réelle (CI ou manuelle) — l'admin lit un vrai dernier résultat, pas
--      une valeur recalculée à la volée depuis l'UI.
-- =====================================================================

ALTER TABLE public.security_logs
  ADD COLUMN IF NOT EXISTS resolved_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolved_status IN ('open', 'resolved', 'ignored')),
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.resolve_security_alert(p_log_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  IF p_action NOT IN ('resolved', 'ignored', 'open') THEN
    RAISE EXCEPTION 'Action invalide : %', p_action;
  END IF;

  UPDATE public.security_logs
  SET resolved_status = p_action,
      resolved_by = CASE WHEN p_action = 'open' THEN NULL ELSE auth.uid() END,
      resolved_at = CASE WHEN p_action = 'open' THEN NULL ELSE now() END
  WHERE id = p_log_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_security_alert(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_security_alert(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_security_alert_history(
  p_days INT DEFAULT 30,
  p_event_type TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID, event_type TEXT, severity TEXT, actor_id UUID, actor_email TEXT,
  ip_address INET, details JSONB, created_at TIMESTAMPTZ,
  resolved_status TEXT, resolved_by_email TEXT, resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT sl.id, sl.event_type, sl.severity, sl.actor_id, u.email::TEXT, sl.ip_address, sl.details, sl.created_at,
         sl.resolved_status, ru.email::TEXT, sl.resolved_at
  FROM public.security_logs sl
  LEFT JOIN auth.users u ON u.id = sl.actor_id
  LEFT JOIN auth.users ru ON ru.id = sl.resolved_by
  WHERE sl.event_type IN ('access_denied', 'repeated_access_denial', 'cv_quota_exceeded')
    AND sl.created_at >= now() - (p_days || ' days')::interval
    AND (p_event_type IS NULL OR sl.event_type = p_event_type)
    AND (p_severity IS NULL OR sl.severity = p_severity)
  ORDER BY sl.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.get_security_alert_history(INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_security_alert_history(INT, TEXT, TEXT) TO authenticated;

-- Realtime : sans ça, l'onglet Sécurité ne recevrait jamais rien en direct.
-- RLS ("Seuls les admins lisent les logs", is_admin(auth.uid())) s'applique
-- automatiquement aux abonnements postgres_changes — un publisher/candidat
-- abonné au même canal ne reçoit rien, vérifié dans
-- tests/e2e/security-tab-realtime-and-access.spec.js. REPLICA IDENTITY FULL
-- nécessaire pour que Realtime dispose de la ligne complète (donc de
-- actor_id/target_user_id) au moment d'évaluer la policy, pas seulement la
-- clé primaire.
ALTER TABLE public.security_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_logs;

CREATE TABLE IF NOT EXISTS public.invariant_status (
  invariant_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_summary TEXT
);

ALTER TABLE public.invariant_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lit le statut des invariants"
  ON public.invariant_status FOR SELECT
  USING (public.current_user_role() = 'admin');

-- Aucune policy INSERT/UPDATE/DELETE : cette table n'est jamais écrite via
-- PostgREST/authenticated, seulement par une connexion privilégiée (CI via
-- SUPABASE_DB_URL, ou --linked en local) depuis tests/security/invariants.spec.js
-- — cohérent avec "aucune exécution SQL libre depuis l'interface" (l'admin
-- ne peut pas non plus écrire ici depuis le panneau).
GRANT SELECT ON public.invariant_status TO authenticated;
