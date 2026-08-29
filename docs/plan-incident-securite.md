# Plan d'incident de sécurité

Document opérationnel. Il suppose qu'on le lit sous pression, sans temps pour
explorer le dépôt. Chaque étape indique la commande ou l'écran exact.

Périmètre : compromission suspectée, fuite de données, accès non autorisé,
abus automatisé. Pour une panne sans soupçon de malveillance (504, build
cassé, quota atteint), ce n'est pas le bon document — voir
`docs/diagnostic-2026-08.md`.

---

## 1. Qui contacter

| Rôle | Qui | Comment |
|---|---|---|
| Responsable du produit et des données | facilitefacile62@gmail.com | e-mail, et téléphone si l'incident touche des données de candidats |
| Hébergement applicatif | Vercel — équipe `facilite63`, plan Hobby | dashboard Vercel, support communautaire uniquement (pas de SLA sur ce plan) |
| Base de données et stockage | Supabase — plan gratuit | dashboard Supabase, support par ticket |
| Paiements | KPay, PayDunya | comptes marchands respectifs |
| Envoi d'e-mails | Resend | dashboard Resend |

**Le plan Hobby n'ouvre droit à aucun support prioritaire.** En cas
d'incident grave, ne pas attendre une réponse de Vercel ou de Supabase :
appliquer les mesures d'isolement ci-dessous soi-même.

Obligation légale : si des données personnelles de candidats sont exposées,
la notification aux personnes concernées relève du responsable de
traitement. Les données en jeu sont listées dans la déclaration Data Safety
(profils, CV, lettres, messages, historique de commandes).

---

## 2. Les vingt premières minutes

Dans cet ordre. Ne pas sauter l'étape 2.1 : sans trace, l'incident devient
impossible à reconstituer.

### 2.1 Figer les preuves avant toute correction

```sql
-- Journal de sécurité applicatif, 48 h glissantes
SELECT created_at, event_type, severity, ip_address, resolved_status, details
FROM public.security_logs
WHERE created_at > now() - interval '48 hours'
ORDER BY created_at DESC;

-- Accès aux documents de candidats
SELECT l.accessed_at, l.admin_id, l.candidate_id, l.document_type
FROM public.document_access_logs l
WHERE l.accessed_at > now() - interval '48 hours'
ORDER BY l.accessed_at DESC;

-- Comptes créés récemment (pic = création automatisée)
SELECT date_trunc('hour', created_at) AS heure, count(*)
FROM auth.users
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

Copier les résultats dans un fichier daté avant de modifier quoi que ce
soit. Les journaux Vercel ne sont conservés que peu de temps sur le plan
Hobby : `npx vercel logs <url-du-deploiement>` immédiatement si la piste est
applicative.

### 2.2 Évaluer l'étendue

Trois questions, dans cet ordre :

1. **Des données de candidats sont-elles sorties ?** `document_access_logs`
   et `security_logs` répondent. Si oui, l'incident est majeur : la
   notification aux personnes concernées devient obligatoire.
2. **Un compte administrateur est-il en cause ?**
   `SELECT * FROM public.user_roles WHERE role = 'admin';` — toute ligne
   inattendue est le point de départ.
3. **Des clés ont-elles fuité ?** `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`,
   `KPAY_SECRET_KEY`, `RESEND_API_KEY`. Une clé `service_role` compromise
   donne accès à la totalité de la base, RLS ignorée.

### 2.3 Couper l'accès de l'attaquant

Du moins destructif au plus destructif.

**Suspendre un compte** — révoque son rôle sans supprimer ses données :

```sql
UPDATE public.user_roles
SET status = 'suspended', suspended_by = '<uuid-admin>', updated_at = now()
WHERE user_id = '<uuid-compromis>';
```

**Invalider toutes les sessions d'un utilisateur** — dashboard Supabase,
Authentication → Users → l'utilisateur → *Sign out user*. À faire après la
suspension, sinon le jeton en cours reste valide jusqu'à son expiration.

**Faire tourner une clé compromise** :

- `SUPABASE_SERVICE_KEY` : dashboard Supabase → Project Settings → API →
  *Reset service_role key*. **Rompt immédiatement toutes les routes serveur.**
  Reporter la nouvelle valeur dans Vercel → Settings → Environment Variables,
  puis redéployer. Compter quelques minutes d'indisponibilité, assumées.
- Clés d'IA, de paiement, d'e-mail : révoquer chez le fournisseur, remplacer
  dans Vercel, redéployer.

---

## 3. Isoler ou désactiver une fonctionnalité rapidement

Trois leviers, du plus rapide au plus lourd.

### 3.1 Bascule en base — quelques secondes, sans déploiement

`public.feature_flags` pilote la navigation et les fonctionnalités. C'est le
moyen le plus rapide de fermer une fonctionnalité compromise :

```sql
UPDATE public.feature_flags SET enabled = false WHERE id = '<identifiant>';
SELECT id, name, path, enabled FROM public.feature_flags ORDER BY id;
```

L'effet est immédiat pour tout visiteur qui recharge. **Griser, jamais
cacher** : l'interface doit montrer la fonctionnalité désactivée, pas la
faire disparaître — un bouton absent envoie l'utilisateur chercher un
contournement.

### 3.2 Fermer une porte au niveau de la base — effet immédiat, sans déploiement

Retirer un droit ferme l'accès à tous les clients à la fois, y compris ceux
qui n'utilisent pas l'application :

```sql
-- Fermer complètement une table au public
REVOKE ALL ON public.<table> FROM anon, authenticated;

