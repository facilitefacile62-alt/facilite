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
Deux façons de fournir l'adresse de connexion (jamais affichée) :

**A. Depuis `.env.local`** (si l'adresse de production y figure) :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -DepuisEnvLocal
```
Le script essaie `SUPABASE_DATABASE_URL` puis `DATABASE_URL` et dit **laquelle il utilise** (le nom seulement), avec son type et son port. Un **Transaction pooler** (port 6543, hôte `*.pooler.supabase.com`, utilisateur `postgres.<ref>`) est **converti en mémoire** en Session pooler (port 5432), même hôte, même utilisateur, même mot de passe, et le script écrit seulement « converti 6543 -> 5432 » : `.env.local` n'est jamais modifié. Tout autre cas inadapté reste refusé avec une explication.

**B. Depuis le presse-papiers** :
1. Tableau de bord Supabase : bouton **Connect**, adresse **Session pooler** (port 5432). Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base, puis **copiez** l'adresse complète.
2. Lancez `exporter.ps1` (sans option). Le script lit le presse-papiers **sans l'afficher** et le vide aussitôt. Si le presse-papiers ne contient pas d'adresse, saisie masquée.

**Garde-fou du projet (dans les deux cas)** : le script lit la **référence du projet** (le « ref », 20 caractères, pas un secret) dans l'adresse, l'affiche et la compare à celle de la production. Si elle est différente (par exemple le projet de test), il **s'arrête avant tout `pg_dump`** et avant la phrase secrète. Il vérifie aussi que l'API des fichiers (`NEXT_PUBLIC_SUPABASE_URL` de `.env.local`) est **le même projet** que la base ; `stockage.mjs` le re-vérifie. Les contrôles de lignes et de fichiers interrogent la base de la même adresse que le dump.

Le script demande ensuite une phrase secrète (12 caractères minimum), tapée deux fois, masquée. **Notez-la à part** : sans elle, l'archive est irrécupérable.

`-EssaiABlanc` accepte aussi `-DepuisEnvLocal` : il contrôle l'adresse de `.env.local` (variable, type, port, projet, conversion) **sans aucune connexion**.

Il refuse de chiffrer si la vérification trouve un écart (lignes, fichiers, structure). Il relit l'archive chiffrée avant de supprimer le dossier en clair (`-GarderEnClair` pour le conserver).

Réglages du tableau de bord à noter à la main : voir `docs/reglages-supabase-tableau-de-bord.md`.

## Déchiffrer
```powershell
$env:EXPORT_PASSPHRASE = Read-Host "Phrase secrete"
node scripts\export-production\chiffrement.mjs dechiffrer facilite-export-AAAAMMJJ-HHMM.tar.enc sortie.tar
tar -xf sortie.tar -C .\dossier-restaure
```
