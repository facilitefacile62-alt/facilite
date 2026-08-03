# État du projet Facilite — 2026-08-03

Ce document répond à une seule question : **où en est-on aujourd'hui,
concrètement**, pour quelqu'un qui n'a pas suivi le détail des chantiers.
Écrit pour être relu dans un mois sans contexte perdu.

## En une phrase

La base de données est très solidement sécurisée (8 invariants automatiques,
113 tests, revérifiés à chaque changement). Le code qui l'utilise, lui, est
**en retard d'un déploiement** — la production tourne encore sur une version
qui ignore une partie des protections déjà en place en base.

## ⚠️ Ce qu'il faut savoir avant tout le reste

**La production (`ee4c7f5`) est en retard sur la base de données.** Plusieurs
migrations de sécurité ont été appliquées directement en base ces derniers
jours, sans que le code correspondant soit déployé. Concrètement aujourd'hui :

- Un nouveau recruteur qui tente de publier sa première offre sur le site en
  ligne échoue avec un message d'erreur générique, sans explication — parce
  que la base exige désormais une accréditation que l'ancien code ne sait pas
  demander.
- Les recruteurs déjà actifs ne sont pas affectés (vérifié individuellement).

Une branche (`chantier-securite-etapes-a-f`, poussée sur GitHub, pas encore
fusionnée) contient le code à jour qui corrige ça. Elle attend une décision
de fusion. Voir la section "Prochaine étape immédiate" plus bas.

## Ce qui est fait et protégé

### Fondations de sécurité (automatiques, revérifiées à chaque changement)

8 invariants tournent en CI sur chaque push/PR et peuvent être relancés à la
main (`npx playwright test tests/security/invariants.spec.js`) :
1. Aucun GRANT `UPDATE`/`DELETE` non justifié sur `authenticated`/`anon`.
2. Aucune table sans protection RLS.
3. Aucune fonction `SECURITY DEFINER` sans `search_path` figé.
4. Aucun bucket Storage public non justifié.
5. Aucun endpoint API sans contrôle d'autorisation.
6. Aucun usage de `service_role` sans filtrage manuel du bon utilisateur.
7. Aucune policy RLS permissive tautologique, ni référence à un rôle qui
   n'existe plus dans le modèle actuel.
8. Aucune garde de rôle/statut fragile face à `NULL` (la classe de bug qui a
   permis, une fois, à un admin suspendu de continuer à agir).

113 tests E2E couvrent ces invariants et les fonctionnalités listées
ci-dessous, contre l'API réelle (clé anon), pas des simulations.

### Modèle de rôles et modération

- `user`/`publisher`/`admin` + badges — l'ancien modèle
  `candidat`/`recruteur`/`agent` n'existe plus nulle part (scanné
  exhaustivement, y compris dans les policies et fonctions).
- Toute offre naît en attente de modération, invisible publiquement jusqu'à
  validation par un admin. Une modification substantielle repasse l'offre en
  attente. Un recruteur ne peut pas s'auto-approuver, même en manipulant la
  requête d'insertion directement.
- Suspension de compte : verrou au niveau PostgreSQL (`current_user_role()`
  renvoie `NULL`), effectif immédiatement avec le même jeton déjà émis — pas
  seulement un blocage de l'écran de connexion.

### Protection des données candidat

- Coordonnées (email, CV) masquées au recruteur tant que le candidat n'a pas
  explicitement cliqué "Autoriser le contact" pour cette candidature précise.
- `cv_visible_recruteurs` : opt-in, désactivé par défaut — déposer un CV
  n'active jamais automatiquement sa visibilité.
- Isolation stricte entre recruteurs (un recruteur ne voit jamais les
  candidatures d'un autre) et entre comptes de test/réels (un compte de
  démonstration ne peut jamais recevoir un profil candidat réel).
- Pagination plafonnée en dur côté serveur (50 lignes max), aucun export en
  masse nulle part dans l'interface recruteur.

### Espace recruteur

- Le badge `verified_recruiter` conditionne désormais tout l'espace
  recruteur (offres, candidatures, profil vitrine, CVthèque) — plus
  seulement la CVthèque. Un compte non accrédité voit un écran de demande
  d'accréditation (NINEA/RCCM/attestation) à la place du tableau de bord.
- Tableau de bord "Vue d'ensemble" : KPI avec évolution vs période
  précédente, graphique 30 jours, entonnoir de recrutement par offre (vues →
  candidatures → présélection → contactés → entretien → retenu/écarté),
  agrégats calculés côté base (jamais une boucle sur des données brutes non
  paginées côté client).
- Mode démo : un compte fictif dédié (`is_test_account=true`) avec un jeu de
  données riche pour les présentations investisseurs, invisible du site
  public et des vrais utilisateurs — testé et prouvé, pas juste documenté.

### Fiabilité de la suite de tests elle-même

Un run complet qui pouvait rester bloqué indéfiniment (un appel réseau
synchrone qui gelait tout le process, sans qu'aucun timeout ne puisse
intervenir) a été diagnostiqué et corrigé — voir
`docs/diagnostic-tests-bloquants.md`. La suite complète prend maintenant
9-13 minutes de façon fiable, avec un résultat structuré lisible dans
`test-results/results.json`.

## Ce qui reste ouvert (connu, pas oublié)

Par ordre de priorité, d'après `docs/diagnostic-2026-08.md` :

1. **Le registre de migrations `supabase db push` est désynchronisé** — 24
   migrations sont réellement appliquées en base mais absentes du registre
   de la CLI (appliquées via une connexion directe faute d'alternative à
   l'époque). Ça ne casse rien aujourd'hui, mais ça veut dire que le dépôt
   ne peut plus recréer la base depuis zéro avec `db push`, et que lancer
   cette commande sans réconciliation préalable tenterait de tout ré-appliquer.
2. **`/admin/messages` sélectionne une colonne qui n'existe plus**
   (`profiles.role`, supprimée par le chantier RBAC) — erreur silencieuse,
   jamais lue par le code appelant.
3. **Aucune capture des refus 401/403 ni des échecs de connexion répétés** —
   le signal le plus utile pour détecter une attaque en cours n'existe pas
   encore.

## Ce qui n'est pas commencé

- **Panneau de sécurité temps réel** (vue d'ensemble des invariants,
  événements de sécurité en direct, RLS scopé admin-only) — spécifié mais
  volontairement repoussé après le mode démo et le funnel KPI, qui viennent
  d'être livrés.
- **SMTP Resend + parcours de récupération de mot de passe** — les templates
  email existent (`supabase/templates/`), mais SMTP n'est pas configuré côté
  Dashboard Supabase, et `auto_confirm_user` n'a pas été retiré (dépend de
  cette configuration).
- **Projet Supabase de test séparé** — actuellement, tous les tests E2E de
  ce dépôt tournent contre la même base que la production (`.env.local`
  pointe sur le même projet). C'est ce qui a causé la fuite de fausses
  offres de test ("Test audit sécurité — à ignorer") visibles publiquement
  sur le site pendant plusieurs jours avant d'être repérée et nettoyée le
  2026-08-03. Tant que ce projet séparé n'existe pas, ce risque reste entier
  à chaque nouvelle session de tests.

## Prochaine étape immédiate

Décision en attente : fusionner `chantier-securite-etapes-a-f` vers `main`
et déployer. Voir le rapport de préparation de fusion (commits détaillés,
impact utilisateurs, plan de retour arrière) livré le 2026-08-03 — non
dupliqué ici pour éviter la désynchronisation entre deux documents qui
raconteraient la même chose différemment une fois la fusion faite.
