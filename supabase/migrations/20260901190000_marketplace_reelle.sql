-- Marketplace : passer d'un prototype de navigateur à une vraie base.
--
-- CE QUI EXISTAIT
--
-- Aucune table. Les annonces vivaient dans localStorage
-- (`facilite_mkt_all_items_v3`), les photos en base64 dans la même clé. Trois
-- conséquences, toutes constatées dans le code livré :
--   * une annonce publiée n'était visible que par son auteur, sur son propre
--     appareil — jamais par un acheteur ;
--   * le quota localStorage (~5 Mo) était atteint en quelques photos, et
--     l'échec d'écriture était avalé par un `catch { console.error }` :
--     l'annonce disparaissait sans que personne ne soit prévenu ;
--   * rien n'était modérable, puisque rien n'atteignait le serveur.
--
-- CHOIX STRUCTURANTS
--
-- 1. Haversine, pas PostGIS. Le dépôt a déjà tranché pour le référentiel de
--    transport (migration 20260829140000) et dispose de `public.distance_km`.
--    Réutiliser la même fonction évite d'installer une extension pour un
--    besoin — trier des boutiques d'une même ville — qu'une formule sphérique
--    couvre exactement. À revoir le jour où il faudra des polygones.
--
-- 2. Les photos ne sont PAS dans la base. La colonne `photos` ne contient que
--    des chemins vers un bucket Storage. Stocker des images dans Postgres
--    reproduirait, en plus cher, le problème qu'on corrige.
--
-- 3. `statut` est une colonne générée, pas un champ saisi. Un vendeur met à
--    jour sa quantité ; « En stock » / « Épuisé » en découle. Deux champs à
--    tenir cohérents à la main finissent toujours par diverger, et c'est
--    l'acheteur qui se déplace pour rien.
--
-- 4. Une boutique porte la position, pas l'article. Un commerçant ne
--    géolocalise pas chaque produit : il enregistre son échoppe une fois, et
--    tout son stock en hérite. Cela divise aussi par cent le nombre de points
--    à comparer lors d'une recherche par proximité.

-- ---------------------------------------------------------------------------
-- Boutiques
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_stores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom                TEXT NOT NULL CHECK (btrim(nom) <> ''),
  quartier           TEXT,
  ville              TEXT,
  -- Numéro au format international, sans espaces : il alimente directement le
  -- lien wa.me côté acheteur. Un numéro local (77…) ne fonctionnerait pas.
  telephone_whatsapp TEXT CHECK (telephone_whatsapp IS NULL OR telephone_whatsapp ~ '^\+?[0-9]{8,15}$'),
  latitude           DOUBLE PRECISION CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  longitude          DOUBLE PRECISION CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
  actif              BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_stores_owner ON public.marketplace_stores(owner_id);
