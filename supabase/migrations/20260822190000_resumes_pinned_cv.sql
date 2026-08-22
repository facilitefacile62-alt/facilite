-- CV épinglé (point 9, 2026-08-22).
--
-- Aujourd'hui, la présélection du CV à l'ApplyModal (src/components/ApplyModal.jsx)
-- est implicite et fragile : le CV le PLUS RÉCEMMENT CRÉÉ parmi ceux qui ont
-- un file_url, sans qu'aucun choix délibéré ne soit jamais enregistré nulle
-- part. is_pinned rend ce choix explicite et stable dans le temps.
--
-- Index unique partiel : garantit au plus un CV épinglé par candidat au
-- niveau base (même patron défensif que document_access_requests, plan en
-- attente) — pas seulement une convention respectée côté application.
ALTER TABLE public.resumes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX idx_resumes_one_pinned_per_user ON public.resumes (user_id) WHERE is_pinned;

-- Aucune nouvelle policy RLS nécessaire : "Users can manage their own
-- resumes" (ALL, auth.uid() = user_id) couvre déjà l'écriture de cette
-- colonne par son propriétaire, comme tout autre champ de resumes.
