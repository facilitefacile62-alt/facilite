# Sauvegarde chiffrée et restauration (4D, incident du 2026-08-06)

Contexte complet : `docs/incident-2026-08-06.md`. "Une sauvegarde jamais
restaurée n'est pas une sauvegarde" — la procédure de restauration
ci-dessous a été **réellement exécutée** contre la base de production le
2026-08-06 (données ET fichiers Storage), pas seulement rédigée. Détail des
tests dans le journal de commit correspondant.

## Principe : chiffrement séparé des identifiants cloud

- Le dépôt/GitHub Actions ne détient JAMAIS la capacité de déchiffrer ses
  propres sauvegardes. Chiffrement hybride RSA-4096 + AES-256-GCM (`crypto`
  natif de Node, pas de binaire externe) : la clé **publique** chiffre (sûre
  à mettre en secret GitHub Actions — elle ne permet que de chiffrer), la
  clé **privée** déchiffre (reste uniquement chez vous, jamais commitée,
  jamais dans un secret CI).
- Ne sauvegarde QUE les données, jamais le schéma : le schéma est déjà
  intégralement reconstructible depuis `supabase/migrations/` (garanti par
  l'Invariant 10). Restaurer = appliquer les migrations sur un projet neuf,
  puis charger les données de la sauvegarde.
- Buckets Storage sauvegardés : `resumes`, `badge-documents`,
  `completed_cvs`, `invoices`. `job-offers` volontairement exclu (bucket
  public, visuels marketing recréables).

## Votre clé privée — à faire MAINTENANT

Une paire de clés a déjà été générée pour vous et testée avec de vraies
données de production (voir plus bas). Les deux fichiers sont sur votre
machine, **hors du dépôt git** :

- `C:\Users\gta\Downloads\facilite-backup-PRIVATE-key-GARDER-EN-LIEU-SUR.pem`
- `C:\Users\gta\Downloads\facilite-backup-public-key.pem`

**À faire immédiatement** :
1. Déplacez `facilite-backup-PRIVATE-key-GARDER-EN-LIEU-SUR.pem` vers un
   stockage sûr et durable — un gestionnaire de mots de passe qui accepte
   les fichiers (1Password, Bitwarden...), une clé USB chiffrée, ou un
   coffre-fort numérique. **Si vous la perdez, aucune sauvegarde existante
   ne sera jamais récupérable — il n'existe aucun moyen de la régénérer.**
2. Une fois en lieu sûr, supprimez le fichier de `Downloads` (`Suppr`, pas
   juste déplacé — vérifiez qu'il n'existe plus à cet endroit).
3. Le fichier public (`facilite-backup-public-key.pem`) n'a pas besoin d'être
   protégé — c'est lui qui ira dans un secret GitHub Actions (étape
   suivante).

## Procédure Google Cloud — compte de service (gratuit, pas de carte requise)

1. **Créer un projet GCP** : `console.cloud.google.com` → sélecteur de
   projet en haut → "Nouveau projet" → nommez-le (ex. `facilite-backups`) →
   Créer. Aucune carte bancaire demandée pour cette partie.
2. **Activer l'API Google Drive** : dans le projet créé, menu ☰ → "API et
   services" → "Bibliothèque" → chercher "Google Drive API" → Activer.
3. **Créer le compte de service** : "API et services" → "Identifiants" →
   "Créer des identifiants" → "Compte de service" → nommez-le (ex.
   `facilite-backup-bot`) → Créer et continuer → rôle : aucun rôle IAM projet
   nécessaire (l'accès se fera via le partage du dossier Drive, pas via IAM)
   → Terminer.
4. **Générer la clé JSON** : cliquez sur le compte de service créé → onglet
   "Clés" → "Ajouter une clé" → "Créer une clé" → format **JSON** → Créer.
   Un fichier `.json` se télécharge — c'est un secret complet, à traiter
   comme un mot de passe.
5. **Notez l'email du compte de service** (visible sur la page du compte de
   service, format `facilite-backup-bot@<project-id>.iam.gserviceaccount.com`)
   — nécessaire pour l'étape suivante.

## Créer et partager le dossier Google Drive

