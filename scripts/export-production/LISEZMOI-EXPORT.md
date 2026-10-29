# Export complet de la production

Lecture seule sur Supabase. Résultat : une archive chiffrée **hors du dépôt**, un rapport de vérification sans donnée personnelle, une empreinte SHA-256.

## Contenu de l'archive
- `structure.sql` : structure des schémas `public`, `auth`, `storage` (tables, index, politiques RLS, fonctions, déclencheurs, droits).
- `donnees.dump` : données de ces trois schémas, **comptes inclus** (`auth.users`, identités, sessions), au format `pg_dump` personnalisé.
- `stockage/<bucket>/...` : tous les fichiers de tous les buckets, et `manifeste-stockage.json` (taille et SHA-256 de chacun).
- `metadonnees.json` : extensions, tâches planifiées (pg_cron), réglages des buckets, tables en temps réel.
- `migrations/` : copie des migrations du dépôt.

## Ce que l'export ne contient PAS (à noter à la main avant le passage à Free)
Réglages du tableau de bord Supabase : fournisseurs de connexion (Google), URL de redirection, modèles d'e-mails, SMTP, hook SMS, secrets des fonctions, clés API. Ils ne sont pas dans la base.

## Prérequis
- Node 22, `tar` (Windows 10+).
- **pg_dump et pg_restore en version 17** : la base est en PostgreSQL 17.6. Le plus simple : télécharger l'archive « binaries » Windows de PostgreSQL 17 (EnterpriseDB), la décompresser (aucune installation) et définir `EXPORT_PG_BIN` vers son dossier `bin`. Ou : `winget install PostgreSQL.PostgreSQL.17` (installe aussi le serveur, on peut le laisser éteint).
- `.env.local` à la racine (clé de service lue localement pour télécharger les fichiers ; jamais affichée).

## Lancer
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1
```
Le script demande, sans rien afficher : l'adresse de connexion à la base, puis une phrase secrète (12 caractères minimum, tapée deux fois). **Notez la phrase secrète à part** : sans elle, l'archive est irrécupérable.

Il refuse de chiffrer si la vérification trouve un écart (lignes, fichiers, structure). Il relit l'archive chiffrée avant de supprimer le dossier en clair (`-GarderEnClair` pour le conserver).

## Déchiffrer
```powershell
$env:EXPORT_PASSPHRASE = Read-Host "Phrase secrete"
node scripts\export-production\chiffrement.mjs dechiffrer facilite-export-AAAAMMJJ-HHMM.tar.enc sortie.tar
tar -xf sortie.tar -C .\dossier-restaure
```