-- La recherche par proximité balaie les boutiques actives et géolocalisées :
-- l'index partiel évite de parcourir celles qui ne peuvent pas ressortir.
CREATE INDEX IF NOT EXISTS idx_marketplace_stores_geo
  ON public.marketplace_stores(latitude, longitude)
  WHERE actif = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  titre       TEXT NOT NULL CHECK (btrim(titre) <> ''),
  description TEXT,
  categorie   TEXT NOT NULL CHECK (categorie IN (
                'telephones', 'electronique', 'vehicules', 'mode',
                'maison', 'immobilier', 'alimentation', 'autre')),
  prix_xof    INTEGER NOT NULL CHECK (prix_xof >= 0),
  quantite    INTEGER NOT NULL DEFAULT 0 CHECK (quantite >= 0),
  -- Dérivé, jamais saisi : voir le choix 3 en tête de fichier.
  statut      TEXT GENERATED ALWAYS AS (
                CASE WHEN quantite > 0 THEN 'en_stock' ELSE 'epuise' END
              ) STORED,
  -- Chemins dans le bucket marketplace-photos, jamais de base64.
  photos      JSONB NOT NULL DEFAULT '[]'::jsonb
                CHECK (jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) <= 6),
  actif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_items_store ON public.marketplace_items(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_categorie
  ON public.marketplace_items(categorie) WHERE actif = true;
-- Recherche plein texte simple sur le titre : `unaccent` n'est pas installé,
-- et l'immense majorité des recherches portent sur un mot du titre.
CREATE INDEX IF NOT EXISTS idx_marketplace_items_titre
  ON public.marketplace_items USING gin (to_tsvector('simple', titre));

-- ---------------------------------------------------------------------------
-- Fraîcheur du stock : updated_at tenu par la base, pas par le client
-- ---------------------------------------------------------------------------
-- Un acheteur qui se déplace a besoin de savoir QUAND le stock a été confirmé.
-- Laisser le client renseigner cette date reviendrait à lui faire confiance
-- sur le seul champ qui justifie un trajet.
CREATE OR REPLACE FUNCTION public.marketplace_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_stores_updated ON public.marketplace_stores;
CREATE TRIGGER trg_marketplace_stores_updated
  BEFORE UPDATE ON public.marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_touch_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_items_updated ON public.marketplace_items;
CREATE TRIGGER trg_marketplace_items_updated
  BEFORE UPDATE ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_items  ENABLE ROW LEVEL SECURITY;

-- Lecture publique des boutiques actives : une marketplace fermée aux
-- visiteurs ne sert à rien. Les boutiques désactivées disparaissent pour tout
-- le monde sauf leur propriétaire.
DROP POLICY IF EXISTS "boutiques actives visibles de tous" ON public.marketplace_stores;
CREATE POLICY "boutiques actives visibles de tous" ON public.marketplace_stores
  FOR SELECT USING (actif = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "un vendeur cree sa boutique" ON public.marketplace_stores;
CREATE POLICY "un vendeur cree sa boutique" ON public.marketplace_stores
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "un vendeur modifie sa boutique" ON public.marketplace_stores;
CREATE POLICY "un vendeur modifie sa boutique" ON public.marketplace_stores
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "un vendeur supprime sa boutique" ON public.marketplace_stores;
CREATE POLICY "un vendeur supprime sa boutique" ON public.marketplace_stores
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Les articles suivent leur boutique. Le passage par une sous-requête est
-- volontaire : dupliquer owner_id sur l'article créerait deux sources de
-- vérité, et un transfert de boutique laisserait des articles orphelins
-- toujours modifiables par l'ancien propriétaire.
DROP POLICY IF EXISTS "articles actifs visibles de tous" ON public.marketplace_items;
CREATE POLICY "articles actifs visibles de tous" ON public.marketplace_items
  FOR SELECT USING (
    (actif = true AND EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_items.store_id AND s.actif = true))
    OR EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_items.store_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "un vendeur publie dans sa boutique" ON public.marketplace_items;
CREATE POLICY "un vendeur publie dans sa boutique" ON public.marketplace_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_stores s
            WHERE s.id = store_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "un vendeur modifie ses articles" ON public.marketplace_items;
CREATE POLICY "un vendeur modifie ses articles" ON public.marketplace_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s
            WHERE s.id = marketplace_items.store_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_stores s
            WHERE s.id = store_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "un vendeur supprime ses articles" ON public.marketplace_items;
CREATE POLICY "un vendeur supprime ses articles" ON public.marketplace_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s
            WHERE s.id = marketplace_items.store_id AND s.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Bucket des photos
-- ---------------------------------------------------------------------------
-- Public en lecture, comme job-offers : une annonce est faite pour être vue,
-- et servir chaque vignette derrière une URL signée coûterait un aller-retour
-- par image sur des connexions déjà lentes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-photos', 'marketplace-photos', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2 Mo par fichier : la compression côté client vise ~200 Ko, le plafond n'est
-- qu'un garde-fou contre un envoi non compressé. Il est appliqué par Storage
-- lui-même, donc infranchissable depuis le navigateur.

DROP POLICY IF EXISTS "photos marketplace lisibles" ON storage.objects;
CREATE POLICY "photos marketplace lisibles" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketplace-photos');

-- Chaque vendeur écrit dans un dossier à son nom : <auth.uid()>/<fichier>.
-- Sans cette contrainte de préfixe, n'importe qui pourrait écraser la photo
-- d'un concurrent.
DROP POLICY IF EXISTS "un vendeur depose ses photos" ON storage.objects;
CREATE POLICY "un vendeur depose ses photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "un vendeur remplace ses photos" ON storage.objects;
CREATE POLICY "un vendeur remplace ses photos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "un vendeur supprime ses photos" ON storage.objects;
CREATE POLICY "un vendeur supprime ses photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Recherche par proximité
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER pour pouvoir joindre boutiques et articles en une passe
-- sans dépendre de l'ordre d'évaluation des policies. La fonction ne renvoie
-- QUE des lignes actives : elle n'expose rien de plus que la lecture publique.
CREATE OR REPLACE FUNCTION public.rechercher_articles_proches(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_rayon_km  DOUBLE PRECISION DEFAULT 10,
  p_categorie TEXT DEFAULT NULL,
  p_texte     TEXT DEFAULT NULL,
  p_en_stock  BOOLEAN DEFAULT false,
  p_limite    INTEGER DEFAULT 40
)
RETURNS TABLE (
  id             UUID,
  titre          TEXT,
  description    TEXT,
  categorie      TEXT,
  prix_xof       INTEGER,
  quantite       INTEGER,
  statut         TEXT,
  photos         JSONB,
  maj_le         TIMESTAMPTZ,
  boutique_id    UUID,
  boutique_nom   TEXT,
  quartier       TEXT,
  ville          TEXT,
  whatsapp       TEXT,
  distance_km    DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.id, i.titre, i.description, i.categorie, i.prix_xof, i.quantite,
    i.statut, i.photos, i.updated_at,
    s.id, s.nom, s.quartier, s.ville, s.telephone_whatsapp,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision
  FROM public.marketplace_items i
  JOIN public.marketplace_stores s ON s.id = i.store_id
  WHERE i.actif = true
    AND s.actif = true
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
    AND (p_categorie IS NULL OR i.categorie = p_categorie)
    AND (p_en_stock = false OR i.quantite > 0)
    AND (
      p_texte IS NULL
      OR btrim(p_texte) = ''
      OR i.titre ILIKE '%' || btrim(p_texte) || '%'
      OR i.description ILIKE '%' || btrim(p_texte) || '%'
    )
  -- Le plus proche d'abord : c'est la promesse du produit. À distance égale,
  -- le stock confirmé le plus récemment passe devant.
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC,
           i.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
$$;

REVOKE ALL ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_articles_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, BOOLEAN, INTEGER) TO anon, authenticated;
