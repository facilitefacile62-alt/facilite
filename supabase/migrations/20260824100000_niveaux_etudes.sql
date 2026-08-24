-- Point 2a (2026-08-24) : référentiel unique des niveaux d'études du
-- système éducatif sénégalais.
--
-- Motivation (mesures brutes du 2026-08-24, point 1) : le niveau d'études
-- n'était jamais un signal fiable. `job_offers.min_education_level` est du
-- TEXTE LIBRE — 32 valeurs distinctes sur 60 offres actives, dont "Permis
-- de conduire valide", "Non renseigné", "Tous niveaux (Ouvriers qualifiés,
-- Techniciens, Ingénieurs)". Et DEUX implémentations incompatibles le
-- lisaient :
--   * getEducationRank() (src/lib/eligibility.js) — recherche de
--     sous-chaîne sur 7 entrées, dans l'ordre d'insertion : "Bac+5
--     (Ingénieur / Master...)" tombait au rang BAC parce que « bac »
--     l'emportait sur « master » ; 7 formulations réelles sur 32 tombaient
--     au rang 0, où tout le monde est éligible (y compris un CM2 sur un
--     poste d'infirmier).
--   * levelRank() (OffreApplySection.jsx, OffresClient.jsx,
--     RecruiterShowcaseClient.jsx) — indexOf() EXACT sur le même tableau de
--     7 entrées : "Bac+3" → -1 → rang 0 → aucune restriction.
--
-- Cette table remplace les deux échelles improvisées par un référentiel
-- unique, ordonné, et surtout COMPLET — l'échelle précédente comptait 7
-- entrées (Aucun, CM2, Brevet, BAC, Licence, Master, Doctorat) pour un
-- système éducatif qui en compte une trentaine.
--
-- `rang` est l'échelle de comparaison unique. Deux entrées peuvent
-- partager un rang quand elles sont réellement équivalentes (BTS = DUT =
-- L2 = Bac+2 ; BT = BAC). `bac_plus` n'est renseigné qu'à partir du
-- niveau BAC et sert uniquement à l'affichage.
--
-- `comparable = false` marque les formations qui NE DOIVENT PAS être
-- placées sur l'échelle académique formelle : le Daara (formation
-- religieuse/traditionnelle) a `rang IS NULL` et n'est jamais comparé à
-- une exigence de diplôme. Ne pas confondre avec MAITRISE, qui est bien le
-- diplôme universitaire Bac+4 de l'ancien système.

