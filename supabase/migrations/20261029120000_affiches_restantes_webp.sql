-- Affiches d'offres restantes : bascule vers les versions WebP (-w1280) et leurs variantes 480/960 px (31 offres).
--
-- Constat (rapport « trafic de fichiers », 29/10/2026) : 31 offres pointaient encore vers un original JPEG du bucket public « job-offers », servi en pleine
-- taille et avec un cache d'une heure (max-age=3600). Leurs versions « <nom>-w1280.webp », « -w960.webp » et « -w480.webp » (cache d'un an) sont créées À CÔTÉ des
-- originaux par scripts/convertir-affiches-restantes.mjs (liste : scripts/donnees/affiches-restantes.json). Cette migration ne fait que remplacer les adresses.
--
-- Sûreté :
--   * une offre n'est basculée QUE si les trois fichiers (-w1280, -w960, -w480) existent déjà dans le stockage : lancée avant la conversion, ou après une
--     conversion partielle, elle ne change rien pour les offres non prêtes (aucune adresse cassée, le site et l'application n'ont aucun repli sur un srcset en 404) ;
--   * chaque ligne est ciblée par l'identifiant de l'offre ; l'opération peut être rejouée sans effet ;
--   * les originaux ne sont ni modifiés ni supprimés.
-- Retour arrière : docs/rollbacks/20261029120000_affiches_restantes_webp.down.sql.
--
-- Offres concernées :
--   402cd388-5e86-4082-950b-fb5ec69f4e9e
--   ccd4d891-ab59-428f-97fa-0343cfd45808
--   258eca7f-d9e2-45b8-a015-5642354ab712
--   c2b3e26c-aa21-44a9-9bb4-9f10422d27ca
--   9d28564d-7084-4f71-8a71-f1c8a7796ff9
--   be7a52d1-e4cd-46e5-a7d4-4cce5fddd11e
--   89251ffc-bf64-4483-8d33-f8abbb54d4da
--   1d4b039f-9cde-4daa-b610-818feb5d9b5f
--   151f00f0-e6fa-4a69-bed7-abfb5749bda7
--   7d74aac2-379c-4ffd-b5cc-29ee10d4d295
--   7fe9dcca-f1b2-4fba-a9a2-c601964c676a
--   6817364d-54f1-49cb-b00d-a2427388b9f6
--   86f77a29-8d77-4253-bbb9-4012ca8732ae
--   9aedd501-2685-47a2-b136-13d3be6d5d0c
--   f7db4aaa-bafc-48d4-9dac-02d0f530c71b
--   dae5b6bb-c979-4efd-bf42-1bee4812f0da
--   2105dc5c-660a-4004-927c-3478d8c61ea1
--   38cbb212-09f2-41cd-af69-a3a26ce3eb49
--   e5a29e0f-7c54-4def-a41e-ca71ec9736d6
--   c5b173d3-189e-4db2-a042-ca91353eff4c
--   ab5c8f7e-8f6f-445f-9313-e15c200b9f43
--   3bb5cc5b-d129-4436-b265-c87344594ac0
--   d41d397d-c5b2-44f7-a8c5-76c6b984ad19
--   d21222fe-0425-430d-bf20-8c3f11ddfa47
--   a2531a58-28ca-42b7-8ecb-ec85156e1379
--   c106247f-3ae0-4c77-871e-3acaa9fad442
--   22b4ebe5-7c8d-47d2-b38f-22f29f3e582a
--   fd01a442-55bb-452c-aa00-e562a5472fdb
--   8234e290-6689-462e-986e-15c3e35b3118
--   6d69abeb-7a80-42e6-bdcd-d35f35e0469c
--   4d0a0a68-d970-40e3-8225-4fb0221fde21

