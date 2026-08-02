-- Audit sécurité (référentiel 101-150, point 146) : seule /api/cv/improve-text
-- déduit un crédit ; les 6 autres routes IA (ai-chat, assistant,
-- diagnostic-cv, parse-document, extract-email, process-resume) n'avaient
-- aucun plafond au-delà du rate-limit générique (20 req/min, ~28 800
-- appels/jour/compte) — un abus (ou une boucle client buggée) peut générer
-- une facture Gemini/Groq/DeepSeek importante sans aucun garde-fou dédié.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- RLS activé mais sans policy pour authenticated/anon : la table n'est
-- accessible que via service_role (nos routes serveur) ou la fonction RPC
-- ci-dessous — jamais en lecture/écriture directe depuis le navigateur.
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- Même pattern que deduct_credit (20260801210000) : incrément atomique avec
-- clause conditionnelle dans ON CONFLICT DO UPDATE ... WHERE, pour éviter la
-- race condition d'un read-then-write entre deux appels IA concurrents du
-- même utilisateur.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id UUID, p_max_daily INT)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INT;
BEGIN
  INSERT INTO public.ai_usage_daily (user_id, usage_date, call_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET call_count = ai_usage_daily.call_count + 1
    WHERE ai_usage_daily.call_count < p_max_daily;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Comme deduct_credit : appelable uniquement via service_role, jamais
-- directement par le navigateur.
REVOKE ALL ON FUNCTION public.increment_ai_usage(UUID, INT) FROM PUBLIC, anon, authenticated;
