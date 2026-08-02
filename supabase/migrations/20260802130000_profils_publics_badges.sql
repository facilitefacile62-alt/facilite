-- Ajoute badges à la vue profils_publics, pour cohérence avec l'affichage
-- déjà en place sur /offres/[id] et /recruteurs/[id] — pas encore câblé
-- côté UI de /in/[username] (signalé comme reste à faire).
DROP VIEW IF EXISTS public.profils_publics;
CREATE VIEW public.profils_publics
WITH (security_invoker = off) AS
SELECT
  id,
  slug,
  full_name,
  headline,
  bio,
  avatar_url,
  cover_url,
  location,
  city,
  experiences,
  educations,
  pinned_details,
  badges,
  CASE WHEN show_contact THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_contact THEN phone         ELSE NULL END AS phone,
  CASE WHEN show_contact THEN website_url   ELSE NULL END AS website_url
FROM public.profiles
WHERE is_public = true;

REVOKE ALL ON public.profils_publics FROM PUBLIC;
GRANT SELECT ON public.profils_publics TO anon, authenticated;
