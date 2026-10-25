-- Annulation de 20261025160000_nettoyage_valeurs_exemple_profils.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Remet les valeurs d'exemple SEULEMENT là où la colonne est encore vide (si la personne a rempli sa liste depuis, on n'y touche pas).
UPDATE public.profiles p SET languages = l.languages
  FROM public.profils_valeurs_exemple_nettoyees l
 WHERE p.id = l.user_id AND l.languages IS NOT NULL AND p.languages = '[]'::jsonb;
UPDATE public.profiles p SET skills = l.skills
  FROM public.profils_valeurs_exemple_nettoyees l
 WHERE p.id = l.user_id AND l.skills IS NOT NULL AND p.skills = '[]'::jsonb;
DROP TABLE IF EXISTS public.profils_valeurs_exemple_nettoyees;
