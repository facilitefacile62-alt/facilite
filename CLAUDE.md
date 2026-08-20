@AGENTS.md

# Règles permanentes du projet Facilite

Ces règles s'appliquent à toute session travaillant sur ce dépôt, sans exception.

- **13 invariants verts à chaque étape.** Avant de considérer un point terminé, lancer `npx playwright test tests/security/invariants.spec.js` et confirmer que les 13 passent. Ne jamais commiter sur un invariant rouge causé par son propre changement.
- **Résultat brut avant toute correction.** Diagnostiquer et rapporter l'état réel (code, base, tests) avant de proposer ou d'appliquer un correctif — jamais l'inverse.
- **Commit et push après chaque point traité.** Un point = un commit. Ne pas grouper plusieurs corrections indépendantes dans un seul commit.
- **Ne jamais lancer `supabase db push` ni `supabase config push`.**
- **Toute modification en base doit passer par un fichier de migration commité** sous `supabase/migrations/`, appliqué ensuite à la production (voir `tests/helpers/privilegedSql.js`, `runIntrospectionSql`). Jamais d'exécution directe dans l'éditeur SQL du dashboard Supabase, même en urgence, même pour une correction de sécurité critique — l'absence de fichier de migration a déjà causé un incident de sécurité non tracé (18/08/2026).
- **Un seul assistant actif à la fois sur le dépôt.** Avant de démarrer un nouveau chantier (nouvelle session de chat ou Claude Code), vérifier qu'aucune autre session n'est en cours dessus.
- **Arrêt après chaque point, attendre validation** avant de passer au point suivant — sauf instruction explicite de l'utilisateur d'enchaîner sans pause.
- **Ne jamais commiter `.claude/`.**
