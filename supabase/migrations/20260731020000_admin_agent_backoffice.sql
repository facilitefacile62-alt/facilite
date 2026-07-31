-- Back-office admin & gestion des agents : rôle 'agent', livraison du CV
-- finalisé par l'expert, et accès en lecture aux commandes assignées.

-- 1. Rôle 'agent' — même principe que 'admin' : jamais accessible depuis le
-- signup public (handle_new_user() force 'candidat' pour toute valeur hors
-- 'candidat'/'recruteur'), uniquement assignable en direct par migration/service_role.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('candidat', 'recruteur', 'admin', 'agent'));

-- 2. Livraison du CV finalisé par l'agent
ALTER TABLE public.agent_assignments
  ADD COLUMN IF NOT EXISTS completed_cv_url TEXT;

-- 3. orders : un agent lit les commandes qui lui sont assignées (pour
-- connaître le modèle de CV, l'option choisie... de son dossier en cours).
DROP POLICY IF EXISTS "Un agent lit les commandes assignees" ON public.orders;
CREATE POLICY "Un agent lit les commandes assignees" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_assignments aa
      WHERE aa.order_id = orders.id AND aa.agent_id = auth.uid()
    )
  );

-- 4. agent_assignments : un agent met à jour SA PROPRE affectation (statut,
-- URL du CV livré). Le WITH CHECK conserve auth.uid() = agent_id après
-- l'update, ce qui empêche de facto une ré-affectation à un autre agent.
-- L'attribution initiale (choisir QUEL agent) reste une action admin, déjà
-- couverte par la policy "Un admin gère toutes les affectations" (FOR ALL).
DROP POLICY IF EXISTS "Un agent met a jour sa propre affectation" ON public.agent_assignments;
CREATE POLICY "Un agent met a jour sa propre affectation" ON public.agent_assignments
  FOR UPDATE USING (auth.uid() = agent_id) WITH CHECK (auth.uid() = agent_id);

-- 5. Bucket privé pour les CV finalisés par les agents. Chemin attendu :
-- {candidate_id}/{order_id}.pdf — même convention que le bucket "invoices".
INSERT INTO storage.buckets (id, name, public)
VALUES ('completed_cvs', 'completed_cvs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Un candidat lit son cv finalise" ON storage.objects;
CREATE POLICY "Un candidat lit son cv finalise" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'completed_cvs' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Écriture réservée à l'agent explicitement assigné au dossier du candidat
-- concerné (pas à n'importe quel agent) — vérifié via agent_assignments.
DROP POLICY IF EXISTS "Un agent televerse le cv de son dossier assigne" ON storage.objects;
CREATE POLICY "Un agent televerse le cv de son dossier assigne" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'completed_cvs'
    AND EXISTS (
      SELECT 1 FROM public.agent_assignments aa
      WHERE aa.agent_id = auth.uid() AND aa.candidate_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Un agent met a jour le cv de son dossier assigne" ON storage.objects;
CREATE POLICY "Un agent met a jour le cv de son dossier assigne" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'completed_cvs'
    AND EXISTS (
      SELECT 1 FROM public.agent_assignments aa
      WHERE aa.agent_id = auth.uid() AND aa.candidate_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Un admin gere tous les cv finalises" ON storage.objects;
CREATE POLICY "Un admin gere tous les cv finalises" ON storage.objects
  FOR ALL USING (bucket_id = 'completed_cvs' AND public.current_user_role() = 'admin')
  WITH CHECK (bucket_id = 'completed_cvs' AND public.current_user_role() = 'admin');
