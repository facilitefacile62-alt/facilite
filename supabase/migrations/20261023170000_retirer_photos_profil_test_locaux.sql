-- Retire la photo et la couverture de profil du compte de test « Moussa Kane » : elles avaient été choisies depuis les écrans de LOCAUX
-- pendant que ces écrans écrivaient encore dans le profil partagé, et apparaissaient donc aussi côté Facilité (23/10/2026). Depuis, le profil
-- de Locaux est séparé (logo et couverture de la BOUTIQUE) : le profil de Facilité repart sans photo.
UPDATE public.profiles
SET avatar_url = NULL, cover_url = NULL
WHERE id = 'a4e5c53a-2fc7-4012-a4b0-89bc4ad64001';
