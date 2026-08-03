# Diagnostic — un run de tests qui semble juste "lent" peut être mort

## Le symptôme observé

Un run complet (`npx playwright test`) qui prend normalement 11-13 minutes
est resté bloqué plus de 20 minutes, sans un seul caractère de sortie,
sans erreur, sans timeout qui se déclenche. Rien ne permettait de
distinguer "c'est juste lent aujourd'hui" de "c'est mort".

## Cause racine

Les fixtures de test (`runPrivilegedSql`/`runIntrospectionSql`, utilisées
dans ~18 fichiers pour exécuter du SQL via une connexion CLI privilégiée)
utilisaient `execSync` — un appel **synchrone et bloquant**.

Si le CLI Supabase se fige côté réseau (déjà observé plusieurs fois cette
session : `"Initialising login role..."` qui ne revient jamais, sans
erreur ni timeout côté CLI), `execSync` gèle **tout le process Node**,
boucle d'événements comprise.

Le mécanisme de timeout de Playwright (`test.timeout`, `expect.timeout`)
dépend lui-même de cette même boucle d'événements pour se déclencher — un
`setTimeout` ne peut pas s'exécuter tant que la boucle est gelée par un
appel synchrone en cours. Résultat : **le timeout censé protéger contre
exactement ce cas de figure ne peut jamais se déclencher**, parce que le
mécanisme qui devrait le déclencher est lui-même bloqué.

## Comment le reconnaître la prochaine fois

- Un run qui dépasse largement sa durée habituelle **sans qu'aucune ligne
  ne s'ajoute** au log (ni au reporter `list`, ni au fichier JSON) — pas
  "il progresse lentement", littéralement plus rien ne bouge.
- `Ctrl+C`/l'arrêt du process ne produit aucune sortie utile juste avant.
- Le serveur web (`webServer`) et le CLI (`npx supabase db query ...`)
  répondent normalement quand on les teste indépendamment juste après —
  ce n'était pas un état durablement cassé, juste un gel ponctuel d'un
  appel synchrone.

## Correctif appliqué (2026-08-03)

`tests/helpers/privilegedSql.js` : un seul helper partagé, utilisé par
tous les fichiers de test, basé sur `child_process.exec` (asynchrone) avec
un `timeout` dur de 60s. Au-delà, le process CLI est tué (`SIGTERM`) et la
promesse est rejetée avec un message explicite — le test échoue
proprement avec une trace claire, au lieu de geler indéfiniment.

Tous les `execSync` du dépôt (vérifié : plus aucun dans `tests/`, `src/`,
`scripts/`, `supabase/`) ont été remplacés par ce helper partagé.

## Piège annexe rencontré en corrigeant ceci

Deux bugs de mécanique JS pendant la migration execSync → async, à
surveiller si ce pattern est réutilisé ailleurs :

1. **Précédence d'opérateur** : `await maFonction().map(...)` n'est PAS
   `(await maFonction()).map(...)` — `await` se lie à `maFonction()`
   seule, donc `.map` s'appelle sur le résultat de `maFonction()` avant
   résolution (une Promise, qui n'a pas de `.map`). Toujours parenthéser :
   `(await maFonction()).map(...)`.
2. **Hooks non-async devenus non-valides** : plusieurs `test.beforeAll(()
   => {...})`/`test.afterAll(() => {...})` contenaient un appel
   fire-and-forget à l'ancien helper synchrone — une fois converti en
   `await runPrivilegedSql(...)`, la fonction englobante doit devenir
   `async () => {...}`, sinon `await` en dehors d'une fonction async est
   une erreur de syntaxe. Facile à manquer : `node --check` sur chaque
   fichier modifié l'attrape immédiatement, à faire systématiquement après
   ce genre de refactor mécanique.
