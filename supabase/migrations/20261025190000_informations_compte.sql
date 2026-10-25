-- « Informations du compte » : changer ou dissocier le téléphone et l'e-mail, avec les MÊMES règles côté serveur pour le site, Facilité et Locaux.
--
-- Cette migration pose :
--  1) compte_journal_securite : journal de sécurité (écrit par le serveur seulement, chacun ne lit que ses propres lignes) ;
--  2) compte_verifications : codes à usage unique et autorisations de courte durée (table fermée aux clients : jamais lue ni écrite depuis une application) ;
--  3) synchroniser_contact_profil() : tout changement d'e-mail dans l'authentification est recopié dans profiles.email par la base elle-même
--     (source de vérité = auth.users ; avant ce déclencheur, rien ne mettait profiles.email à jour après un changement) ;
--  4) compte_dissocier_methode() : retire le téléphone ou l'e-mail d'un compte, côté SERVEUR seulement. Constat du 25/10/2026 : l'API d'administration accepte
--     « email: vide » ou « phone: vide » SANS aucun effet, et la dissociation par le client (unlinkIdentity) exige le réglage Supabase « liaison manuelle »,
--     désactivé par défaut. Cette fonction fait ce que fait l'authentification elle-même (supprime l'identité, vide le champ), mais seulement après les
--     contrôles du serveur, et refuse de retirer la dernière méthode de connexion ;
--  4 bis) compte_valeur_prise() : « ce numéro / cette adresse est-il déjà utilisé ? », réponse neutre ;
--  5) le drapeau feat_compte_telephone, DÉSACTIVÉ : la partie téléphone reste cachée tant que les SMS ne sont pas fiables.

-- 1) Journal de sécurité
CREATE TABLE IF NOT EXISTS public.compte_journal_securite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (char_length(type) BETWEEN 3 AND 60),
  canal TEXT CHECK (canal IS NULL OR canal IN ('email', 'telephone')),
  resultat TEXT NOT NULL CHECK (resultat IN ('ok', 'refuse', 'echec')),
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 120),
  -- Empreinte de l'adresse IP (jamais l'adresse en clair).
  ip_hash TEXT,
  appareil TEXT CHECK (appareil IS NULL OR char_length(appareil) <= 200),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compte_journal_securite ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compte_journal_securite FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.compte_journal_securite TO authenticated;
-- Le serveur (service_role) écrit le journal : droit explicite, car depuis le correctif DEFAULT PRIVILEGES (2026-08-07) une table neuve n'en reçoit aucun.
GRANT ALL ON public.compte_journal_securite TO service_role;
DROP POLICY IF EXISTS "Une personne lit son propre journal de securite" ON public.compte_journal_securite;
CREATE POLICY "Une personne lit son propre journal de securite" ON public.compte_journal_securite
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS compte_journal_securite_utilisateur ON public.compte_journal_securite (user_id, cree_le DESC);
CREATE INDEX IF NOT EXISTS compte_journal_securite_ip ON public.compte_journal_securite (ip_hash, cree_le DESC) WHERE ip_hash IS NOT NULL;

-- 2) Codes et autorisations (fermée aux clients : aucun droit, aucune policy)
CREATE TABLE IF NOT EXISTS public.compte_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'telephone')),
  -- preuve : code envoyé à la méthode ACTUELLE ; autorisation : jeton de courte durée obtenu après une preuve ; nouvelle_valeur : code envoyé à la NOUVELLE valeur.
  but TEXT NOT NULL CHECK (but IN ('preuve', 'autorisation', 'nouvelle_valeur')),
  nouvelle_valeur TEXT,
  code_hash TEXT NOT NULL,
  autorisation_id UUID REFERENCES public.compte_verifications(id) ON DELETE CASCADE,
  expire_le TIMESTAMPTZ NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0,
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compte_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compte_verifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.compte_verifications TO service_role;
CREATE INDEX IF NOT EXISTS compte_verifications_utilisateur ON public.compte_verifications (user_id, but, cree_le DESC);

-- 3) Synchronisation d'auth.users vers profiles : l'E-MAIL SEULEMENT.
--    Le téléphone n'est PAS recopié : dans plusieurs écrans (vendeur, informations personnelles, scanner de CV), profiles.phone est le numéro de CONTACT
--    saisi par la personne (contact du vendeur), distinct du numéro de connexion. Tant que les deux ne sont pas séparés (chantier à part), un changement
--    ou une dissociation du numéro de connexion ne doit jamais modifier ni vider profiles.phone.
CREATE OR REPLACE FUNCTION public.synchroniser_contact_profil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NULLIF(NEW.email, '') WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.synchroniser_contact_profil() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS synchroniser_contact_profil ON auth.users;
CREATE TRIGGER synchroniser_contact_profil
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.synchroniser_contact_profil();

-- 4) Dissociation côté serveur
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

  v_email_ok := COALESCE(v_user.email, '') <> '' AND v_user.email_confirmed_at IS NOT NULL;
  v_tel_ok := COALESCE(v_user.phone, '') <> '' AND v_user.phone_confirmed_at IS NOT NULL;
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
           raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{providers}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(COALESCE(raw_app_meta_data->'providers', '[]'::jsonb)) p WHERE p <> 'phone'), '[]'::jsonb)),
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
           raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{providers}', COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(COALESCE(raw_app_meta_data->'providers', '[]'::jsonb)) p WHERE p <> 'email'), '[]'::jsonb)),
           updated_at = now()
     WHERE id = p_user_id;
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = p_user_id;
  RETURN jsonb_build_object('email', v_user.email, 'phone', v_user.phone);
END;
$$;
REVOKE ALL ON FUNCTION public.compte_dissocier_methode(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compte_dissocier_methode(UUID, TEXT) TO service_role;

-- 4 bis) Valeur déjà utilisée par un AUTRE compte ? Réponse booléenne seulement : l'écran dit « Impossible d'utiliser ce numéro » sans jamais révéler à qui il appartient.
--        Le téléphone est comparé aux comptes ET aux numéros inscrits dans les profils (même règle que verifier_numero_profil).
CREATE OR REPLACE FUNCTION public.compte_valeur_prise(p_canal TEXT, p_valeur TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chiffres TEXT := regexp_replace(COALESCE(p_valeur, ''), '\D', '', 'g');
BEGIN
  IF p_canal = 'email' THEN
    RETURN EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(p_valeur) AND u.id <> p_user_id);
  ELSIF p_canal = 'telephone' THEN
    IF v_chiffres = '' THEN
      RETURN TRUE;
    END IF;
    RETURN EXISTS (SELECT 1 FROM auth.users u WHERE regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = v_chiffres AND u.id <> p_user_id)
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = v_chiffres AND p.id <> p_user_id);
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.compte_valeur_prise(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compte_valeur_prise(TEXT, TEXT, UUID) TO service_role;

-- Le serveur lit les drapeaux pour savoir si la partie téléphone est ouverte (la table n'accordait la lecture qu'aux clients).
GRANT SELECT ON public.feature_flags TO service_role;

-- 5) Drapeau « téléphone » : DÉSACTIVÉ jusqu'à confirmation que les SMS arrivent sur Orange et Free.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles)
VALUES ('feat_compte_telephone', 'branch_candidat', 'Informations du compte : changer ou dissocier le téléphone', NULL, FALSE, '{"user": true, "visitor": false, "recruiter": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