-- Retirer une policy trop permissive
DROP POLICY "<nom exact>" ON public.<table>;
```

**Toute correction faite ainsi doit être immédiatement reportée dans un
fichier de migration commité sous `supabase/migrations/`.** L'absence de
migration a déjà produit un incident de sécurité non tracé le 18/08/2026 :
la base et le dépôt divergent, et personne ne sait plus quel est l'état
réel. Vérifier ensuite que la version figure bien dans le suivi :

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 10;
```

### 3.3 Revenir à un déploiement antérieur — deux minutes

Si l'incident vient d'un déploiement :

```bash
npx vercel ls                    # repérer le dernier déploiement sain
npx vercel rollback <url>        # bascule le domaine dessus
```

Le retour arrière ne touche pas la base. Si la migration fautive a déjà été
appliquée, le code ancien tournera contre un schéma nouveau — vérifier la
compatibilité avant de basculer.

---

## 4. Restaurer depuis les sauvegardes

Le dispositif existe et tourne : `.github/workflows/backup.yml`, tous les
jours à 5 h UTC, base et Storage, chiffré par clé publique, déposé sur Google
Drive, environ 30 sauvegardes conservées. La procédure de référence est dans
`docs/sauvegarde-restauration.md`.

### 4.0 Règle absolue

**Ne jamais restaurer directement en `public`.** Toujours : schéma isolé,
puis comparaison manuelle avec l'état réel, puis application sélective de ce
qui doit l'être. C'est exactement ce qu'a fait le test du 06/08/2026 —
restauration dans `backup_restore_test_full`, intégrité vérifiée ligne par
ligne, schéma supprimé ensuite, aucune donnée réelle touchée.

Trois raisons rendent la restauration directe dangereuse :

1. **Elle n'efface rien.** La restauration procède par
   `INSERT ... ON CONFLICT DO NOTHING`. Elle **complète** les tables, elle ne
   les remplace pas. Les lignes écrites par un attaquant depuis la
   sauvegarde survivent intégralement. Restaurer ne « remet » donc pas la
   base dans son état d'avant : ça superpose l'ancien au nouveau.
2. **Elle peut ressusciter ce qu'on venait de fermer.** Une ligne supprimée
   pendant l'incident — compte suspendu, document retiré — réapparaît si
   elle figurait dans la sauvegarde.
3. **La sauvegarde elle-même peut être compromise.** Si l'intrusion date de
   plusieurs jours, les sauvegardes récentes contiennent déjà les
   modifications de l'attaquant. Le schéma isolé est le seul endroit où on
   peut le constater avant de s'appuyer dessus.

### 4.1 Prérequis, à vérifier AVANT d'en avoir besoin

La clé privée de déchiffrement n'est pas dans le dépôt, pas dans les secrets
GitHub, et n'existe dans aucune variable d'environnement — c'est délibéré,
elle ne doit jamais toucher la CI. Elle se passe en argument de ligne de
commande, uniquement à la restauration.

Nom exact du fichier à retrouver :

```
facilite-backup-PRIVATE-key-GARDER-EN-LIEU-SUR.pem
```

