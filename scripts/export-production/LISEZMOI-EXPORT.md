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
- Node 22, `tar` (Windows 10+), `.env.local` à la racine (clé de service lue localement pour télécharger les fichiers ; jamais affichée).
- **pg_dump et pg_restore en version 17** (la base est en PostgreSQL 17.6). Installés sur ce PC dans `C:\Users\gta\Outils\postgresql-17\bin` (archive officielle EnterpriseDB, outils en ligne de commande seulement, sans serveur) ; la variable utilisateur `EXPORT_PG_BIN` pointe dessus, le script la trouve seul.

## Essai à blanc (aucune connexion, aucun secret)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -EssaiABlanc
```
Vérifie les outils, le dossier de sortie hors dépôt, la place disque et le chiffrement aller-retour. Ne se connecte à rien.

## Lancer l'export
1. Dans le tableau de bord Supabase : bouton **Connect**, adresse **Session pooler** (port 5432). Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base, puis **copiez** l'adresse complète (presse-papiers).
2. Lancez :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1
```
Le script lit l'adresse dans le presse-papiers **sans l'afficher** et le vide aussitôt (le mot de passe n'y reste pas). Il refuse une adresse qui contient encore `[YOUR-PASSWORD]` ou qui est celle du Transaction pooler (port 6543). Si le presse-papiers ne contient pas d'adresse, il la demande en saisie masquée. `-DepuisEnvLocal` lit à la place `SUPABASE_DATABASE_URL` de `.env.local`.
3. Il demande ensuite une phrase secrète (12 caractères minimum), tapée deux fois, masquée. **Notez-la à part** : sans elle, l'archive est irrécupérable.

Il refuse de chiffrer si la vérification trouve un écart (lignes, fichiers, structure). Il relit l'archive chiffrée avant de supprimer le dossier en clair (`-GarderEnClair` pour le conserver).

## Déchiffrer
```powershell
$env:EXPORT_PASSPHRASE = Read-Host "Phrase secrete"
node scripts\export-production\chiffrement.mjs dechiffrer facilite-export-AAAAMMJJ-HHMM.tar.enc sortie.tar
tar -xf sortie.tar -C .\dossier-restaure
```