1. Dans votre Google Drive personnel (`drive.google.com`), créez un dossier
   (ex. `Facilite Backups`).
2. Clic droit → "Partager" → collez l'email du compte de service (étape 5
   ci-dessus) → rôle **"Éditeur"** → Envoyer (l'avertissement "cet email n'a
   pas de compte Google" peut apparaître, c'est normal pour un compte de
   service — partagez quand même).
3. Ouvrez le dossier, copiez son identifiant depuis l'URL :
   `drive.google.com/drive/folders/`**`CET_IDENTIFIANT_ICI`**.

## Secrets à configurer (GitHub → Settings → Secrets and variables → Actions)

| Secret | Valeur |
|---|---|
| `BACKUP_PUBLIC_KEY_PEM` | Contenu complet de `facilite-backup-public-key.pem` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenu complet du fichier `.json` téléchargé à l'étape 4 |
| `GOOGLE_DRIVE_FOLDER_ID` | L'identifiant du dossier copié ci-dessus |
| `SUPABASE_DB_URL` | Déjà configuré (utilisé par `security-invariants`) — rien à faire |
| `NEXT_PUBLIC_SUPABASE_URL_PROD` | URL du projet Supabase (`https://ocfhzwwjvljintabxxlg.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Clé service_role (Dashboard Supabase → Project Settings → API) — nécessaire pour lire les fichiers Storage |

Une fois les 6 configurés, le workflow `.github/workflows/backup.yml` tourne
automatiquement chaque jour à 5h UTC (`workflow_dispatch` disponible pour un
essai manuel immédiat depuis l'onglet Actions).

## Restauration — procédure testée le 2026-08-06

Exécutée réellement contre la production (lecture seule côté source ;
écriture uniquement vers un schéma Postgres isolé, jamais `public`) :

```bash
# 1. Voir les sauvegardes disponibles
GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
GOOGLE_DRIVE_FOLDER_ID="<id du dossier>" \
node scripts/backup/download-from-drive.js --list

# 2. Télécharger la dernière
GOOGLE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" \
GOOGLE_DRIVE_FOLDER_ID="<id du dossier>" \
node scripts/backup/download-from-drive.js --latest --out=backup.enc

# 3. Déchiffrer et restaurer
#    --schema=public       : restauration RÉELLE (INSERT ... ON CONFLICT DO
#                             NOTHING sur les tables déjà migrées)
#    --schema=nom_de_test   : restauration dans un schéma isolé, ne touche
#                             jamais les données réelles — pour vérifier
#                             qu'une sauvegarde est saine sans rien risquer
#    --restore-storage      : sans ce drapeau, Storage tourne en essai à
#                             blanc (liste ce qui serait fait sans téléverser)
SUPABASE_DATABASE_URL="<connection string Postgres>" \
NEXT_PUBLIC_SUPABASE_URL="https://ocfhzwwjvljintabxxlg.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role>" \
node scripts/backup/restore-database.js backup.enc \
  --private-key=facilite-backup-PRIVATE-key-GARDER-EN-LIEU-SUR.pem \
  --schema=public --restore-storage
```

**Résultat du test réel (2026-08-06)** : 1317 lignes sur 19 tables + 107
fichiers Storage sauvegardés et chiffrés (≈17 Mo), restaurés dans un schéma
isolé (`backup_restore_test_full`), intégrité vérifiée ligne par ligne
(comparaison directe d'une valeur réelle vs. restaurée — identique). Test
négatif : une mauvaise clé privée échoue proprement (`oaep decoding error`),
aucune donnée partiellement déchiffrée. Schéma de test supprimé après
vérification, aucune donnée réelle modifiée.

## Migration future vers R2 ou B2

Si l'accès à une carte non-prépayée se débloque un jour : seule
`scripts/backup/upload-to-drive.js` (et son pendant
`download-from-drive.js`) change. Le dump chiffré
(`scripts/backup/dump-database.js`) reste identique — R2/B2 sont
compatibles S3, remplacer l'appel Google Drive API par le SDK `@aws-sdk/client-s3`
pointé sur l'endpoint R2/B2 est un changement isolé à ces deux fichiers, pas
au reste du pipeline. Le chiffrement (la partie qui compte le plus, comme
souligné) ne bouge pas.
