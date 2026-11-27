-- Invariant 2 : retire une table sonde oubliée par un lancement interrompu des invariants (02/11/2026).
-- Elle a été créée par le test « DEFAULT PRIVILEGES » (tests/security/invariants.spec.js), qui la supprime normalement lui-même.
-- Vérifié le 27/11/2026 : 0 ligne, aucun droit anon/authenticated, aucune clé étrangère ni vue ne la référence.
DROP TABLE IF EXISTS public._test_default_privileges_probe_1793621908561;
