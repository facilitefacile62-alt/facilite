-- Migration 20260814020000_add_missing_performance_indexes.sql
-- Optimisation des performances des requêtes et relations clés (Point F2) :
-- 1. messages(sender_id) -> Accélère les requêtes d'historique de conversation et de messages non lus
-- 2. candidatures(user_id) -> Accélère le chargement de l'espace candidat et des candidatures soumises
-- 3. resumes(user_id) -> Accélère la liste des CVs et l'extraction de documents par utilisateur
-- 4. profiles(updated_at) -> Accélère le tri, le RAG matching et la synchronisation des profils

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_candidatures_user_id ON public.candidatures(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles(updated_at);