Emplacement d'origine : le dossier `Downloads` de la machine de travail, avec
consigne de la déplacer vers un coffre — gestionnaire de mots de passe
acceptant les fichiers, clé USB chiffrée — puis de supprimer l'original. Au
29/08/2026 elle n'est plus dans `Downloads` ni ailleurs sous le profil
utilisateur : la consigne a bien été suivie, mais **sa présence effective
dans un coffre reste à confirmer par son détenteur**.

`BACKUP_PUBLIC_KEY_PEM`, le secret GitHub Actions, est la moitié **publique**
de la paire. Il ne permet que de chiffrer. Sans la clé privée, aucune
sauvegarde existante n'est récupérable et il n'existe aucun moyen de la
régénérer — la seule issue serait de produire une nouvelle paire, remplacer
le secret, et considérer l'historique comme perdu.

Vérifier aussi que les exécutions récentes du workflow « Sauvegarde
chiffrée » sont vertes dans l'onglet Actions. Un dispositif rouge depuis des
semaines n'est pas un filet.

### 4.2 Restaurer dans un schéma isolé

```bash
# 1. Lister, puis récupérer la sauvegarde qui PRÉCÈDE l'incident
GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
GOOGLE_DRIVE_FOLDER_ID="<id du dossier>" \
node scripts/backup/download-from-drive.js --list

GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
GOOGLE_DRIVE_FOLDER_ID="<id du dossier>" \
node scripts/backup/download-from-drive.js --latest --out=backup.enc

# 2. Restaurer dans un schéma isolé.
#    JAMAIS --schema=public a ce stade, et pas de --restore-storage :
#    sans ce drapeau, la partie Storage tourne a blanc.
SUPABASE_DATABASE_URL="<connection string>" \
node scripts/backup/restore-database.js backup.enc \
  --private-key=<chemin vers la cle privee> \
  --schema=incident_20260829
```

Si la clé est mauvaise, l'échec est propre (`oaep decoding error`) et rien
n'est déchiffré partiellement — comportement vérifié au test du 06/08.

### 4.3 Comparer avant de toucher à quoi que ce soit

Le schéma isolé donne l'état d'avant. `public` donne l'état actuel. La
différence est l'incident.

```sql
-- Volumétrie table par table : un écart brutal signale où regarder
SELECT 'candidatures' AS t,
       (SELECT count(*) FROM incident_20260829.candidatures) AS avant,
       (SELECT count(*) FROM public.candidatures) AS maintenant
UNION ALL SELECT 'resumes',
       (SELECT count(*) FROM incident_20260829.resumes),
       (SELECT count(*) FROM public.resumes)
UNION ALL SELECT 'transactions',
       (SELECT count(*) FROM incident_20260829.transactions),
       (SELECT count(*) FROM public.transactions)
UNION ALL SELECT 'document_deliveries',
       (SELECT count(*) FROM incident_20260829.document_deliveries),
       (SELECT count(*) FROM public.document_deliveries)
UNION ALL SELECT 'user_roles',
       (SELECT count(*) FROM incident_20260829.user_roles),
       (SELECT count(*) FROM public.user_roles);

-- Les lignes apparues depuis la sauvegarde, table par table
SELECT * FROM public.resumes
WHERE id NOT IN (SELECT id FROM incident_20260829.resumes);
```

Ne réinjecter ensuite **que** les lignes manquantes identifiées, une table à
la fois, jamais par restauration globale.

### 4.4 Nettoyage manuel des écritures suspectes

Ordre de priorité, du plus sensible au moins sensible. Toujours un `SELECT`
d'abord ; un `DELETE` seulement après avoir lu ce qui sortirait.

**1. `user_roles` — d'abord, toujours.** Une élévation de privilège rend
tout le reste possible. Un rôle `admin` non prévu est le point de départ,
pas un détail.

```sql
SELECT ur.user_id, ur.role, ur.status, ur.updated_at, u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
  AND ur.user_id NOT IN (
    SELECT user_id FROM incident_20260829.user_roles WHERE role = 'admin'
  );
```

Suspendre plutôt que supprimer (`status = 'suspended'`) : la ligne reste
comme trace de l'incident.

**2. `document_deliveries` — dépôts de fichiers chez des candidats.** Une
livraison permet à un administrateur de déposer un document dans l'espace
d'un candidat. Détournée, elle sert à distribuer un fichier piégé sous
l'identité de Facilité.

