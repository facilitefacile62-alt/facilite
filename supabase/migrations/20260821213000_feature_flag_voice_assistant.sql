-- Migration: Ajout du feature flag feat_voice_assistant pour piloter l'Assistant Vocal / IA
INSERT INTO feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_voice_assistant',
  'branch_services',
  'Assistant Vocal & IA (Widget flottant)',
  '/assistant-vocal',
  false,
  '{"user": false, "visitor": false, "recruiter": false}'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE 
SET 
  branch_id = EXCLUDED.branch_id,
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  enabled = EXCLUDED.enabled,
  roles = EXCLUDED.roles,
  updated_at = now();
