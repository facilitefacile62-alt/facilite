-- Banque de CV — recherche du candidat idéal parmi des CV importés par un
-- administrateur, distincts des comptes inscrits sur la plateforme.
--
-- CE QUE C'EST, ET CE QUE CE N'EST PAS
--
-- La banque d'information existante (onglet « Candidats » de
-- /admin/banque-donnees) montre les comptes réellement inscrits — table
-- profiles. Ici, c'est autre chose : un admin importe des CV et lettres de
-- motivation obtenus par d'autres canaux (recommandation, salon de l'emploi,
-- CVthèque externe...), pour constituer un vivier propre à Facilité, sans
-- lien avec un compte auth.users candidat.
--
-- C'est pourquoi le régime de protection est différent de tout ce qui touche
-- aux candidats inscrits : pas de consentement candidat à faire respecter
-- puisqu'il n'y a pas de compte candidat. En contrepartie, l'accès est
-- verrouillé beaucoup plus fort — RLS activée, ZÉRO policy, ZÉRO grant à
-- anon/authenticated. Même doctrine que assistant_ai_config /
-- assistant_faq : lecture ET écriture exclusivement via des routes API
-- admin utilisant getSupabaseAdmin() (service_role), jamais un accès direct
-- depuis le navigateur. Un CV contient des données personnelles réelles
-- (nom, coordonnées, parcours) : la protection est celle d'un dossier RH
-- papier, pas celle d'un profil public.
--
-- POURQUOI UNE RECHERCHE VECTORIELLE, PAS UNE RECHERCHE TEXTE
--
-- Le site a déjà ce pipeline pour les candidats inscrits : job_offers et
-- resumes portent chacun une colonne `embedding vector(768)`, alimentée par
-- la fonction Edge gemini-orchestrator (action "embed"), et interrogée via
-- match_job_offers / match_resumes. On reproduit exactement le même schéma
-- pour rester cohérent avec l'infrastructure existante plutôt que d'inventer
-- une seconde façon de faire.

-- pgvector est déjà activé (vérifié : extension 'vector' 0.8.2, utilisée par
-- job_offers.embedding et resumes.embedding) — pas de CREATE EXTENSION ici,
-- il existerait déjà et une nouvelle tentative échouerait selon les droits.

CREATE TABLE IF NOT EXISTS public.banque_cv (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  nom_complet        TEXT,
  -- Secteur d'activité. Enum fermée plutôt que texte libre : c'est la
  -- demande explicite (« bien ranger dans les catégories ») — un texte libre
  -- laissé au modèle dérive en quelques dizaines de CV (« Informatique »,
  -- « IT », « Informatique & Numérique »... trois libellés pour un seul
  -- secteur, invisibles les uns des autres à la recherche).
  categorie          TEXT CHECK (categorie IN (
                        'informatique_numerique', 'comptabilite_finance', 'commerce_vente',
                        'marketing_communication', 'rh_administration', 'btp_ingenierie',
                        'sante', 'education_formation', 'logistique_transport', 'juridique',
                        'hotellerie_restauration', 'agriculture_environnement',
                        'artisanat_metiers_manuels', 'autre'
                      )),
  -- Référentiel déjà utilisé par profiles.education_level_code : c'est ce
  -- qui permet au classement de s'appuyer sur un niveau comparable
  -- (niveaux_etudes.rang), pas sur un libellé inventé par le modèle à chaque
  -- import.
  niveau_etude_code  TEXT REFERENCES public.niveaux_etudes(code),
  annees_experience  INTEGER CHECK (annees_experience IS NULL OR (annees_experience BETWEEN 0 AND 60)),
  competences        TEXT[] NOT NULL DEFAULT '{}',
  -- Synthèse rédigée par le modèle à partir du texte réel du CV — c'est elle
  -- qui porte la preuve demandée (« prouvé par son expérience professionnelle
  -- et parcours d'étude ») : jamais une déduction du seul intitulé de poste.
  resume_profil      TEXT,
  points_forts       TEXT[] NOT NULL DEFAULT '{}',
  -- Texte brut extrait du CV (extractTextFromFile), tronqué à 12000
  -- caractères : sert de base à l'embedding et à un réexamen manuel si la
  -- catégorisation automatique semble fausse. Un CV dépasse rarement 4 pages,
  -- 12000 caractères en couvrent la quasi-totalité.
  texte_extrait      TEXT,
  embedding          extensions.vector(768),

  fichier_cv         TEXT NOT NULL,
  fichier_lettre     TEXT,

  -- L'analyse IA peut échouer (clé absente, quota, réponse invalide) sans
  -- que l'import lui-même échoue : le fichier reste consultable, l'admin
  -- peut relancer l'analyse plutôt que de tout réimporter.
  statut             TEXT NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'analyse', 'erreur')),
  erreur_analyse     TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banque_cv_categorie ON public.banque_cv (categorie);
