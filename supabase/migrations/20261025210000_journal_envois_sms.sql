-- Journal des envois de SMS du « Send SMS Hook » (code de connexion par téléphone) : qui a demandé un code (numéro HACHÉ, jamais en clair, jamais le code),
-- par quel fournisseur il est parti (Orange ou Twilio), avec quel résultat, en combien de temps. Sert à mesurer les délais, à repérer un abus et à limiter les alertes
-- (au plus une par heure). Écrit et lu par le serveur seulement (service_role) : aucun droit ni aucune policy pour les applications. Purgé après 90 jours par
-- le contrôle quotidien du solde (/api/cron/solde-sms). Additif : aucune table existante n'est touchée. Retour arrière : docs/rollbacks/20261025210000_journal_envois_sms.down.sql.

CREATE TABLE IF NOT EXISTS public.sms_envois_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  evenement TEXT NOT NULL CHECK (evenement IN ('envoi', 'alerte')),
  numero_hash TEXT,
  numero_fin TEXT CHECK (numero_fin IS NULL OR char_length(numero_fin) <= 3),
  fournisseur TEXT NOT NULL CHECK (fournisseur IN ('orange', 'twilio', 'aucun')),
  mode TEXT NOT NULL CHECK (mode IN ('reel', 'a_blanc')),
  resultat TEXT NOT NULL CHECK (resultat IN ('ok', 'echec', 'limite', 'refuse')),
  code_http INTEGER,
  duree_ms INTEGER,
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 120)
);

ALTER TABLE public.sms_envois_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_envois_journal FROM PUBLIC, anon, authenticated;
-- Depuis le correctif DEFAULT PRIVILEGES (2026-08-07), une table neuve ne donne aucun droit : le serveur a besoin du sien, explicite.
GRANT ALL ON public.sms_envois_journal TO service_role;

CREATE INDEX IF NOT EXISTS sms_envois_journal_numero ON public.sms_envois_journal (numero_hash, cree_le DESC) WHERE numero_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_envois_journal_evenement ON public.sms_envois_journal (evenement, cree_le DESC);
