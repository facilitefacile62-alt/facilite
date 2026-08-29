-- Données initiales du référentiel transport : les deux lignes structurantes
-- de l'agglomération dakaroise.
--
-- Contenu éditorial passé par migration, contrairement à l'usage habituel où
-- le contenu se saisit depuis l'interface. Raison : ces deux lignes sont le
-- socle du référentiel — sans elles, chercher_itineraire ne répond jamais
-- rien, et l'assistant serait tenté de combler ce vide. Les faire vivre dans
-- une migration commitée les rend reproductibles sur un environnement neuf
-- et traçables, au même titre que le référentiel niveaux_etudes.
--
-- ON CONFLICT n'est pas utilisable : la table n'a pas de contrainte d'unicité
-- métier — deux lignes peuvent légitimement partager mode, origine et
-- destination. Le garde-fou est donc un NOT EXISTS sur le couple
-- (mode, ligne), qui rend la migration rejouable sans créer de doublon.
--
-- « Gueule Tapée » est saisi sans coordonnées, comme dans la source. L'arrêt
-- reste affiché dans le détail de la ligne mais sera ignoré par la recherche
-- de proximité (rechercher_itineraires écarte les arrêts sans lat/lng plutôt
-- que de laisser le cast échouer). 22 des 23 arrêts du BRT sont donc
-- géolocalisés : à compléter depuis l'onglet Transport quand la coordonnée
-- sera connue.

INSERT INTO public.transport_routes (mode, ligne, operateur, origine, destination, arrets, zones, description, actif)
SELECT
  'brt', 'BRT Dakar', 'Dakar Mobilité', 'Terminus Guédiawaye', 'Petersen',
  '[
    {"nom":"Préfecture de Guédiawaye","lat":14.772173,"lng":-17.387237,"ordre":1},
    {"nom":"Gueule Tapée","lat":null,"lng":null,"ordre":2},
    {"nom":"Golf Nord","lat":14.776194,"lng":-17.398720,"ordre":3},
    {"nom":"Fith Mith","lat":14.775214,"lng":-17.406203,"ordre":4},
    {"nom":"Hôpital Dalal Jamm","lat":14.773142,"lng":-17.408318,"ordre":5},
    {"nom":"Golf Sud","lat":14.767013,"lng":-17.414135,"ordre":6},
    {"nom":"Ndingala","lat":14.764358,"lng":-17.420376,"ordre":7},
    {"nom":"Parcelles Assainies","lat":14.761942,"lng":-17.425442,"ordre":8},
    {"nom":"Croisement 22","lat":14.753660,"lng":-17.433606,"ordre":9},
    {"nom":"Police des Parcelles","lat":14.750845,"lng":-17.439383,"ordre":10},
    {"nom":"Grand Médine","lat":14.748235,"lng":-17.444262,"ordre":11},
    {"nom":"Cardinal Hyacinthe Thiandoum","lat":14.741288,"lng":-17.451429,"ordre":12},
    {"nom":"Scat Urbam","lat":14.736952,"lng":-17.455169,"ordre":13},
    {"nom":"Khar Yalla","lat":14.735072,"lng":-17.455922,"ordre":14},
    {"nom":"Liberté 6","lat":14.726544,"lng":-17.458891,"ordre":15},
    {"nom":"Liberté 5","lat":14.720742,"lng":-17.464252,"ordre":16},
    {"nom":"Sacré-Cœur","lat":14.716720,"lng":-17.466517,"ordre":17},
    {"nom":"Liberté 1","lat":14.709103,"lng":-17.461571,"ordre":18},
    {"nom":"Grand Dakar","lat":14.704438,"lng":-17.457451,"ordre":19},
    {"nom":"Dial Diop","lat":14.699639,"lng":-17.453589,"ordre":20},
    {"nom":"Place de la Nation","lat":14.696435,"lng":-17.450745,"ordre":21},
    {"nom":"Grande Mosquée","lat":14.682479,"lng":-17.444222,"ordre":22},
    {"nom":"Papa Gueye Fall (Petersen)","lat":14.675923,"lng":-17.441161,"ordre":23}
  ]'::jsonb,
  ARRAY['Guédiawaye','Grand Médine','Petersen'],
  'Ligne principale du Bus Rapid Transit de Dakar, reliant Guédiawaye à Petersen sur voie dédiée.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.transport_routes WHERE mode = 'brt' AND ligne = 'BRT Dakar'
);

INSERT INTO public.transport_routes (mode, ligne, operateur, origine, destination, arrets, zones, description, actif)
SELECT
  'ter', 'TER Dakar-Diamniadio', 'SETER', 'Dakar', 'Diamniadio',
  '[
    {"nom":"Dakar","lat":14.675626,"lng":-17.433282,"ordre":1},
    {"nom":"Colobane","lat":14.700237,"lng":-17.441665,"ordre":2},
    {"nom":"Hann","lat":14.721402,"lng":-17.431825,"ordre":3},
    {"nom":"Dalifort","lat":14.734011,"lng":-17.419621,"ordre":4},
    {"nom":"Baux Maraîchers","lat":14.740054,"lng":-17.401975,"ordre":5},
    {"nom":"Pikine","lat":14.749876,"lng":-17.391773,"ordre":6},
    {"nom":"Thiaroye","lat":14.759105,"lng":-17.379705,"ordre":7},
    {"nom":"Yeumbeul","lat":14.764984,"lng":-17.355877,"ordre":8},
    {"nom":"Keur Mbaye Fall","lat":14.744123,"lng":-17.313926,"ordre":9},
    {"nom":"PNR","lat":14.722602,"lng":-17.282644,"ordre":10},
    {"nom":"Rufisque","lat":14.715681,"lng":-17.270389,"ordre":11},
    {"nom":"Bargny","lat":14.697608,"lng":-17.229625,"ordre":12},
    {"nom":"Diamniadio","lat":14.716938,"lng":-17.198844,"ordre":13}
  ]'::jsonb,
  ARRAY['Zone 1','Zone 2','Zone 3'],
  'Train Express Régional reliant Dakar à Diamniadio, 13 gares, exploité par la SETER.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.transport_routes WHERE mode = 'ter' AND ligne = 'TER Dakar-Diamniadio'
);

-- Contrôle immédiat : le nombre d'arrêts doit correspondre à la source. Une
-- erreur de copie sur un tableau de 23 objets passerait autrement inaperçue
-- jusqu'au jour où quelqu'un cherche un itinéraire depuis l'arrêt manquant.
DO $$
DECLARE
  n_brt INT;
  n_ter INT;
BEGIN
  SELECT jsonb_array_length(arrets) INTO n_brt
  FROM public.transport_routes WHERE mode = 'brt' AND ligne = 'BRT Dakar';

  SELECT jsonb_array_length(arrets) INTO n_ter
  FROM public.transport_routes WHERE mode = 'ter' AND ligne = 'TER Dakar-Diamniadio';

  IF n_brt IS DISTINCT FROM 23 THEN
    RAISE EXCEPTION 'BRT : % arrêts enregistrés, 23 attendus.', coalesce(n_brt::text, 'ligne absente');
  END IF;
  IF n_ter IS DISTINCT FROM 13 THEN
    RAISE EXCEPTION 'TER : % arrêts enregistrés, 13 attendus.', coalesce(n_ter::text, 'ligne absente');
  END IF;
END $$;