CREATE TABLE IF NOT EXISTS public.niveaux_etudes (
  code TEXT PRIMARY KEY,
  libelle TEXT NOT NULL,
  -- Position sur l'échelle académique. NULL <=> hors échelle (comparable = false).
  rang INTEGER,
  categorie TEXT NOT NULL,
  -- Nombre d'années après le BAC, uniquement à partir du BAC (BAC = 0).
  bac_plus INTEGER,
  ordre_affichage INTEGER NOT NULL,
  -- false : ne participe jamais à une comparaison d'éligibilité.
  comparable BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.niveaux_etudes
  DROP CONSTRAINT IF EXISTS niveaux_etudes_categorie_check;
ALTER TABLE public.niveaux_etudes
  ADD CONSTRAINT niveaux_etudes_categorie_check
  CHECK (categorie IN (
    'aucun',
    'elementaire',
    'moyen',
    'secondaire',
    'superieur',
    'professionnel',
    'certificat_pedagogique',
    'religieux_traditionnel'
  ));

-- Un niveau comparable a forcément un rang, un niveau hors échelle n'en a
-- jamais : impossible de créer une entrée à moitié comparable.
ALTER TABLE public.niveaux_etudes
  DROP CONSTRAINT IF EXISTS niveaux_etudes_rang_comparable_check;
ALTER TABLE public.niveaux_etudes
  ADD CONSTRAINT niveaux_etudes_rang_comparable_check
  CHECK ((comparable AND rang IS NOT NULL) OR (NOT comparable AND rang IS NULL));

CREATE INDEX IF NOT EXISTS idx_niveaux_etudes_rang ON public.niveaux_etudes (rang);
CREATE INDEX IF NOT EXISTS idx_niveaux_etudes_ordre ON public.niveaux_etudes (ordre_affichage);

-- Référentiel public en LECTURE SEULE : n'importe quel visiteur doit
-- pouvoir peupler le menu déroulant "Niveau" sans être connecté (la page
-- /offres et la fiche d'offre sont accessibles hors session). Aucune
-- écriture accordée à anon/authenticated — le contenu de cette table ne
-- change que par migration.
ALTER TABLE public.niveaux_etudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Référentiel des niveaux lisible par tous" ON public.niveaux_etudes;
CREATE POLICY "Référentiel des niveaux lisible par tous"
  ON public.niveaux_etudes FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.niveaux_etudes TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.niveaux_etudes FROM anon, authenticated;

-- Contenu du référentiel. ON CONFLICT DO UPDATE : rejouer la migration
-- corrige les libellés/rangs sans jamais dupliquer ni perdre les
-- références posées par job_offers/profiles.
INSERT INTO public.niveaux_etudes (code, libelle, rang, categorie, bac_plus, ordre_affichage, comparable) VALUES
  -- Aucune scolarité — rang le plus bas de l'échelle.
  ('AUCUN',            'Pas d''étude',                                        0,  'aucun',                  NULL,  10, true),

  -- Cycle élémentaire (→ CFEE)
  ('CI',               'CI (Cours d''Initiation)',                            1,  'elementaire',            NULL,  20, true),
  ('CP',               'CP (Cours Préparatoire)',                             2,  'elementaire',            NULL,  30, true),
  ('CE1',              'CE1 (Cours Élémentaire 1)',                           3,  'elementaire',            NULL,  40, true),
  ('CE2',              'CE2 (Cours Élémentaire 2)',                           4,  'elementaire',            NULL,  50, true),
  ('CM1',              'CM1 (Cours Moyen 1)',                                 5,  'elementaire',            NULL,  60, true),
  ('CM2',              'CM2 (Cours Moyen 2)',                                 6,  'elementaire',            NULL,  70, true),
  ('CFEE',             'CFEE (Certificat de Fin d''Études Élémentaires)',     7,  'elementaire',            NULL,  80, true),

  -- Cycle moyen (→ BFEM)
  ('SIXIEME',          '6ème',                                                8,  'moyen',                  NULL,  90, true),
  ('CINQUIEME',        '5ème',                                                9,  'moyen',                  NULL, 100, true),
  ('QUATRIEME',        '4ème',                                               10,  'moyen',                  NULL, 110, true),
  ('TROISIEME',        '3ème',                                               11,  'moyen',                  NULL, 120, true),
  ('BFEM',             'BFEM (Brevet de Fin d''Études Moyennes)',            12,  'moyen',                  NULL, 130, true),

  -- Filière professionnelle : CAP après l'élémentaire/la 4ème, BEP après la 3ème.
  ('CAP',              'CAP (Certificat d''Aptitude Professionnelle)',       10,  'professionnel',          NULL, 140, true),
  ('BEP',              'BEP (Brevet d''Études Professionnelles)',            13,  'professionnel',          NULL, 150, true),

  -- Cycle secondaire (→ BAC)
  ('SECONDE',          'Seconde',                                            14,  'secondaire',             NULL, 160, true),
  ('PREMIERE',         'Première',                                           15,  'secondaire',             NULL, 170, true),
  ('TERMINALE',        'Terminale',                                          16,  'secondaire',             NULL, 180, true),
  ('BAC',              'BAC (Baccalauréat général ou technique)',            17,  'secondaire',                0, 190, true),
  -- BT : équivalent technique direct du BAC (même rang, catégorie distincte).
  ('BT',               'BT (Brevet de Technicien) — équivalent BAC',         17,  'professionnel',             0, 200, true),

  -- Supérieur (LMD)
  ('L1',               'L1 (Bac+1)',                                         18,  'superieur',                 1, 210, true),
  ('L2',               'L2 (Bac+2)',                                         19,  'superieur',                 2, 220, true),
  -- BTS ≈ DUT ≈ L2 (Bac+2) : même rang que L2, catégorie professionnelle.
  ('BTS',              'BTS (Brevet de Technicien Supérieur, Bac+2)',        19,  'professionnel',             2, 230, true),
  ('DUT',              'DUT (Diplôme Universitaire de Technologie, Bac+2)',  19,  'professionnel',             2, 240, true),
  ('LICENCE',          'Licence / L3 (Bac+3)',                               20,  'superieur',                 3, 250, true),
  ('M1',               'M1 (Bac+4)',                                         21,  'superieur',                 4, 260, true),
  -- MAITRISE ≈ M1 (Bac+4, ancien système). Diplôme UNIVERSITAIRE — aucun
  -- rapport avec la maîtrise coranique d'un Daara (entrée DAARA ci-dessous).
  ('MAITRISE',         'Maîtrise (Bac+4, ancien système)',                   21,  'superieur',                 4, 270, true),
  ('MASTER',           'Master / M2 (Bac+5)',                                22,  'superieur',                 5, 280, true),
  ('DOCTORAT',         'Doctorat (Bac+8)',                                   23,  'superieur',                 8, 290, true),

  -- Certificats pédagogiques (enseignement). Le rang retenu est celui du
  -- PRÉREQUIS ACADÉMIQUE reconnu du certificat, pas une équivalence de
  -- diplôme : CEAP se prépare après le BFEM, le CAP d'enseignement fait
  -- l'instituteur titulaire, CAEM/CAECEM ouvre le collège (niveau Licence)
  -- et CAES le lycée (niveau Master). La catégorie dédiée permet à l'IHM de
  -- les présenter comme des certificats, jamais comme des diplômes
  -- généraux.
  ('CEAP',             'CEAP (instituteur adjoint)',                         12,  'certificat_pedagogique', NULL, 300, true),
  ('CAP_ENSEIGNEMENT', 'CAP enseignement (instituteur titulaire)',           17,  'certificat_pedagogique', NULL, 310, true),
  ('CAMEPS',           'CAMEPS (EPS, collège)',                              19,  'certificat_pedagogique',    2, 320, true),
  ('CAEM',             'CAEM / CAECEM (professeur de collège)',              20,  'certificat_pedagogique',    3, 330, true),
  ('CAPEPS',           'CAPEPS (EPS, lycée)',                                22,  'certificat_pedagogique',    5, 340, true),
  ('CAES',             'CAES (professeur de lycée)',                         22,  'certificat_pedagogique',    5, 350, true),

  -- Formation religieuse / traditionnelle : catégorie séparée, HORS
  -- échelle académique (rang NULL, comparable = false). Ne sera jamais
  -- comparée à une exigence de diplôme, ni dans un sens ni dans l'autre.
  ('DAARA',            'Daara (formation religieuse ou traditionnelle)',   NULL,  'religieux_traditionnel', NULL, 360, false)
ON CONFLICT (code) DO UPDATE SET
  libelle         = EXCLUDED.libelle,
  rang            = EXCLUDED.rang,
  categorie       = EXCLUDED.categorie,
  bac_plus        = EXCLUDED.bac_plus,
  ordre_affichage = EXCLUDED.ordre_affichage,
  comparable      = EXCLUDED.comparable;
