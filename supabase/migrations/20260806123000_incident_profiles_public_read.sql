-- =====================================================================
-- INCIDENT 2026-08-06 (suite) : policy "Profiles read access" trouvée sur
-- public.profiles pendant le balayage de la Partie 5 ("la classe, pas le
-- cas") du diagnostic. USING (true) pour le rôle public + GRANT SELECT à
-- anon = table profils entière lisible par quiconque possède la clé anon
-- (publique par construction), sans authentification. Vérifié en direct :
-- une requête REST anonyme sur /rest/v1/profiles retourne email, phone,
-- birth_date, gender, marital_status, driver_license, cv_url pour
-- N'IMPORTE QUEL compte. Voir docs/incident-2026-08-06.md.
--
-- Cette policy n'apparaît dans AUCUNE migration : créée hors du processus
-- de migration, comme auto_confirm_user avant elle (Invariant 10). Elle
-- fait doublon avec le chemin déjà prévu et correctement filtré pour les
-- profils publics : la fonction SECURITY DEFINER
-- public.get_profils_publics() (20260802200000_security_advisor_fixes.sql),
-- qui ne renvoie que les profils avec is_public = true et seulement les
-- colonnes sûres (jamais email/phone/birth_date/marital_status/driver_license
-- en clair). Les autres besoins de lecture légitimes restent couverts par
-- les policies déjà en place et correctement scopées : "Lecture de son
-- propre profil", "Un admin lit tous les profils", "Un agent lit le profil
-- de ses candidats assignes".
DROP POLICY IF EXISTS "Profiles read access" ON public.profiles;

-- Effet de bord découvert immédiatement après la suppression ci-dessus :
-- get_profils_publics() (le chemin public légitime) s'est mis à échouer
-- avec "permission denied for function current_user_role" pour un appelant
-- anonyme. anon n'a jamais eu EXECUTE sur current_user_role() — un manque
-- préexistant, resté invisible tant que la policy tautologique ci-dessus
-- permettait au planificateur de contourner l'évaluation des autres
-- policies de public.profiles (dont "Un admin lit tous les profils", qui
-- appelle current_user_role() dans son USING). current_user_role() est
-- SECURITY DEFINER et ne fait que lire public.user_roles filtré par
-- auth.uid() — pour un appelant anonyme (auth.uid() = null), elle renvoie
-- simplement null, sans rien exposer. Sûr à ouvrir à anon.
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;

-- Deuxième effet de bord découvert en vérifiant le premier : même corrigé,
-- get_profils_publics() refusait encore tout appel anonyme
-- ("permission denied for function get_profils_publics"), alors que
-- 20260802200000_security_advisor_fixes.sql accorde explicitement
-- `GRANT EXECUTE ... TO anon, authenticated` et qu'aucune migration
-- ultérieure ne touche cette fonction. Le GRANT anon a donc été retiré hors
-- du processus de migration — troisième cas du même schéma que le bucket
-- resumes et la policy "Profiles read access" dans cette seule Partie 5.
-- Contrairement aux deux autres, celui-ci CASSAIT une fonctionnalité
-- légitime (la page de profil public /in/[username] pour un visiteur non
-- connecté) plutôt que d'exposer une donnée : on rétablit l'intention
-- documentée d'origine, pas une permission nouvelle.
GRANT EXECUTE ON FUNCTION public.get_profils_publics() TO anon;
