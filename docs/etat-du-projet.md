# État du projet Facilite — 2026-08-07 (mise à jour)

Ce document répond à une seule question : **où en est-on aujourd'hui,
concrètement**, pour quelqu'un qui n'a pas suivi le détail des chantiers.
Écrit pour être relu dans un mois sans contexte perdu. Remplace entièrement
la version précédente du même jour — obsolète depuis la bascule KPay en
production et le chantier du tableau de bord admin.

## En une phrase

KPay est en production (clés Live), le paiement et le webhook sont prouvés
fonctionnels de bout en bout — il ne manque qu'un paiement mobile money qui
aboutisse réellement pour clore définitivement ce point. Le tableau de bord
admin a été réorganisé et enrichi d'un onglet Sécurité temps réel. Une
faille structurelle qui rendait chaque correction de GRANT fragile (les
droits par défaut du schéma se rouvraient à chaque nouvelle table) a été
corrigée à la source.

## Ce qui est fait et protégé

### KPay — Live, sous réserve d'un paiement réel confirmé

Bascule en production effectuée le 2026-08-07 : nouvelles clés Live
générées et déployées sur Vercel, ancienne paire sandbox révoquée,
redéploiement confirmé (`ffacilite.com` sert bien le build avec les
nouvelles variables).

- **Checkout fonctionnel** : testé en conditions réelles contre la
  production (compte candidat de test, vraie requête `POST
  /api/pay/checkout`), commande créée en base, vrai lien de paiement KPay
  obtenu.
- **Webhook fonctionnel et signature acceptée** : un premier test a révélé
  `KPAY_WEBHOOK_SECRET` désynchronisé (signature rejetée) — corrigé côté
  Vercel. Un second test, surveillé en direct dans les logs Vercel pendant
  que l'utilisateur complétait le paiement, a confirmé la réception de
  deux appels `POST /api/pay/kpay-webhook` acceptés (niveau `info`, pas
  `error`) : la chaîne checkout → KPay → webhook signé → traitement selon
  le statut est prouvée bout en bout.
