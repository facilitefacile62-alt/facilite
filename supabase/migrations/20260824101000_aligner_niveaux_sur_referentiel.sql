-- Point 2b (2026-08-24) : aligner job_offers.min_education_level et
-- profiles.education_level sur le référentiel niveaux_etudes
-- (20260824100000_niveaux_etudes.sql).
--
-- Choix d'une colonne ADDITIONNELLE plutôt que d'une réécriture de la
-- colonne texte : `min_education_level` est saisie librement par les
-- recruteurs et porte souvent une information utile qui n'est PAS un
-- niveau ("Bac+3 en Comptabilité / Finance ou BTS/DUT + 3 ans
-- d'expérience"). L'écraser ferait perdre cette précision à l'affichage.
-- La colonne `_code` porte le niveau structuré et comparable, la colonne
-- texte reste ce que le recruteur a écrit.
--
-- `_code` NULL a un sens précis et distinct de 'AUCUN' :
--   * 'AUCUN'  = le recruteur déclare explicitement n'exiger aucun diplôme
--                ("Aucun", "Non renseigné", "Tous niveaux").
--   * NULL     = la saisie ne contient aucun niveau interprétable
--                ("Permis de conduire valide", "Diplôme d'infirmier(ère) +
--                Certification PCI"). Ne doit JAMAIS bloquer une
--                candidature — il n'y a pas d'exigence à vérifier.

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS min_education_level_code TEXT REFERENCES public.niveaux_etudes(code);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education_level_code TEXT REFERENCES public.niveaux_etudes(code);

CREATE INDEX IF NOT EXISTS idx_job_offers_min_education_code ON public.job_offers (min_education_level_code);

-- Les droits de ces deux tables sont accordés COLONNE PAR COLONNE (voir
-- information_schema.role_column_grants) : sans ces GRANT explicites, la
-- nouvelle colonne serait invisible en écriture pour le candidat et pour
-- le recruteur, alors que la colonne texte voisine, elle, est bien
-- accordée. Strictement le même périmètre que min_education_level /
-- education_level, pas un droit de plus.
GRANT INSERT (education_level_code) ON public.profiles TO anon, authenticated;
GRANT UPDATE (education_level_code) ON public.profiles TO authenticated;
GRANT INSERT (min_education_level_code) ON public.job_offers TO anon, authenticated;
GRANT UPDATE (min_education_level_code) ON public.job_offers TO authenticated;

-- Normalisation d'une saisie libre vers un code du référentiel.
--
-- Règle centrale : quand plusieurs niveaux sont détectés dans la même
-- chaîne, on retient LE PLUS BAS. `min_education_level` est un PLANCHER —
-- "Bac / Bac+2 / Licence / Master" veut dire « à partir du BAC », et
-- "Bac+3 ... ou BTS/DUT + 3 ans d'expérience" veut dire « à partir de
-- Bac+2 ». Prendre le maximum exclurait des candidats que le recruteur
-- accepte explicitement.
--
-- IMMUTABLE : dépend uniquement de son argument et du contenu figé de
-- niveaux_etudes (modifié par migration uniquement), ce qui permet de
-- l'utiliser dans un index si besoin plus tard.
CREATE OR REPLACE FUNCTION public.normaliser_niveau_etudes(p_texte TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t TEXT;
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_regex TEXT;
  v_code TEXT;
  v_n INTEGER;
  v_resultat TEXT;
  -- (motif, code) — motifs appliqués sur le texte minuscule sans accents.
  v_motifs TEXT[][] := ARRAY[
    ARRAY['\mdoctorat\M|\mphd\M',                    'DOCTORAT'],
    ARRAY['\mmaster\M|\mm2\M',                       'MASTER'],
    ARRAY['\mmaitrise\M|\mm1\M',                     'M1'],
    ARRAY['\mlicence\M|\ml3\M|\mbachelor\M',         'LICENCE'],
    ARRAY['\mbts\M',                                 'BTS'],
    ARRAY['\mdut\M',                                 'DUT'],
    ARRAY['\ml2\M',                                  'L2'],
    ARRAY['\ml1\M',                                  'L1'],
    ARRAY['brevet de technicien|\mbt\M',             'BT'],
    ARRAY['\mbep\M',                                 'BEP'],
    ARRAY['\mbfem\M|\mbepc\M|\mbrevet\M',            'BFEM'],
    ARRAY['\mceap\M',                                'CEAP'],
    ARRAY['cap d''enseignement|cap enseignement',    'CAP_ENSEIGNEMENT'],
    ARRAY['\mcaes\M',                                'CAES'],
    ARRAY['\mcapeps\M',                              'CAPEPS'],
    ARRAY['\mcameps\M',                              'CAMEPS'],
    ARRAY['\mcaem\M|\mcaecem\M',                     'CAEM'],
    ARRAY['\mcap\M',                                 'CAP'],
    ARRAY['\mterminale\M',                           'TERMINALE'],
    ARRAY['\mpremiere\M',                            'PREMIERE'],
    ARRAY['\mseconde\M',                             'SECONDE'],
    ARRAY['\mtroisieme\M|\m3eme\M',                  'TROISIEME'],
    ARRAY['\mquatrieme\M|\m4eme\M',                  'QUATRIEME'],
    ARRAY['\mcinquieme\M|\m5eme\M',                  'CINQUIEME'],
    ARRAY['\msixieme\M|\m6eme\M',                    'SIXIEME'],
    ARRAY['\mcfee\M',                                'CFEE'],
    ARRAY['\mcm2\M',                                 'CM2'],
    ARRAY['\mcm1\M',                                 'CM1'],
    ARRAY['\mce2\M',                                 'CE2'],
    ARRAY['\mce1\M',                                 'CE1'],
    ARRAY['\mprimaire\M|\melementaire\M',            'CFEE'],
    ARRAY['\mdaara\M|coranique',                     'DAARA']
  ];
BEGIN
  IF p_texte IS NULL OR btrim(p_texte) = '' THEN
    RETURN NULL;
  END IF;

  -- Minuscules + suppression des accents (extension unaccent non requise :
  -- le jeu de caractères réellement rencontré ici est celui du français).
  t := lower(translate(p_texte, 'àâäáãçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
                                'aaaaaceeeeiiiinooooouuuuyyaaaaaceeeeiiiinooooouuuuy'));

  -- Absence explicite d'exigence — distinct d'une saisie inexploitable.
  IF t ~ '\maucun\M|non renseigne|tous niveaux|sans diplome|pas d''etude|pas d etude' THEN
    RETURN 'AUCUN';
  END IF;

  -- Diplômes nommés.
  FOR i IN 1 .. array_length(v_motifs, 1) LOOP
    v_regex := v_motifs[i][1];
    v_code  := v_motifs[i][2];
    IF t ~ v_regex THEN
      v_codes := array_append(v_codes, v_code);
    END IF;
  END LOOP;

  -- Toutes les formes « bac+N » présentes dans la chaîne (une plage
  -- "Bac+2 à Bac+5" en produit deux, on gardera la plus basse).
  FOR v_n IN
    SELECT DISTINCT (regexp_matches(t, 'bac\s*\+\s*([0-9])', 'g'))[1]::INTEGER
  LOOP
    v_codes := array_append(v_codes, CASE
      WHEN v_n <= 0 THEN 'BAC'
      WHEN v_n = 1 THEN 'L1'
      WHEN v_n = 2 THEN 'L2'
      WHEN v_n = 3 THEN 'LICENCE'
      WHEN v_n = 4 THEN 'M1'
      WHEN v_n = 5 THEN 'MASTER'
      ELSE 'DOCTORAT'
    END);
  END LOOP;

  -- « bac » seul : compté uniquement pour une occurrence qui n'est PAS
  -- suivie de « +N » (lookahead négatif). Sans cette précaution "Bac+5"
  -- serait ramené au rang BAC — exactement le bug de getEducationRank()
  -- que cette migration corrige. Mais tester simplement « aucun bac+N dans
  -- la chaîne » serait faux dans l'autre sens : "Bac / Bac+2 / Licence /
  -- Master" énumère des alternatives dont le PLANCHER est bien le BAC seul.
  IF t ~ '\mbac\M(?!\s*\+)' OR t ~ '\mbaccalaureat\M' THEN
    v_codes := array_append(v_codes, 'BAC');
  END IF;

  IF array_length(v_codes, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  -- Le plus bas de l'échelle parmi les niveaux détectés.
  SELECT n.code INTO v_resultat
  FROM public.niveaux_etudes n
  WHERE n.code = ANY(v_codes) AND n.rang IS NOT NULL
  ORDER BY n.rang, n.ordre_affichage
  LIMIT 1;

  -- Uniquement une formation hors échelle (Daara) : renvoyée telle quelle.
  IF v_resultat IS NULL THEN
    SELECT n.code INTO v_resultat
    FROM public.niveaux_etudes n
    WHERE n.code = ANY(v_codes)
    ORDER BY n.ordre_affichage
    LIMIT 1;
  END IF;

  RETURN v_resultat;
END;
$$;

-- Reprise de l'existant. WHERE ... IS NULL : une valeur déjà structurée
-- (saisie via le futur menu déroulant) n'est jamais écrasée par une
-- déduction faite sur le texte libre.
UPDATE public.job_offers
SET min_education_level_code = public.normaliser_niveau_etudes(min_education_level)
WHERE min_education_level_code IS NULL;

UPDATE public.profiles
SET education_level_code = public.normaliser_niveau_etudes(education_level)
WHERE education_level_code IS NULL;
