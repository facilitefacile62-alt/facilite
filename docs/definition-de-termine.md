# Définition de "terminé" — toute nouvelle fonctionnalité

Checklist à cocher avant de considérer une fonctionnalité livrée, dès qu'elle
touche à des données utilisateur, à un rôle, ou à une autorisation. Objectif :
arrêter de découvrir après coup qu'une règle n'existait qu'au niveau du
composant React (donc contournable par un appel API direct).

## 1. L'autorisation tient au niveau PostgreSQL ?

Pas seulement "le bouton est caché" ou "le composant vérifie le rôle avant
d'afficher". La question à se poser : *si quelqu'un appelle l'API ou la table
directement avec sa clé anon/son JWT, sans jamais charger l'interface,
obtient-il la même protection ?*

- RLS activée sur la table concernée, avec une policy qui exprime la vraie
  règle (pas `USING (true)` "pour l'instant").
- Si l'opération est plus complexe qu'un filtre de lignes (ex : transition
  d'état, calcul d'un montant, écriture croisée sur une autre table) →
  fonction `SECURITY DEFINER` avec `search_path` figé, pas une suite de
  requêtes côté client qui espère que chaque étape sera bien appelée dans
  l'ordre.
- Aucun GRANT de table (`UPDATE`/`DELETE`) laissé ouvert à `authenticated`/
  `anon` qui court-circuiterait la fonction ou la policy ci-dessus — c'est la
  faille trouvée trois fois ce chantier (`profiles`, `badge_requests`, et
  systémiquement sur ~18 tables via l'invariant 1). Vérifier avec :
  `SELECT * FROM information_schema.role_table_grants WHERE table_name = '...' AND grantee IN ('authenticated','anon')`.

## 2. Testé par un appel API direct avec la clé anon ?

Pas seulement "vérifié manuellement en cliquant dans l'UI en tant qu'admin".
Un test (Playwright ou script) qui :

- se connecte avec un compte qui NE DEVRAIT PAS avoir accès,
- appelle directement la route ou la table (pas via le composant React),
- vérifie que la réponse est vide/refusée, pas juste que l'UI ne montre rien.

"Vérifié manuellement" ne compte pas comme terminé.

## 3. Les 6 invariants de sécurité passent toujours ?

`npx playwright test tests/security/invariants.spec.js --project=chromium`
(voir [docs/invariants-securite.md](invariants-securite.md)). Si la
fonctionnalité ajoute une table, une fonction `SECURITY DEFINER`, un bucket,
ou une route, elle est automatiquement couverte par ces invariants — les
faire tourner fait partie de la définition de "terminé", pas une option.

## 4. Le cas d'abus a un test commité ?

Pour chaque interdiction énoncée dans la spec de la fonctionnalité ("un
recruteur ne doit pas voir X", "un candidat ne peut modifier que son propre
Y"), il existe un test qui prouve que l'abus échoue, commité dans `tests/`,
avec un chemin de fichier citable. Pas une phrase dans un rapport qui dit
"vérifié" sans preuve exécutable.

## 5. De nouvelles données personnelles sont couvertes par le consentement ?

Si la fonctionnalité expose, collecte, ou rend visible une donnée
personnelle qui ne l'était pas avant (CV, coordonnées, historique, etc.) :

- la visibilité par défaut est-elle restrictive (opt-in), pas permissive
  (opt-out) ? Rappel du principe déjà appliqué à `cv_visible_recruteurs` :
  *"un CV déposé n'est pas un consentement à être présenté."*
- si la donnée existait déjà pour des comptes existants, un backfill
  automatique vers "visible" est-il en train de contourner ce principe ?

## 6. Un test existant a-t-il été modifié ?

Si oui, le diff doit être montré explicitement avant d'être considéré comme
acceptable — jamais silencieux. Une modification de test peut être une mise à
jour légitime (le comportement attendu a changé) ou un affaiblissement
déguisé (le test a été assoupli pour qu'il passe). Seule la personne qui
relit le diff peut trancher.

## 7. La classe du problème est-elle corrigée, pas juste le cas trouvé ?

Quand un problème est découvert (ex : un GRANT de table oublié), la
correction ne s'arrête pas à la table concernée : l'invariant correspondant
est mis à jour ou créé pour que la même classe de problème soit détectée
automatiquement la prochaine fois, sur n'importe quelle table future.
