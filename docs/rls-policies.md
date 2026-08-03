# Politiques RLS publiques — décisions écrites

Ce document liste chaque policy RLS permissive dont le `USING`/`WITH CHECK`
est tautologique (`true`, ou équivalent), détectée par l'Invariant 7
(`tests/security/invariants.spec.js`). Chaque entrée est une décision
explicite, pas un oubli — c'est exactement la distinction que cet invariant
existe pour forcer.

## Scan du 2026-08-03

89 policies passées en revue (schémas `public` + `storage`, toutes
commandes, hors policies réservées à `service_role` qui bypass la RLS de
toute façon). **1 policy tautologique trouvée.**

### `public.recruiter_profiles` — "Lecture publique des profils recruteurs"

```sql
USING (true)  -- SELECT, roles=public
```

**Décision : conservée, whitelistée.**

**Justification** : c'est la page vitrine de l'entreprise recruteuse
(`/recruteurs/[id]`), destinée à être visible par tout visiteur avant même
de créer un compte — même logique produit qu'une page "à propos" publique.
Les colonnes exposées sont : `company_name`, `sector`, `location`,
`logo_url`, `banner_url`, `description`, `website`, `user_id` (identifiant
technique du compte, pas une donnée personnelle en soi). Aucune coordonnée
de contact directe, aucune donnée candidate, aucun champ marqué sensible
dans le schéma de cette table.

## Policies déjà corrigées (pour mémoire, ne réapparaissent plus)

Deux policies de la même classe (permissive trop large, silencieusement
prioritaire sur une policy correcte via combinaison OR) ont été trouvées et
supprimées avant la construction de cet invariant :

- `public.job_offers` : `"Lecture publique des offres" USING (true)` —
  coexistait avec la policy correctement scopée `is_active = true` et la
  rendait inopérante. Toute offre, y compris inactive/archivée, était
  lisible par n'importe qui. Supprimée (Vague 2, Partie 1 du chantier).
- `storage.objects` (bucket `chat-attachments`) : `"Authenticated upload
  chat-attachments" WITH CHECK (bucket_id = 'chat-attachments')` — aucune
  restriction de dossier, n'importe quel compte authentifié pouvait
  téléverser dans le dossier de n'importe qui. Supprimée (Partie 2).

Ces deux cas ont motivé la construction de l'Invariant 7 : deux occurrences
de la même classe en deux sessions consécutives signifient qu'un scan
manuel ponctuel ne suffit pas — seul un test automatisé, exécuté à chaque
changement, empêche une troisième occurrence de passer inaperçue.

## Rôles obsolètes dans une policy (volet ajouté à l'Invariant 7, 2026-08-03)

Distinct du sujet ci-dessus (permissivité), mais détecté par le même test :
deux policies Storage (`"Recruteurs et admins lisent les CV"`, `"Un
recruteur televerse ses visuels d'offres"`) référençaient encore le littéral
`'recruteur'`, un rôle qui n'existe plus depuis la migration RBAC
(`user`/`publisher`/`admin` + badges). Ce n'était pas une policy trop
permissive mais l'inverse — une policy devenue **trop restrictive au point
de ne plus jamais matcher**, cassant silencieusement l'accès pour de vrais
recruteurs vérifiés. Corrigé par
`20260803090000_fix_storage_role_literals.sql` (voir
`docs/diagnostic-2026-08.md`). Aucune entrée `JUSTIFIED_ROLE_LITERAL`
nécessaire actuellement — 0 occurrence restante après correction, vérifié
par scan exhaustif de `pg_policies` + `pg_proc`.

## Comment mettre à jour cette liste

Quand l'Invariant 7 échoue sur une nouvelle policy :

1. Lire la policy et les colonnes réellement exposées par la table/le
   bucket concerné.
2. Décider : la lecture/écriture publique est-elle réellement voulue, ou
   est-ce un oubli (comme les deux cas ci-dessus) ?
3. Si voulue : ajouter `"schema.table:policyname"` au `JUSTIFIED` de
   l'Invariant 7, avec un commentaire de justification inline, **et**
   ajouter l'entrée ici avec le même raisonnement développé.
4. Si oubli : `DROP POLICY` (ou remplacer par une condition explicite),
   vérifier l'effet de bord sur les lectures légitimes (comme fait pour
   `job_offers` — l'ajout compensatoire de `"Un recruteur lit ses propres
   offres"` a été nécessaire après coup), puis exécuter la suite complète.
