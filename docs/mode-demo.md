# Mode démo — présentations investisseurs

## Ce que c'est

Un compte recruteur fictif, badgé `verified_recruiter`, avec un tableau de
bord vivant (offres à plusieurs stades de modération, dizaines de
candidatures réparties dans tout l'entonnoir, historique sur 30 jours) —
pour présenter une plateforme qui a l'air utilisée, sans jamais toucher une
donnée réelle ni exposer quoi que ce soit sur le site public.

## Identifiants

| | |
|---|---|
| Email | `demo.investisseur@facilite-demo.local` |
| Mot de passe | `CompteDemoNonUtilisable2026!` |
| Entreprise (vitrine) | Alpha Digital Sénégal |

Compte non fonctionnel en dehors de la démo (email `.local`, jamais un vrai
domaine) — même motif que les comptes `e2e-test-*` déjà utilisés pour les
tests automatisés.

## Générer / régénérer le jeu de données

```bash
npx supabase db query --linked --yes -f supabase/scripts/generate-demo-data.sql
```

Rejouable : supprime puis recrée tout ce qui appartient au compte démo à
chaque exécution, avec des dates relatives fraîches ("il y a 3 jours",
"il y a 27 jours"…) — à relancer avant chaque présentation pour que
l'historique du graphique de 30 jours reste crédible.

## Contenu généré

- **8 offres**, à 3 stades de modération différents : 5 approuvées (actives,
  avec des `view_count` variés), 2 en attente de modération, 1 rejetée —
  pour montrer que la file de modération admin fonctionne réellement, pas
  seulement le cas heureux.
- **10 candidats fictifs** dédiés (distincts des 3 déjà utilisés pour la
  démo CVthèque, `test-fictif-1/2/3`), avec noms, intitulés de poste et
  villes réalistes.
- **~38 candidatures**, réparties sur les 5 offres approuvées, avec une
  forme d'entonnoir réaliste (beaucoup en attente, de moins en moins à
  mesure qu'on avance vers "Retenu") : `pending` → `reviewed` → `contacted`
  → `interview_scheduled` → `accepted`/`rejected`, chacune avec un
  `status_changed_at`/`first_response_at` cohérent avec sa date de
  candidature (jamais dans le futur).
- Coordonnées révélées (`contact_revealed`) pour les candidatures avancées
  dans l'entonnoir (contactées, entretien, retenues), masquées pour le
  reste — même mécanique que pour un vrai recruteur.

## Limites connues (à dire si on te le demande en démo)

- Les CV référencés (`demo/cv-fictif-N.pdf`) n'existent pas réellement dans
  Storage — le bouton "Télécharger le CV" échouera si cliqué. Aucun fichier
  n'a été généré, volontairement, pour ne pas alourdir le script.
- Les candidats fictifs n'ont pas de compte utilisable (mot de passe non
  communiqué au-delà de ce document) — impossible de se connecter "en tant
  que candidat" pour montrer l'autre côté du parcours avec ces profils.

## Garanties d'isolation (testées, pas juste documentées)

`tests/e2e/demo-mode-isolation.spec.js` prouve, contre l'API réelle :

1. Aucune offre démo n'est lisible via une lecture publique anonyme, même
   approuvée et active — la policy `"Anyone can view active job offers"`
   exclut désormais explicitement `is_test_account = true`
   (`20260803130000_job_offers_is_test_account.sql`). Rien n'apparaît sur
   `/offres`, la page d'accueil, ou le sitemap.
2. Aucune offre démo n'est lisible par un compte authentifié réel autre que
   le recruteur démo lui-même (ownership RLS, indépendant du point 1).
3. Le compte démo voit bien ses propres offres et candidatures (le gate
   badge de l'Étape D + l'isolation démo de l'Étape E ne se neutralisent
   pas mutuellement).
4. Les 10 candidats fictifs du funnel démo n'apparaissent jamais dans une
   recherche CVthèque d'un **vrai** recruteur vérifié (badge accordé
   temporairement à un compte de test non-démo pour le prouver) —
   `get_candidats_recherche()` exclut déjà tout `is_test_account=true` pour
   un appelant qui ne l'est pas lui-même (`20260802120000`), revérifié ici
   spécifiquement pour ces 10 nouveaux profils.

## Fichiers concernés

- `supabase/scripts/generate-demo-data.sql` — génération/régénération.
- `supabase/migrations/20260803130000_job_offers_is_test_account.sql` —
  colonne + policy publique.
- `tests/e2e/demo-mode-isolation.spec.js` — preuves d'isolation.
