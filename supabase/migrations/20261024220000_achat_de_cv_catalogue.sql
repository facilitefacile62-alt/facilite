-- « Achat de CV » (Profil Facilité) — point 1 : catalogue des modèles de CV, achats, et les deux espaces de stockage PRIVÉS.
--
-- Principes (voir « Prompt-Achat-de-CV.md ») :
--  - les PDF d'origine ne sont JAMAIS accessibles à l'application avant l'achat : le client ne lit jamais la table des modèles (aucun droit), il
--    passe par lister_modeles_cv(), qui ne renvoie ni chemins de fichiers ni aucun fichier ;
--  - les images d'aperçu (filigranées, basse définition) et le fichier livré après achat vivent dans deux buckets PRIVÉS, servis seulement par des routes
--    serveur qui vérifient la session (aperçu) ou l'achat confirmé (fichier livré) ;
--  - un modèle n'est « acheté » qu'après confirmation du serveur (webhook Orange Money) : le client n'a aucun droit d'écriture sur les achats ;
--  - les prix sont toujours ceux de la base (saisis par l'administrateur), jamais ceux envoyés par l'application ; toujours supérieurs à 0.

CREATE TABLE IF NOT EXISTS public.cv_modeles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL CHECK (char_length(btrim(nom)) BETWEEN 2 AND 60),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  prix_xof INTEGER NOT NULL CHECK (prix_xof > 0 AND prix_xof <= 1000000),
  actif BOOLEAN NOT NULL DEFAULT FALSE,
  ordre INTEGER NOT NULL DEFAULT 0,
  nb_pages INTEGER NOT NULL DEFAULT 0 CHECK (nb_pages BETWEEN 0 AND 10),
  -- Chemins dans le bucket privé cv-modeles-apercus : une image filigranée en basse définition par page.
  apercus TEXT[] NOT NULL DEFAULT '{}',
  -- Chemin du fichier livré après achat dans le bucket privé cv-modeles-livres (PDF ou Word).
  fichier_livre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cv_modeles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cv_modeles FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS cv_modeles_actifs ON public.cv_modeles (ordre, created_at) WHERE actif;

CREATE TABLE IF NOT EXISTS public.cv_achats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modele_id UUID NOT NULL REFERENCES public.cv_modeles(id),
  -- Prix figé À LA COMMANDE (si l'administrateur change le prix ensuite, l'achat en cours garde celui demandé à Orange).
  montant_xof INTEGER NOT NULL CHECK (montant_xof > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  -- qrId Orange à la création, puis transactionId Orange une fois payé.
  provider_reference TEXT,
  callback_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paye_le TIMESTAMPTZ
);
ALTER TABLE public.cv_achats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cv_achats FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, modele_id, montant_xof, status, created_at, paye_le) ON public.cv_achats TO authenticated;
DROP POLICY IF EXISTS "Un utilisateur lit ses propres achats de CV" ON public.cv_achats;
CREATE POLICY "Un utilisateur lit ses propres achats de CV" ON public.cv_achats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Un modèle ne s'achète qu'UNE fois par compte (achat définitif) ; un même transactionId Orange ne valide qu'un seul achat.
CREATE UNIQUE INDEX IF NOT EXISTS cv_achats_un_par_modele ON public.cv_achats (user_id, modele_id) WHERE status = 'success';
CREATE UNIQUE INDEX IF NOT EXISTS cv_achats_transaction_unique ON public.cv_achats (provider_reference) WHERE status = 'success' AND provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS cv_achats_utilisateur ON public.cv_achats (user_id, created_at DESC);

-- Catalogue vu par l'application : modèles ACTIFS seulement, SANS chemin de fichier ; « achete » = achat confirmé pour l'appelant.
CREATE OR REPLACE FUNCTION public.lister_modeles_cv()
RETURNS TABLE (id UUID, nom TEXT, description TEXT, prix_xof INTEGER, nb_pages INTEGER, achete BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;
  RETURN QUERY
    SELECT m.id, m.nom, m.description, m.prix_xof, m.nb_pages,
           EXISTS (SELECT 1 FROM public.cv_achats a WHERE a.modele_id = m.id AND a.user_id = v_moi AND a.status = 'success')
      FROM public.cv_modeles m
     WHERE m.actif
     ORDER BY m.ordre, m.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.lister_modeles_cv() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_modeles_cv() TO authenticated;

-- Espaces de stockage PRIVÉS (aucun accès direct : seules les routes serveur, avec le rôle serveur, y lisent et y écrivent).
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-modeles-apercus', 'cv-modeles-apercus', FALSE) ON CONFLICT (id) DO UPDATE SET public = FALSE;
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-modeles-livres', 'cv-modeles-livres', FALSE) ON CONFLICT (id) DO UPDATE SET public = FALSE;
