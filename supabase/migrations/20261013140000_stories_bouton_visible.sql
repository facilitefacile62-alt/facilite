-- Interrupteur « bouton visible » des stories : l'administrateur peut cacher le
-- bouton d'action (et donc le numéro WhatsApp / le lien) d'une story sans
-- effacer ce qu'il a saisi. Bouton masqué = il disparaît de la story, sur le
-- site comme dans l'application. Visible par défaut (comportement actuel).
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS bouton_visible boolean NOT NULL DEFAULT true;
