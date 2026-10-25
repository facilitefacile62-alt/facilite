-- Nettoyage des valeurs d'EXEMPLE dans les profils existants (voir 20261025150000 pour l'origine).
--
-- Règle STRICTE : une colonne n'est vidée que si
--   1) sa valeur est EXACTEMENT celle de l'exemple (languages = « Français — Principal / Courant » seul ; skills = les trois compétences d'exemple, dans
--      cet ordre), ET
--   2) le profil n'a JAMAIS été modifié depuis sa création : updated_at au plus 5 secondes après created_at (l'inscription elle-même). Un profil modifié
--      plus tard — même sur un autre champ — n'est PAS touché : on ne peut pas savoir si la personne a gardé ces valeurs volontairement.
-- Chaque colonne est jugée séparément. Les autres colonnes, et updated_at, ne changent pas.
--
-- Retour arrière possible : l'ancienne valeur de chaque colonne vidée est gardée dans profils_valeurs_exemple_nettoyees (réservée au serveur) ;
-- docs/rollbacks/20261025160000_nettoyage_valeurs_exemple_profils.down.sql la remet, seulement là où la colonne est restée vide.

CREATE TABLE IF NOT EXISTS public.profils_valeurs_exemple_nettoyees (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  languages JSONB,   -- ancienne valeur si languages a été vidée, sinon NULL
  skills JSONB,      -- ancienne valeur si skills a été vidée, sinon NULL
  nettoye_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profils_valeurs_exemple_nettoyees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profils_valeurs_exemple_nettoyees FROM PUBLIC, anon, authenticated;

-- 1) Garder l'ancienne valeur de ce qui va être vidé.
INSERT INTO public.profils_valeurs_exemple_nettoyees (user_id, languages, skills)
SELECT p.id,
       CASE WHEN p.languages = '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb THEN p.languages END,
       CASE WHEN p.skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb THEN p.skills END
  FROM public.profiles p
 WHERE p.updated_at <= p.created_at + interval '5 seconds'
   AND (p.languages = '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb
        OR p.skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- 2) Vider, colonne par colonne, avec les MÊMES conditions (updated_at n'est pas modifié).
UPDATE public.profiles p
   SET languages = CASE WHEN p.languages = '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb THEN '[]'::jsonb ELSE p.languages END,
       skills = CASE WHEN p.skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb THEN '[]'::jsonb ELSE p.skills END
 WHERE p.updated_at <= p.created_at + interval '5 seconds'
   AND (p.languages = '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb
        OR p.skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb);