WITH correspondances(offre_id, ancienne, nouvelle, objet) AS (
  VALUES
  ('402cd388-5e86-4082-950b-fb5ec69f4e9e'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/fadel_pub2_v2.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/fadel_pub2_v2-w1280.webp', 'fadel_pub2_v2'),
  ('ccd4d891-ab59-428f-97fa-0343cfd45808'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/sonagoo_pub.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/sonagoo_pub-w1280.webp', 'sonagoo_pub'),
  ('258eca7f-d9e2-45b8-a015-5642354ab712'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/fadel_pub2_v2.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/fadel_pub2_v2-w1280.webp', 'fadel_pub2_v2'),
  ('c2b3e26c-aa21-44a9-9bb4-9f10422d27ca'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1786408957659.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1786408957659-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1786408957659'),
  ('9d28564d-7084-4f71-8a71-f1c8a7796ff9'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/bceao_assistant_direction.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/bceao_assistant_direction-w1280.webp', 'bceao_assistant_direction'),
  ('be7a52d1-e4cd-46e5-a7d4-4cce5fddd11e'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787513200950.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787513200950-w1280.webp', 'admin-posters/poster-1787513200950'),
  ('89251ffc-bf64-4483-8d33-f8abbb54d4da'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787615754699.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787615754699-w1280.webp', 'admin-posters/poster-1787615754699'),
  ('1d4b039f-9cde-4daa-b610-818feb5d9b5f'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787615851667.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787615851667-w1280.webp', 'admin-posters/poster-1787615851667'),
  ('151f00f0-e6fa-4a69-bed7-abfb5749bda7'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788279962563-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788279962563-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788279962563-0'),
  ('7d74aac2-379c-4ffd-b5cc-29ee10d4d295'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788420121255-0.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788420121255-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1788420121255-0'),
  ('7fe9dcca-f1b2-4fba-a9a2-c601964c676a'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480217001-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480217001-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480217001-0'),
  ('6817364d-54f1-49cb-b00d-a2427388b9f6'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480296484-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480296484-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480296484-0'),
  ('86f77a29-8d77-4253-bbb9-4012ca8732ae'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480472100-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480472100-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480472100-0'),
  ('9aedd501-2685-47a2-b136-13d3be6d5d0c'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480660720-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480660720-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480660720-0'),
  ('f7db4aaa-bafc-48d4-9dac-02d0f530c71b'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480719438-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480719438-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789480719438-0'),
  ('dae5b6bb-c979-4efd-bf42-1bee4812f0da'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481011749-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481011749-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481011749-0'),
  ('2105dc5c-660a-4004-927c-3478d8c61ea1'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481076204-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481076204-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481076204-0'),
  ('38cbb212-09f2-41cd-af69-a3a26ce3eb49'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481148157-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481148157-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1789481148157-0'),
  ('e5a29e0f-7c54-4def-a41e-ca71ec9736d6'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249432-0.jpg|||https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249849-1.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249432-0.jpg|||https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249849-1-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249432-0.jpg|||https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294249849-1'),
  ('c5b173d3-189e-4db2-a042-ca91353eff4c'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294579256-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294579256-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294579256-0'),
  ('ab5c8f7e-8f6f-445f-9313-e15c200b9f43'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294944659-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294944659-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790294944659-0'),
  ('3bb5cc5b-d129-4436-b265-c87344594ac0'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296277510-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296277510-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296277510-0'),
  ('d41d397d-c5b2-44f7-a8c5-76c6b984ad19'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296322545-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296322545-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296322545-0'),
  ('d21222fe-0425-430d-bf20-8c3f11ddfa47'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296417110-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296417110-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296417110-0'),
  ('a2531a58-28ca-42b7-8ecb-ec85156e1379'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296738102-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296738102-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790296738102-0'),
  ('c106247f-3ae0-4c77-871e-3acaa9fad442'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790369661202-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790369661202-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790369661202-0'),
  ('22b4ebe5-7c8d-47d2-b38f-22f29f3e582a'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383369605-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383369605-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383369605-0'),
  ('fd01a442-55bb-452c-aa00-e562a5472fdb'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383561176-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383561176-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383561176-0'),
  ('8234e290-6689-462e-986e-15c3e35b3118'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383686280-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383686280-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790383686280-0'),
  ('6d69abeb-7a80-42e6-bdcd-d35f35e0469c'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790384274682-0.jpeg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790384274682-0-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/admin-offers-1790384274682-0'),
  ('4d0a0a68-d970-40e3-8225-4fb0221fde21'::uuid, 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/nvi_facility_50_agents_securite.jpg', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/eda26422-98b2-436f-b3b6-8beaaebf1188/nvi_facility_50_agents_securite-w1280.webp', 'eda26422-98b2-436f-b3b6-8beaaebf1188/nvi_facility_50_agents_securite')
)
UPDATE public.job_offers o
SET image_url = replace(o.image_url, c.ancienne, c.nouvelle)
FROM correspondances c
WHERE o.id = c.offre_id
  AND position(c.ancienne in o.image_url) > 0
  AND (
    SELECT count(*) FROM storage.objects so
    WHERE so.bucket_id = 'job-offers'
      AND so.name IN (c.objet || '-w1280.webp', c.objet || '-w960.webp', c.objet || '-w480.webp')
  ) = 3;
