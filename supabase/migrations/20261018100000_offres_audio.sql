-- Audio facultatif d'une offre d'emploi (lecteur sur les cartes d'offres, site et application).
--
-- L'audio est PUBLIÉ avec l'offre mais n'est jamais obligatoire : audio_url reste NULL pour toute offre
-- sans audio, et la publication ne l'exige pas. Le fichier est déposé dans le bucket public « job-offers »
-- (même bucket et mêmes règles que les affiches : dossier {auth.uid()}/..., recruteurs et admins), la
-- colonne ne garde que son URL publique.
--
-- Aucune écriture directe supplémentaire n'est accordée : la colonne se renseigne par les mêmes chemins
-- que le reste de l'offre (insertion/mise à jour d'offre par son recruteur ou un admin).

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS audio_url TEXT
  CHECK (audio_url IS NULL OR char_length(audio_url) <= 1000);
