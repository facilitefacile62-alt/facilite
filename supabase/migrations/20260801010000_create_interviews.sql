-- Entretiens à distance (visioconférence) : un recruteur planifie/démarre un
-- entretien vidéo instantané avec un candidat, depuis l'onglet "Candidatures
-- reçues" ou la Messagerie. Une ligne = un salon de visio éphémère (Daily.co)
-- rattaché à une candidature précise (jamais à une conversation seule, pour
-- éviter toute ambiguïté si un candidat a postulé à plusieurs offres du même
-- recruteur).

CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.candidatures(id) ON DELETE CASCADE NOT NULL,
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE NOT NULL,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'daily',
  room_name TEXT NOT NULL,
  room_url TEXT NOT NULL,
  -- 'active' dès la création (salon instantané) ; pas d'état 'scheduled'
  -- pour l'instant, la fonctionnalité ne couvre que le démarrage immédiat
  -- décrit dans la mission, pas une vraie planification calendaire.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON public.interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_recruiter_id ON public.interviews(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement les deux parties concernées par CET entretien précis
-- (jamais "tous les entretiens du recruteur" ni "tous ceux du candidat" par
-- inadvertance — la condition porte sur recruiter_id/candidate_id de la
-- ligne elle-même, déjà scellés à la création).
DROP POLICY IF EXISTS "Recruteur et candidat lisent leurs propres entretiens" ON public.interviews;
CREATE POLICY "Recruteur et candidat lisent leurs propres entretiens" ON public.interviews
  FOR SELECT USING (
    auth.uid() = recruiter_id OR auth.uid() = candidate_id
  );

-- Création : uniquement le recruteur propriétaire de l'offre liée à la
-- candidature — jamais le candidat, jamais un tiers. La cohérence
-- recruiter_id/candidate_id/job_offer_id avec la candidature réelle est
-- vérifiée par l'API (service role), cette policy protège un insert direct
-- depuis un client authentifié comme recruteur.
DROP POLICY IF EXISTS "Un recruteur planifie un entretien sur ses offres" ON public.interviews;
CREATE POLICY "Un recruteur planifie un entretien sur ses offres" ON public.interviews
  FOR INSERT WITH CHECK (
    auth.uid() = recruiter_id
    AND EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = interviews.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.candidatures
      WHERE candidatures.id = interviews.application_id
        AND candidatures.job_offer_id = interviews.job_offer_id
        AND candidatures.user_id = interviews.candidate_id
    )
  );

-- Mise à jour de statut (ex: 'ended') : les deux parties, jamais le contenu
-- (room_url etc.), rien à réécrire une fois le salon créé.
DROP POLICY IF EXISTS "Recruteur et candidat cloturent leur entretien" ON public.interviews;
CREATE POLICY "Recruteur et candidat cloturent leur entretien" ON public.interviews
  FOR UPDATE USING (
    auth.uid() = recruiter_id OR auth.uid() = candidate_id
  ) WITH CHECK (
    auth.uid() = recruiter_id OR auth.uid() = candidate_id
  );
