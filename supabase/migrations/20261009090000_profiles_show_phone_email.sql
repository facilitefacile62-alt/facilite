-- =====================================================================
-- Confidentialité du profil : séparer « Afficher mon téléphone » et
-- « Afficher mon e-mail » (maquette 55 de pages-apk-complet/).
--
-- Jusqu'ici une seule colonne, profiles.show_contact, gouvernait d'un bloc
-- le téléphone, l'e-mail et le site web sur la page publique. La maquette
-- demande deux interrupteurs distincts : le client a tranché le 09/10/2026
-- (note de pages-apk-complet/LISTE.md) en demandant d'ajouter les deux
-- colonnes plutôt que de garder un seul drapeau.
--
-- Choix de conception : show_contact RESTE l'interrupteur maître du bloc
-- « coordonnées » (c'est lui que pilote le site aujourd'hui, et le couper
-- doit continuer à tout masquer d'un coup). show_phone et show_email
-- l'affinent. Un champ n'est donc public que si les DEUX sont vrais.
-- Aucune régression possible pour un profil existant : les deux nouvelles
-- colonnes sont initialisées à la valeur actuelle de show_contact.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT false;

-- Reprise de l'état actuel : un profil qui affichait ses coordonnées
-- continue d'afficher téléphone ET e-mail, à l'identique.
UPDATE public.profiles
SET show_phone = show_contact,
    show_email = show_contact
WHERE show_contact = true
  AND show_phone = false
  AND show_email = false;

-- Écriture par le propriétaire : même mécanisme que le reste du formulaire
-- de profil, un GRANT colonne par colonne (voir
-- 20260802060000_profiles_deny_by_default.sql). La RLS limite déjà la
-- ligne à son propriétaire.
GRANT UPDATE (show_phone, show_email) ON public.profiles TO authenticated;

-- La page publique /in/[username] doit honorer les deux nouveaux
-- interrupteurs. Le site web ne connaît encore que show_contact : tant
-- qu'il ne touche pas aux nouvelles colonnes, son comportement est
-- inchangé puisqu'elles valent déjà show_contact.
--
-- SECURITY DEFINER + search_path figé conservés tels quels
-- (20260814010000) : ni la signature ni le filtre is_public ne changent,
-- et aucune colonne supplémentaire n'est exposée.
CREATE OR REPLACE FUNCTION public.get_profils_publics()
RETURNS TABLE(id uuid, slug text, full_name text, headline text, bio text, avatar_url text, cover_url text, location text, city text, experiences jsonb, educations jsonb, pinned_details jsonb, badges jsonb, contact_email text, phone text, website_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
SELECT
  id, slug, full_name, headline, bio, avatar_url, cover_url, location, city,
  experiences, educations, pinned_details, badges,
  CASE WHEN show_contact AND show_email THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_contact AND show_phone THEN phone         ELSE NULL END AS phone,
  CASE WHEN show_contact                THEN website_url   ELSE NULL END AS website_url
FROM public.profiles
WHERE is_public = true AND deleted_at IS NULL;
$$;
