-- Migration corrective : les tables profiles et messages existaient deja sur
-- Supabase (creees hors historique Git) mais avec des policies RLS defaillantes,
-- decouvertes en inspectant directement la base de production :
--   - profiles : SELECT ouvert a "everyone" (fuite de tous les profils)
--   - messages : policy unique (sender_id OR receiver_id) appliquee aussi a
--     l'INSERT, permettant d'usurper un sender_id des lors que receiver_id = soi
--   - handle_new_user() existait mais n'etait cablee a aucun trigger : aucun
--     profil n'etait jamais cree automatiquement a l'inscription
-- Cette migration reapplique une isolation stricte par auth.uid() et cable le
-- trigger de creation automatique de profil.

-- 1. PROFILES : un utilisateur ne voit/modifie que sa propre ligne
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Un utilisateur gere uniquement son propre profil" ON public.profiles;

CREATE POLICY "Un utilisateur gere uniquement son propre profil" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. MESSAGES : lecture par expediteur/destinataire, ecriture strictement
-- au nom de l'expediteur authentifie uniquement

-- La colonne receiver_id existait en production (table creee hors historique
-- Git) mais n'etait definie par aucune migration : les policies ci-dessous la
-- referencent, ce qui faisait echouer tout rejeu sur une base neuve.
-- Ajout idempotent : no-op sur une base ou la colonne existe deja.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);

DROP POLICY IF EXISTS "Users can view and send their messages" ON public.messages;
DROP POLICY IF EXISTS "Un utilisateur gere uniquement ses propres messages" ON public.messages;

CREATE POLICY "Lecture des messages envoyes ou recus" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Envoi de messages en son propre nom uniquement" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Mise a jour de ses propres messages envoyes" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Suppression de ses propres messages envoyes" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- 3. Cablage du trigger de creation automatique de profil a l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
