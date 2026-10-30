# Calendrier des exports (plan gratuit de Supabase)

Au plan gratuit : **pas de sauvegarde automatique**, et **5 Go d'egress par mois** (sortie de données). Le site en consomme environ 3 Go par mois hors export. Il reste donc **environ 2 Go par mois** pour les exports : un export doit être pensé comme une dépense.

## Les deux modes

| | **Leger** (par défaut) | **Complet** |
|---|---|---|
| Contenu | Base de données seulement, comptes (`auth`) inclus | Base de données + fichiers des buckets **privés** (`resumes`, `banque-cv`, avatars, covers…) |
| Fichiers des 3 buckets publics (`job-offers`, `marketplace-photos`, `stories-media`) | non | **exclus** (déjà dans Cloudflare R2), sauf `-AvecImagesPubliques` |
| Egress estimé | **≈ 18 Mo** (≈ 0,4 % du quota) | ≈ 633 Mo la 1re fois (≈ 13 %) ; **≈ 18 Mo + les fichiers nouveaux ou modifiés** ensuite |
| Quand | **Chaque semaine** | **Une fois par mois** |

Les chiffres viennent du dernier export mesuré (29/10/2026) : base 13,4 Mo non compressée, fichiers privés 615 Mo, fichiers publics 119 Mo. Le script **recalcule l'estimation à chaque lancement** avec les tailles réelles du moment.

## Calendrier recommandé

1. **Chaque semaine (par exemple le dimanche)** : export `Leger`. Quelques dizaines de Mo au plus, aucun risque pour le quota.
2. **Une fois par mois (par exemple le 1er)** : export `Complet`. Seuls les fichiers **nouveaux ou modifiés depuis le dernier export** sont téléchargés (comparaison du nom, de la taille et de la date de modification).
3. Avant un changement risqué (migration importante, grosse purge) : un export `Leger` juste avant.

### Règle : regarder la page Usage avant et après le premier export du mois

Tableau de bord Supabase, **Settings → Usage** :
- **Avant** le premier export du mois : noter l'egress déjà consommé (« Egress » et « Cached Egress »).
- **Après** : relever à nouveau et comparer à l'estimation affichée par le script.
- Si le total du mois approche **4 Go**, ne faites **pas** d'export `Complet` ce mois-ci : gardez les exports `Leger`.
- Si l'écart avec l'estimation est grand (par exemple le double), ne lancez pas d'autre export avant d'en comprendre la cause.

## Avant chaque export : estimation et confirmation

Avant toute chose, le script :
1. demande la phrase secrète (jamais affichée ni écrite) ;
2. lit **seulement des tailles** dans la base (taille de la base, liste des fichiers des buckets concernés : environ 0,4 Mo de lecture) ;
3. affiche l'estimation d'egress ligne par ligne ;
4. demande de taper **exactement `OUI`**. Toute autre réponse annule : **rien n'est exporté**. Il n'existe aucune option pour sauter cette étape.

## Les commandes exactes

Depuis la racine du dépôt :

**Export léger (hebdomadaire)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -DepuisEnvLocal -Mode Leger
```

**Export complet, première fois (référence = votre dernier export complet)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -DepuisEnvLocal -Mode Complet -Reference C:\Users\gta\Exports-Facilite\facilite-export-20261029-2216.tar.enc
```
La référence n'est qu'**une fois** nécessaire : elle dit au script quels fichiers vous possédez déjà (il lit seulement la liste des fichiers de cette archive, en la déchiffrant avec **sa** phrase secrète). Sans elle, le premier export `Complet` retélécharge tous les fichiers privés (≈ 615 Mo).

**Export complet, les mois suivants**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -DepuisEnvLocal -Mode Complet
```

**Avec les images publiques** (rarement utile : elles sont dans R2)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1 -DepuisEnvLocal -Mode Complet -AvecImagesPubliques
```

`-Reference` et `-AvecImagesPubliques` ne s'utilisent qu'avec `-Mode Complet`. En cas d'interruption : relancer la même commande avec `-Reprendre` (le mode est repris automatiquement).

## Où est gardé « ce que j'ai déjà exporté »

Dans le dossier de sortie (`C:\Users\gta\Exports-Facilite`), le fichier **`etat-dernier-export.json.enc`** est mis à jour après chaque export `Complet` réussi (et seulement après la relecture de l'archive). Il est **toujours chiffré** avec la phrase secrète. L'ancien est gardé en `.precedent`. Il ne contient ni secret ni contenu de fichier : seulement chemins, tailles, empreintes et dates.

Si la phrase secrète change d'un export à l'autre, l'état n'est plus lisible : le script s'arrête avec un message, et vous redonnez `-Reference <dernière archive complète>`.

## Restauration : la chaîne d'archives

Un export `Complet` incrémental ne contient **que** les fichiers nouveaux ou modifiés. Pour tout restaurer, il faut **l'archive de référence initiale (le 29/10/2026) et toutes les archives `Complet` suivantes** : le manifeste de chacune indique, pour chaque fichier inchangé, l'archive qui le contient. **Ne supprimez donc aucune archive `Complet`** tant qu'une plus récente s'appuie dessus. Les exports `Leger` sont indépendants (la base seule se restaure avec une seule archive).

Pour obtenir une archive **autonome** (par exemple chaque trimestre), déplacez `etat-dernier-export.json.enc` hors du dossier de sortie puis lancez `Complet` sans `-Reference` : tous les fichiers privés sont retéléchargés (≈ 633 Mo, ≈ 13 % du quota). À ne faire que si la page Usage le permet.

## Rappels

- Un export lit la production : jamais pendant que le quota du mois est presque atteint.
- Archives et fichiers `clair-*` : en dehors du dépôt, jamais commités. Un dossier `clair-*` restant d'un export interrompu contient des données **en clair** : le supprimer dès qu'il n'est plus utile pour une reprise.
- Détails de fonctionnement et reprise : `scripts/export-production/LISEZMOI-EXPORT.md`.
