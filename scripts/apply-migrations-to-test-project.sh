#!/bin/bash
# Rejoue toutes les migrations de supabase/migrations/ contre un projet
# Supabase de TEST, jamais la production. Utilise --db-url (jamais
# `supabase link`/`db push`) pour ne jamais toucher au projet "actif" de la
# CLI, qui reste pointé sur la production tout au long de ce dépôt.
#
# Usage : TEST_SUPABASE_DB_URL="postgresql://..." ./scripts/apply-migrations-to-test-project.sh
# ou, si .env.test.local existe, il est chargé automatiquement.
#
# S'arrête à la première migration en échec (pas de contournement) — le nom
# du fichier et l'erreur brute de la CLI sont affichés tels quels.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env.test.local ] && [ -z "${TEST_SUPABASE_DB_URL:-}" ]; then
  TEST_SUPABASE_DB_URL="$(grep -E '^TEST_SUPABASE_DB_URL=' .env.test.local | cut -d= -f2-)"
fi

if [ -z "${TEST_SUPABASE_DB_URL:-}" ]; then
  echo "ERREUR : TEST_SUPABASE_DB_URL absente (ni variable d'environnement, ni .env.test.local)." >&2
  exit 1
fi

# Garde-fou : ce script ne doit jamais pouvoir toucher la production, même
# si TEST_SUPABASE_DB_URL est mal renseignée par erreur.
if [[ "$TEST_SUPABASE_DB_URL" == *"ocfhzwwjvljintabxxlg"* ]]; then
  echo "REFUS : TEST_SUPABASE_DB_URL pointe vers le projet de production. Arrêt immédiat." >&2
  exit 1
fi

MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
count=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  count=$((count + 1))
  name="$(basename "$f")"
  echo "[$count] $name"
  if ! npx supabase db query --db-url "$TEST_SUPABASE_DB_URL" -f "$f" --yes; then
    echo ""
    echo "ÉCHEC sur la migration : $name" >&2
    echo "Arrêt — aucune migration suivante n'est appliquée." >&2
    exit 1
  fi
done

echo ""
echo "Terminé : $count migration(s) appliquée(s) avec succès."
