# Diagnostic — Conditions de Visibilité des Menus Recruteur & Admin

Ce document présente l'analyse des conditions actuelles de visibilité des liens "Recruteur" et "Admin" dans la barre de navigation.

---

## 1. Lien "Recruteur" (Composant `RoleNavLink.jsx`)

* **Fichier concerné** : `src/components/RoleNavLink.jsx`
* **Condition actuelle** :
  ```javascript
  Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single(),
    supabase.rpc("has_badge", {
      check_user_id: session.user.id,
      badge_name: "verified_recruiter",
    }),
  ]).then(([roleResult, badgeResult]) => {
    setRole(roleResult.data?.role || null);
    setIsVerifiedRecruiter(badgeResult.data === true);
  });
  ```
* **Analyse de la panne** :
  * La récupération du rôle dans la table `user_roles` et la vérification du badge via la fonction RPC `has_badge` sont exécutées en parallèle dans un `Promise.all`.
  * Pour un recruteur classique, **aucune ligne n'existe** dans la table `user_roles` (qui ne liste que les admins/publishers).
  * L'absence de ligne renvoie une erreur PostgREST `PGRST116`. Si cette promesse échoue ou rejette (selon l'état du réseau ou du client), tout le bloc `Promise.all` est avorté.
  * En conséquence, le bloc `.then` n'est jamais atteint, et l'état `isVerifiedRecruiter` reste figé à sa valeur par défaut (`false`), masquant le bouton Recruteur.

---

## 2. Lien "Admin" (Page `profil/page.js`)

* **Fichier concerné** : `src/app/profil/page.js`
* **Condition actuelle** :
  ```javascript
  {profileRole === "admin" && ( ... )}
  ```
* **Analyse de la panne** :
  * Le rôle `publisher` a les mêmes droits d'accès à l'espace `/admin` que le rôle `admin` dans la configuration du middleware.
  * Cependant, la page de profil conditionne l'accès uniquement à `profileRole === "admin"`. Ainsi, un compte avec le rôle `publisher` ne verra jamais le lien "Admin" dans sa barre de navigation de profil.

---

## 3. Autres liens de menu ou routes
* **État** : Le reste de la barre de navigation est sain. Aucun autre lien n'utilise l'ancien modèle `profiles.role` obsolète (confirmé par le succès du test d'invariant de sécurité Playwright).
