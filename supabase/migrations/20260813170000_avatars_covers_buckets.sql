-- =====================================================================
-- Point 3 du chantier "photos de profil et couverture instables" —
-- migration base64 -> Storage. Étape 1/2 : création des buckets, PRIVÉS
-- dès le départ (contrairement à chat-attachments/job-offers, aucune
-- raison qu'une photo de profil soit servie par URL publique directe —
-- accès uniquement via URL signée, résolue à la demande).
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', false)
ON CONFLICT (id) DO UPDATE SET public = false;
