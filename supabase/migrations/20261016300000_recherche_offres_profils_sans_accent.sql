-- Recherche des offres d'emploi et des profils insensible aux accents (suite de 20261016280000).
--
-- Constat (audit des barres de recherche, 16/10/2026) : « ingenieur », « thies » ou « aissatou »
-- ne trouvaient pas « Ingénieur », « Thiès » ou « Aïssatou » dans la barre d'en-tête ni sur la
-- page de recherche. Même correction que pour le Marketplace : des colonnes calculées par la base,
-- comparées à ce que l'utilisateur tape une fois les accents retirés des deux côtés.

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS recherche_norm TEXT
  GENERATED ALWAYS AS (
    public.sans_accent(coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(location, '') || ' ' || coalesce(description, ''))
  ) STORED;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nom_norm TEXT
  GENERATED ALWAYS AS (public.sans_accent(full_name)) STORED;