- **Ce qui reste en attente** : les deux tentatives de paiement réel ont
  toutes les deux échoué côté opérateur mobile money ("Échec du paiement —
  aucun montant débité", écran KPay), pas côté plateforme. Le code gère
  déjà ce cas correctement (statut ≠ `COMPLETED` → aucune écriture en
  base). **Un premier paiement qui aboutit réellement (`COMPLETED`)
  confirmera la dernière étape** (webhook → `orders.payment_status =
  'paid'`) — non testé faute d'un paiement mobile money réussi jusqu'ici.

### Fondations de sécurité automatiques

13 invariants tournent en CI sur chaque push/PR
(`npx playwright test tests/security/invariants.spec.js`, détail dans
`docs/invariants-securite.md`), dont deux ajoutés le 2026-08-07 : aucun
compte de test avec `role='admin'` hors liste blanche, et aucune fonction
`SECURITY DEFINER` critique sans `GRANT EXECUTE` actif.

**Connu et non réglé** : ce job CI ne bloque encore aucun déploiement —
`main` n'a pas de branch protection GitHub l'exigeant (voir "Ce qui reste
ouvert").

### ALTER DEFAULT PRIVILEGES — corrigé à la source (2026-08-07)

Découverte en construisant l'onglet Sécurité : le schéma `public` accordait
silencieusement, à **chaque nouvelle table/fonction/séquence créée par le
rôle `postgres`** (donc par toute migration future), des droits complets à
`anon`/`authenticated` — sans qu'aucun `GRANT` n'apparaisse dans la
migration elle-même. Cause probable d'une partie des GRANTs "jamais
tracés" trouvés et corrigés table par table pendant ce chantier
(`establishments`, `is_admin(uuid)`, `invariant_status`...).

Corrigé par `ALTER DEFAULT PRIVILEGES ... REVOKE` pour le rôle `postgres`
(celui par lequel 100 % des migrations de ce projet passent). Preuve
empirique : une vraie table temporaire créée après le correctif n'hérite
plus d'aucun droit `anon`/`authenticated`, testé et supprimé. Invariant 1
étendu pour vérifier `pg_default_acl` en continu — toute régression future
serait détectée automatiquement.

**Limite documentée, pas ignorée** : le rôle `postgres` n'a pas la
permission de modifier les default privileges de `supabase_admin`
(`permission denied to change default privileges`, testé). Sans impact
pratique tant que la règle "jamais de schéma créé via le Dashboard, toujours
via migration CLI" (`docs/regle-migrations.md`) tient — mais si cette règle
est un jour contournée, cette porte-là resterait ouverte.

### Tableau de bord admin — réorganisé et enrichi (2026-08-07)

- **Navigation** : sidebar catégorisée (Contenu/Communication/Gestion/
  Données/Administration) avec lien actif visible, menu hamburger mobile
  ajouté (les liens de la sidebar étaient auparavant invisibles sur
  mobile). Doublons de navigation supprimés (Messagerie Support en double,
  lien Accueil redondant).
- **Onglet Sécurité** (nouveau) : alertes actives triées par gravité puis
  date (rouge = refus d'accès, orange = quota dépassé), actions
  Suspendre/Ignorer/Marquer résolu, historique 30 jours filtrable par type
  et gravité, mise à jour **temps réel** (Supabase Realtime sur
  `security_logs`, vérifié par test qu'un `publisher` abonné au même canal
  ne reçoit rien), encart Invariants de sécurité affichant le résultat réel
  de la dernière exécution CI (jamais recalculé côté client). Aucune
  suppression de log possible, aucune exécution SQL libre, aucun contenu de
  CV/message exposé — contraintes du client respectées à la lettre.
- **Attribution de badge et compte de test** : interrupteurs directement
  dans la liste des comptes (`grant_verified_recruiter_badge()`,
  `set_test_account_flag()`, admin-only, journalisées dans
  `security_logs`), confirmation obligatoire avant d'accorder le badge à un
  compte non-test, bandeau "Mode test" pour les admins connectés avec
  `is_test_account = true`.
- **Éléments inactifs corrigés** : `ScraperDashboard` (bouton "Lancer le
  scraping") était câblé en dur sur `localhost:8000`, donc systématiquement
  cassé en production — utilise maintenant `NEXT_PUBLIC_API_URL` avec un
  avertissement explicite si la variable est absente (elle ne l'est pas
  configurée sur Vercel à ce jour, voir "Ce qui reste ouvert").

### Incident du 2026-08-06 — fermé, documenté intégralement

Voir `docs/incident-2026-08-06.md` pour la chronologie complète : bucket
`resumes` public corrigé, policy `profiles` ouverte à tous supprimée,
GRANTs `establishments` retirés, `is_app_admin()` orpheline supprimée.
Origine jamais tracée dans une migration — `docs/regle-migrations.md`
formalise la règle qui aurait empêché ça, et le correctif ALTER DEFAULT
PRIVILEGES ci-dessus en referme une partie de la cause structurelle.

### Détection active des abus, minimisation des données, sauvegarde, SMTP, rôles/modération

Inchangés depuis la version précédente de ce document — toujours vrais,
non re-décrits ici pour éviter la redondance. Voir l'historique git de ce
fichier pour le détail complet si besoin.

## Récapitulatif final

### FERMÉ ET PROTÉGÉ

- Incidents du 2026-08-06 (bucket public, policy `profiles` ouverte,
  GRANTs `establishments`) — corrigés, invariants automatiques empêchant
  la récidive.
- Clé privée de sauvegarde — confirmée hors du disque, deux copies sûres
  ailleurs.
- SMTP / récupération de mot de passe — confirmé par un vrai clic humain.
- Comptes de test correctement rôlés (Invariant 12).
- `approve_badge_request()` — GRANT restauré (Invariant 13 empêche la
  récidive silencieuse pour toute fonction critique).
- **ALTER DEFAULT PRIVILEGES sur `public`** — corrigé à la source pour le
  rôle `postgres`, vérifié par test, surveillé en continu par Invariant 1.
- **`payment_reference` NULL sur les commandes** — policy RLS `UPDATE`
  manquante ajoutée (scopée au propriétaire, colonne `payment_reference`
  uniquement — le `GRANT` de la vague 3 restait déjà correctement limité,
  seule la policy manquait). Vérifié : une commande fraîche obtient bien sa
  référence, `payment_status` reste inaccessible au propriétaire, une
  commande d'un autre compte reste inaccessible.
- **KPay checkout et webhook** — chaîne technique prouvée fonctionnelle de
  bout en bout (signature acceptée, traitement correct selon statut).
- **Tableau de bord admin** — navigation réorganisée, onglet Sécurité
  temps réel, attribution de badge/compte de test via RPC admin-only
  journalisées, `ScraperDashboard` corrigé.
- Sauvegarde chiffrée — testée réellement (restauration + intégrité
  vérifiées).
- Quota CV et détection des refus d'accès répétés — vérifiés en
  production réelle.
- Modèle de rôles, modération, espace recruteur, entretiens vidéo
  (Daily.co) — fonctionnels, vérifiés dans le code.

### OUVERT ET DOCUMENTÉ

1. **Un paiement KPay `COMPLETED` réel n'a pas encore été observé** —
   risque **faible** : la logique de traitement est déjà prouvée correcte
   pour les statuts non-`COMPLETED` (aucune écriture erronée), il ne reste
   qu'à confirmer le dernier maillon (`payment_status → 'paid'`) sur un
   vrai paiement réussi. Deux tentatives ont échoué côté opérateur mobile
   money, pas côté plateforme.
2. **CI ne bloque pas le déploiement** — risque **moyen** : branch
   protection GitHub sur `main` toujours à confirmer (procédure exacte
   redonnée à l'utilisateur le 2026-08-07, à appliquer manuellement — droits
   admin GitHub requis).
3. **Automatisation de la sauvegarde** — risque **moyen** : dépend des 6
   secrets GitHub Actions (compte de service Google Cloud) à configurer.
4. **`NEXT_PUBLIC_API_URL` non configurée sur Vercel** — risque
   **faible** : `ScraperDashboard` affiche maintenant un avertissement
   explicite au lieu d'échouer silencieusement, mais l'agrégation reste
   inutilisable en production tant que le backend FastAPI n'est pas
   déployé quelque part et référencé par cette variable.
5. **`auth.audit_log_entries` vide** — risque **faible** : limite la
   détection des échecs de connexion natifs Supabase, cause non identifiée.
6. **Détection limitée à 2 routes** (CVthèque, candidatures) — risque
   **faible** : profils et messagerie restent hors du périmètre de
   détection des refus d'accès (architecture directe-PostgREST, pas de
   Route Handler dédié).
7. **`supabase_admin` garde des DEFAULT PRIVILEGES larges** — risque
   **faible/théorique** : hors de portée du rôle `postgres` utilisé par ce
   projet ; sans impact tant que le Dashboard Supabase n'est jamais utilisé
   pour créer du schéma (déjà la règle en vigueur).
8. **Registre de migrations et `supabase db push`** — risque **faible** :
   désynchronisation historique jamais entièrement réconciliée, la règle
   "jamais `db push`" reste la seule protection.

### NON COMMENCÉ

- Panneau de sécurité "vue d'ensemble complète" au-delà de l'onglet
  Sécurité actuel (déjà livré : alertes temps réel, historique filtrable,
  statut des invariants — pas encore fait : catalogue exhaustif de tous
  les types d'événements possibles).
- Projet Supabase de test séparé — tous les tests E2E tournent encore
  contre la même base que la production.
- Rétention et purge automatique des CV.
- Migration vers Cloudflare R2/Backblaze B2 (triviale si une carte
  non-prépayée devient disponible, `docs/sauvegarde-restauration.md`).
- Badge/compte de test gérable depuis l'admin pour d'autres attributs que
  `verified_recruiter`/`is_test_account` (aucun autre type de badge
  n'existe dans ce projet à ce jour — pas un manque, juste hors périmètre).

## Prochaine étape suggérée

Dans l'ordre d'impact probable : (1) activer la branch protection GitHub
sur `main` (procédure donnée le 2026-08-07, à appliquer manuellement) pour
que la CI bloque vraiment un déploiement défaillant ; (2) confirmer un
paiement KPay réellement réussi pour clore définitivement ce point ;
(3) terminer la configuration Google Cloud (6 secrets GitHub) pour
l'automatisation de la sauvegarde.

## DETTE TECHNIQUE (Migrations)

L'historique de migrations ne peut pas recréer la base de prod depuis zéro. 18 colonnes de la table `profiles` créées hors migrations. À résorber progressivement avec une migration de rattrapage.

## DETTE TECHNIQUE (Dump de schéma pour le projet de test)

`scripts/dump-schema-via-introspection.js` (remplace `pg_dump`, indisponible
dans cet environnement — ni Docker ni binaire local) ne capture que les
grants table/fonction/séquence via introspection SQL — **jamais le grant
`GRANT USAGE ON SCHEMA public TO anon, authenticated`**, un grant au niveau
du schéma lui-même que `pg_dump` inclut normalement. Sans lui, absolument
rien n'est accessible dans `public` pour ces deux rôles, quels que soient
les autres grants ou policies RLS en place — trouvé le 2026-08-07 en
lançant la suite complète contre `facilite-e2e-test` fraîchement importé
(77 échecs sur 150, la quasi-totalité causée par ce seul grant manquant).

**À appliquer manuellement sur tout nouveau projet de test** créé à partir
de ce script tant qu'il n'est pas corrigé à la source :
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
```
Déjà ajouté à `supabase/seed-test.sql` pour que tout reset de
`facilite-e2e-test` via ce fichier l'inclue automatiquement — mais le
générateur de dump lui-même n'a pas été corrigé (un futur projet de test
recréé directement depuis le dump, sans repasser par le seed, aurait le
même trou).
