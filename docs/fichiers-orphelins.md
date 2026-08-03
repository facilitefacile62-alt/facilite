# Fichiers orphelins dans les buckets Storage

Un fichier orphelin = un objet Storage dont la ligne de base qui le
référençait a été supprimée, mais dont la suppression du fichier lui-même a
échoué (perte réseau, timeout, etc.). Sans nettoyage, il reste indéfiniment
dans le bucket, inatteignable par l'application, mais toujours facturé et
toujours une copie de la donnée qu'un candidat a demandé à voir supprimée.

## Détection automatique

Tout échec de suppression est journalisé dans `security_logs` (colonne
`event_type = 'storage_deletion_failed'`, `details` contient `bucket` et
`path`) via `log_own_storage_deletion_failure()` — voir
`docs/audit-securite-2026-08.md` pour la lecture de `security_logs` en
général. C'est la première chose à consulter avant de lancer le script
ci-dessous : elle donne le chemin exact du fichier concerné, immédiatement,
sans avoir à comparer tout le bucket.

## Script de détection exhaustive

À exécuter périodiquement (ou en cas de doute) depuis le **Dashboard
Supabase → SQL Editor** — trouve tout fichier du bucket `resumes` sans ligne
`resumes` correspondante, y compris ceux dont l'échec n'a jamais été
journalisé (panne avant même l'appel de log_own_storage_deletion_failure) :

```sql
SELECT o.name, o.created_at, o.metadata->>'size' AS size_bytes
FROM storage.objects o
WHERE o.bucket_id = 'resumes'
  AND NOT EXISTS (
    SELECT 1 FROM public.resumes r WHERE r.file_url = o.name
  )
ORDER BY o.created_at;
```

Même requête pour `chat-attachments` (comparé à `messages.attachment_url`) :

```sql
SELECT o.name, o.created_at, o.metadata->>'size' AS size_bytes
FROM storage.objects o
WHERE o.bucket_id = 'chat-attachments'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.attachment_url = o.name
  )
ORDER BY o.created_at;
```

## Suppression manuelle d'un fichier orphelin confirmé

Une fois un chemin confirmé orphelin (aucune ligne ne le référence dans les
deux requêtes ci-dessus), le supprimer via l'API Storage — **jamais** par
`DELETE FROM storage.objects` en SQL direct, bloqué par la plateforme
(`storage.protect_delete()`, voir le commentaire dans la migration
`20260802220000_wave2_delete_replacements.sql`) :

Dashboard Supabase → Storage → bucket concerné → sélectionner le fichier →
Supprimer. Ou via un script utilisant la clé `service_role` et
`supabase.storage.from(bucket).remove([path])`.
