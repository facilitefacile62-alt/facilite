-- Correctif de privilèges sur public.toggle_message_pin.
--
-- La migration 20260729120000 faisait `REVOKE ALL ... FROM PUBLIC` puis
-- `GRANT EXECUTE ... TO authenticated`, en supposant que le rôle `anon` perdait
-- ainsi tout accès. Vérification faite sur la base distante : un appel REST muni
-- de la seule clé anon atteignait malgré tout le corps de la fonction (il était
-- rejeté par le contrôle interne `auth.uid() IS NULL`, code 28000, et non par le
-- moteur de privilèges).
--
-- Raison : Supabase configure des ALTER DEFAULT PRIVILEGES qui accordent EXECUTE
-- nominativement aux rôles `anon` et `authenticated` sur toute nouvelle fonction
-- du schéma public. Un REVOKE sur PUBLIC (le pseudo-rôle) ne retire pas ces
-- grants nominatifs : il faut cibler `anon` explicitement.
--
-- Aucune faille n'était exploitable — la fonction refusait déjà tout appelant
-- non authentifié — mais on rétablit ici la défense en profondeur annoncée :
-- le rôle anon ne doit pas même pouvoir entrer dans la fonction.

REVOKE ALL ON FUNCTION public.toggle_message_pin(UUID, BOOLEAN) FROM anon;

-- Réaffirmé par idempotence : seuls les utilisateurs authentifiés exécutent.
GRANT EXECUTE ON FUNCTION public.toggle_message_pin(UUID, BOOLEAN) TO authenticated;