CREATE INDEX IF NOT EXISTS idx_banque_cv_statut ON public.banque_cv (statut, created_at DESC);
-- HNSW, comme resumes_embedding_idx / job_offers_embedding_idx (voir
-- 20260730100000_ai_infrastructure.sql) : même famille d'index dans tout le
-- projet, pas de phase d'entraînement contrairement à IVFFlat, et un
-- meilleur rappel à faible volume — la banque démarre à zéro ligne.
CREATE INDEX IF NOT EXISTS idx_banque_cv_embedding ON public.banque_cv
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.touch_banque_cv()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_banque_cv_touch ON public.banque_cv;
CREATE TRIGGER trg_banque_cv_touch
  BEFORE UPDATE ON public.banque_cv
  FOR EACH ROW EXECUTE FUNCTION public.touch_banque_cv();

ALTER TABLE public.banque_cv ENABLE ROW LEVEL SECURITY;
-- Aucune policy, aucun GRANT à authenticated/anon — service_role
-- uniquement, via les routes /api/admin/banque-cv/*. Voir la doctrine en
-- tête de fichier.

-- ---------------------------------------------------------------------------
-- Recherche par proximité sémantique
-- ---------------------------------------------------------------------------
-- Miroir exact de match_resumes / match_job_offers, sans SECURITY DEFINER :
-- contrairement à ces deux-là, aucun appelant authenticated ne doit jamais
-- l'atteindre — seul service_role l'appelle, qui contourne déjà la RLS par
-- nature. SECURITY DEFINER servirait ici à élever un privilège que personne
-- d'autre que service_role ne doit avoir.
CREATE OR REPLACE FUNCTION public.match_banque_cv(
  query_embedding extensions.vector,
  match_threshold  DOUBLE PRECISION,
  match_count      INTEGER,
  filtre_categorie TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  nom_complet TEXT,
  similarity  DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = 'public', 'extensions', 'pg_temp'
AS $$
  SELECT
    banque_cv.id,
    banque_cv.nom_complet,
    1 - (banque_cv.embedding <=> query_embedding) AS similarity
  FROM public.banque_cv
  WHERE banque_cv.embedding IS NOT NULL
    AND banque_cv.statut = 'analyse'
    AND (filtre_categorie IS NULL OR banque_cv.categorie = filtre_categorie)
    AND 1 - (banque_cv.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_banque_cv(extensions.vector, DOUBLE PRECISION, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_banque_cv(extensions.vector, DOUBLE PRECISION, INTEGER, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Bucket des fichiers (CV + lettres de motivation)
-- ---------------------------------------------------------------------------
-- Privé, à la différence de marketplace-photos/job-offers : ce ne sont pas
-- des visuels faits pour être vus, ce sont des documents personnels. Seul
-- service_role y accède (Storage suit les mêmes règles RLS que les tables) —
-- aucune policy storage.objects n'est créée pour ce bucket, volontairement :
-- l'absence de policy sur un bucket PRIVÉ signifie « personne d'autre que
-- service_role », exactement l'effet recherché.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banque-cv', 'banque-cv', false, 10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp'];
