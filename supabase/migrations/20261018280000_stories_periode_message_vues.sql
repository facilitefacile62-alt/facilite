-- Stories : période d'affichage, message WhatsApp propre à la story, et stories vues mémorisées sur le compte.
--
-- Prompt « Stories » (§ 5) :
--  - date_debut / date_fin : une story n'est affichée que si elle est active ET dans sa période (NULL = pas de borne) ;
--  - message_whatsapp : message pré-rempli de « Commander via WhatsApp » ; {nom} est remplacé par le titre de la story.
--    Vide = « Bonjour, je souhaite commander : <titre>. » ;
--  - stories vues : mémorisées sur l'appareil ET, pour un utilisateur connecté, sur son compte (stories_vues), pour que
--    les anneaux restent gris après une reconnexion ou sur un autre appareil.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS date_debut timestamptz,
  ADD COLUMN IF NOT EXISTS date_fin timestamptz,
  ADD COLUMN IF NOT EXISTS message_whatsapp text;

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_message_whatsapp_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_message_whatsapp_check
  CHECK (message_whatsapp IS NULL OR char_length(message_whatsapp) <= 300);

-- Lecture publique : seulement les stories actives et dans leur période.
DROP POLICY IF EXISTS "Les stories actives sont lisibles par tous" ON public.stories;
CREATE POLICY "Les stories actives sont lisibles par tous"
  ON public.stories FOR SELECT
  TO anon, authenticated
  USING (
    actif = true
    AND (date_debut IS NULL OR date_debut <= now())
    AND (date_fin IS NULL OR date_fin >= now())
  );

-- Stories vues par compte : lecture de SES lignes seulement, écriture par la fonction ci-dessous (invariant 1).
CREATE TABLE IF NOT EXISTS public.stories_vues (
  user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories (id) ON DELETE CASCADE,
  vue_le   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

ALTER TABLE public.stories_vues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chacun lit ses stories vues" ON public.stories_vues;
CREATE POLICY "Chacun lit ses stories vues"
  ON public.stories_vues FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.stories_vues FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stories_vues TO authenticated;

CREATE OR REPLACE FUNCTION public.marquer_story_vue(p_story_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stories WHERE id = p_story_id) THEN
    RAISE EXCEPTION 'Story introuvable.';
  END IF;
  INSERT INTO public.stories_vues (user_id, story_id) VALUES (v_moi, p_story_id) ON CONFLICT (user_id, story_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.marquer_story_vue(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_story_vue(UUID) TO authenticated;
