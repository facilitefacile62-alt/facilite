-- Correctif de 20261025190000 (invariant 8) : compte_dissocier_methode() comparait avec « <> » ; l'invariant exige IS DISTINCT FROM pour toute garde dans une fonction
-- SECURITY DEFINER. Comportement strictement identique (les valeurs comparées ne sont jamais NULL : COALESCE(..., '') et éléments de liste). Droits inchangés : service_role seulement.
CREATE OR REPLACE FUNCTION public.compte_dissocier_methode(p_user_id UUID, p_canal TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_email_ok BOOLEAN;
  v_tel_ok BOOLEAN;
  v_autres INTEGER;
BEGIN
  IF p_canal NOT IN ('email', 'telephone') THEN
    RAISE EXCEPTION 'canal_invalide';
  END IF;
  SELECT * INTO v_user FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'compte_introuvable';
  END IF;

  v_email_ok := COALESCE(v_user.email, '') IS DISTINCT FROM '' AND v_user.email_confirmed_at IS NOT NULL;
  v_tel_ok := COALESCE(v_user.phone, '') IS DISTINCT FROM '' AND v_user.phone_confirmed_at IS NOT NULL;
  -- Connexions par un fournisseur (Google, Apple…) : elles comptent comme une méthode de connexion.
  SELECT count(*) INTO v_autres FROM auth.identities i WHERE i.user_id = p_user_id AND i.provider NOT IN ('email', 'phone');

  IF p_canal = 'telephone' THEN
    IF NOT v_tel_ok AND COALESCE(v_user.phone, '') = '' THEN
      RAISE EXCEPTION 'rien_a_dissocier';
    END IF;
    IF NOT (v_email_ok OR v_autres > 0) THEN
      RAISE EXCEPTION 'derniere_methode';
    END IF;
    DELETE FROM auth.identities WHERE user_id = p_user_id AND provider = 'phone';
    UPDATE auth.users
       SET phone = NULL, phone_confirmed_at = NULL, phone_change = '', phone_change_token = '', phone_change_sent_at = NULL,
           raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{providers}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(COALESCE(raw_app_meta_data->'providers', '[]'::jsonb)) p WHERE p IS DISTINCT FROM 'phone'), '[]'::jsonb)),
           updated_at = now()
     WHERE id = p_user_id;
  ELSE
    IF NOT v_email_ok AND COALESCE(v_user.email, '') = '' THEN
      RAISE EXCEPTION 'rien_a_dissocier';
    END IF;
    IF NOT (v_tel_ok OR v_autres > 0) THEN
      RAISE EXCEPTION 'derniere_methode';
    END IF;
    DELETE FROM auth.identities WHERE user_id = p_user_id AND provider = 'email';
    UPDATE auth.users
       SET email = NULL, email_confirmed_at = NULL, email_change = '', email_change_token_new = '', email_change_token_current = '', email_change_sent_at = NULL,
           raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{providers}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(COALESCE(raw_app_meta_data->'providers', '[]'::jsonb)) p WHERE p IS DISTINCT FROM 'email'), '[]'::jsonb)),
           updated_at = now()
     WHERE id = p_user_id;
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = p_user_id;
  RETURN jsonb_build_object('email', v_user.email, 'phone', v_user.phone);
END;
$$;
REVOKE ALL ON FUNCTION public.compte_dissocier_methode(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compte_dissocier_methode(UUID, TEXT) TO service_role;
