-- Retour arrière de 20261031_offres_affiches_et_3_nouvelles.up.sql : remet les cartes générées pour les 7 offres et MASQUE (is_active = false) les 3 nouvelles offres ; ne supprime rien.
-- Gardes : 7 mises à jour puis 3 masquages.
BEGIN;

DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.job_offers o
     SET image_url = v.image_url
    FROM (VALUES
      ('c7c8d329-1804-4956-a84d-ce5acd99b2d3'::uuid, '/carte-offre-onpec-assistant-administratif.webp'),
      ('b994aa8d-fe88-46df-8c46-cae606354d97'::uuid, '/carte-offre-khelcom-magasiniers.webp'),
      ('d0568439-14da-4950-b460-67bf9f3ddea1'::uuid, '/carte-offre-khelcom-comptable.webp'),
      ('b11d6e36-0816-4428-840c-9a744d93df43'::uuid, '/carte-offre-talent-flow-metallurgistes.webp'),
      ('3ebfd875-1baa-474f-a88b-f42a7ae215f5'::uuid, '/carte-offre-ambassade-suede-assistant.webp'),
      ('63de30e0-943c-4d06-b97e-22496c22611d'::uuid, '/carte-offre-gindi-ingenieur-agroalimentaire.webp'),
      ('ea794a5e-3784-4e00-84a8-cbabf32a25e4'::uuid, '/carte-stage-esmt-centre-carriere.webp')
    ) AS v(id, image_url)
   WHERE o.id = v.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 7 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % image(s) remise(s) au lieu de 7', v_n;
  END IF;

  UPDATE public.job_offers
     SET is_active = false
   WHERE id IN ('7775fbc4-8552-4733-aeb9-33926a9c8848', '346d7c1e-96cb-4a10-8c0b-654956cffd88', 'e036aa9e-fcf1-4515-9b99-100304c714b2')
     AND is_active = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'Retour arrière annulé : % offre(s) masquée(s) au lieu de 3', v_n;
  END IF;
END
$$;

COMMIT;
