-- Migration : Isolation stricte des données par utilisateur
-- Date: 2026-07-26
-- Description: Creation des tables profiles et messages (referencees partout dans le
-- code mais jamais migrees), avec RLS strict base sur auth.uid() pour garantir
-- qu'un utilisateur ne peut jamais lire ni ecrire les donnees d'un autre.

-- 1. TABLE PROFILES (une ligne par utilisateur authentifie)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  headline TEXT,
  location TEXT,
  bio TEXT,
  experiences JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un utilisateur gere uniquement son propre profil" ON public.profiles;
CREATE POLICY "Un utilisateur gere uniquement son propre profil" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. TABLE MESSAGES (messagerie privee, strictement isolee par expediteur)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un utilisateur gere uniquement ses propres messages" ON public.messages;
CREATE POLICY "Un utilisateur gere uniquement ses propres messages" ON public.messages
  FOR ALL USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

-- 3. Trigger updated_at pour profiles (reutilise la fonction existante)
DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 4. Creation automatique d'une ligne profiles vide a l'inscription
-- (garantit qu'un nouvel utilisateur ne recupere jamais un profil residuel
-- ou partage : sa ligne est creee vide, isolee par son propre auth.uid())
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
