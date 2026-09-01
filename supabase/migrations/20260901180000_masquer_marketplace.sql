-- Masquer la Marketplace le temps de la reconstruire.
--
-- Le module est aujourd'hui un prototype d'interface branché sur rien :
--
--   * les annonces vivent dans localStorage (`facilite_mkt_all_items_v3`).
--     Une personne qui publie ne voit son annonce que sur son propre appareil.
--     Personne d'autre ne la verra jamais, et un vidage du navigateur l'efface.
--   * les photos sont encodées en base64 dans ce même localStorage, sans
--     compression ni plafond. Le quota tourne autour de 5 Mo : au bout de
--     quelques photos l'écriture échoue, l'erreur part dans console.error, et
--     l'annonce disparaît sans que personne ne soit prévenu.
--   * la « recherche visuelle par IA » n'analyse aucune image : elle cherche
--     des mots-clés dans le NOM du fichier et affiche un faux état d'analyse.
--
-- Le drapeau est donc coupé, pas la page supprimée : le travail d'interface
-- déjà fait sert de base à la reconstruction sur table réelle.
--
-- Le basculement passe par une migration plutôt que par l'interface
-- d'administration parce que c'est une décision d'exposition publique : elle
-- doit rester lisible dans l'historique du dépôt, avec son motif.

UPDATE public.feature_flags
SET enabled = false,
    updated_at = now()
WHERE id = 'nav_marketplace';