```sql
SELECT id, admin_id, candidate_id, title, file_path, status, created_at
FROM public.document_deliveries
WHERE created_at > '<horodatage de la sauvegarde>'
ORDER BY created_at DESC;
```

Supprimer la ligne ne retire pas le fichier : il faut aussi effacer l'objet
Storage désigné par `file_path`, et le CV éventuellement créé, dont
l'identifiant est dans `created_resume_id`.

**3. `resumes` — documents des candidats.** Vérifier autant les insertions
que les **suppressions** : un document présent dans le schéma isolé mais
absent de `public` est une destruction, pas un ajout.

```sql
-- Ajoutés depuis la sauvegarde
SELECT id, user_id, title, file_url, created_at FROM public.resumes
WHERE created_at > '<horodatage>' ORDER BY created_at DESC;

-- Disparus depuis la sauvegarde
SELECT id, user_id, title FROM incident_20260829.resumes
WHERE id NOT IN (SELECT id FROM public.resumes);
```

**4. `transactions` et `orders` — traces financières.** Ne jamais supprimer
une transaction, même manifestement frauduleuse : c'est une pièce comptable
et une preuve. Marquer, ne pas effacer.

```sql
SELECT id, user_id, amount, payment_status, payment_reference, created_at
FROM public.transactions
WHERE created_at > '<horodatage>' ORDER BY created_at DESC;
```

**5. `candidatures` — volume et cohérence.** Le signe d'un abus automatisé
est une rafale : beaucoup de candidatures en peu de temps, souvent depuis
peu de comptes.

```sql
SELECT user_id, count(*) AS n, min(created_at), max(created_at)
FROM public.candidatures
WHERE created_at > '<horodatage>'
GROUP BY user_id HAVING count(*) > 20 ORDER BY n DESC;
```

Le déclencheur `trg_candidature_unique_par_offre` interdit déjà les doublons
sur une même offre : une rafale légitime reste donc possible, seul le rythme
la distingue d'un robot.

**6. `profiles` et Storage.** Vérifier les `avatar_url` et `cover_url`
modifiés, et les objets déposés dans le bucket `resumes` hors du dossier de
leur propriétaire :

```sql
SELECT name, owner, created_at FROM storage.objects
WHERE bucket_id = 'resumes'
  AND created_at > '<horodatage>'
  AND (storage.foldername(name))[1] IS DISTINCT FROM owner::text;
```

Une fois le nettoyage terminé, supprimer le schéma de travail :

```sql
DROP SCHEMA incident_20260829 CASCADE;
```

---

## 5. Après l'incident

1. **Écrire un fichier `docs/incident-AAAA-MM-JJ.md`** — ce qui s'est passé,
   comment on l'a su, ce qui a été fait, ce qui a manqué. Le dépôt en compte
   déjà (`incident-2026-08-06.md`) : ils servent de mémoire.
2. **Ajouter un invariant** si la faille appartient à une classe que
   `tests/security/invariants.spec.js` aurait pu détecter. C'est la seule
   défense contre la réapparition du même défaut sous une autre forme.
3. **Vérifier que la correction est dans une migration commitée**, pas
   seulement appliquée à chaud.
4. **Relancer la chaîne complète** avant de considérer l'incident clos :

```bash
npx playwright test tests/security/invariants.spec.js   # les 13 invariants
npm run build                                            # prebuild + build réel
```

Les deux, pas l'un ou l'autre : les invariants Playwright et
`scripts/check-invariants.mjs` (lancé par le `prebuild`) ne vérifient pas les
mêmes choses, et ESLint ne vérifie ni la résolution des modules ni les règles
d'architecture.

---

## 6. Ce qui manque encore, à savoir avant d'en avoir besoin

Ces points sont ouverts au 29/08/2026. Ils ne bloquent pas l'application au
quotidien, mais ils pèseront le jour d'un incident.

- **Aucun support prioritaire** chez Vercel ni Supabase (plans Hobby et
  gratuit). Toute réponse dépend de nous seuls.
- **Pas de page publique de suppression de compte** — exigée par Google Play,
  et utile pour répondre vite à une demande d'effacement.
- **La politique de confidentialité ne nomme aucun sous-traitant**, alors que
  onze services reçoivent des données. En cas de notification d'incident, il
  faudra pouvoir dire précisément qui détenait quoi.
