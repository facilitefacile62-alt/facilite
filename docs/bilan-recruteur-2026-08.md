# Bilan de l'Espace Recruteur — État des Lieux & Vérification Fonctionnelle

Ce document dresse l'état des lieux fonctionnel de l'espace Recruteur (`/recruteur`) suite à l'analyse détaillée du code source.

---

## 1. Publier et modifier une offre d'emploi
* **Statut** : **FONCTIONNELLE**
* **Fichier** : [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L670-L710)
* **Détail technique** :
  * La publication insère une ligne dans `job_offers` associée au `recruiter_id`.
  * La modification met à jour la ligne avec `updated_at` et le nouveau contenu.
  * Dans les deux cas, le système déclenche ensuite un appel à `generateOfferEmbedding` vers l'API d'Edge Functions (`gemini-orchestrator` action `embed`) afin de peupler le champ `embedding` nécessaire pour la recherche sémantique.

---

## 2. Consulter les candidatures reçues et les CVs envoyés
* **Statut** : **FONCTIONNELLE**
* **Fichier** : [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L324-L338) et [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L1500-L1570)
* **Détail technique** :
  * Chargement sécurisé via l'appel RPC `get_recruiter_candidatures` (qui masque l'adresse email et le CV si le candidat n'a pas activé la révélation de contact `reveal_contact_to_recruiter`).
  * Les recruteurs peuvent modifier le statut d'une candidature (`pending`, `interview_scheduled`, `accepted`, `rejected`) via `handleApplicationStatusChange` qui met à jour la base.
  * Téléchargement du CV via `handleDownloadApplicationCv` qui appelle une URL signée du bucket Storage Supabase.

---

## 3. Le fil de CV avec son quota
* **Statut** : **PARTIELLE**
* **Fichier** : [candidats-recherche/route.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/api/recruteur/candidats-recherche/route.js) et [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L247)
* **Détail technique** :
  * L'annuaire des candidats est entièrement fonctionnel, paginé par tranches de 30 et chargé via l'appel API `/api/recruteur/candidats-recherche` (qui exécute la fonction SQL `get_candidats_recherche`).
  * Cependant, **aucun quota de crédits recruteur n'est implémenté** dans l'application (seuls les candidats ont un quota d'appels à l'IA de 40 requêtes/jour dans `aiQuota.js`).
  * La seule limite en place pour le recruteur est un rate limiter générique de 20 requêtes par minute géré par `checkRateLimit` dans l'API de recherche.

---

## 4. Entretiens avec visio Daily.co
* **Statut** : **FONCTIONNELLE**
* **Fichier** : [VideoInterviewModal.jsx](file:///c:/Users/gta/Downloads/monprojetfacilite/src/components/VideoInterviewModal.jsx) et [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L2025-L2029)
* **Détail technique** :
  * La visioconférence est intégrée à 100%. Le bouton "Démarrer" sur une candidature appelle l'API `/api/interviews/create-room` pour obtenir un identifiant de salle Daily.co.
  * L'iframe Prebuilt de Daily.co est alors instanciée dans le composant `VideoInterviewModal` en récupérant un token sécurisé via l'API `/api/interviews/[id]/join`.
  * La libération des ressources (micro et caméra) est bien assurée lors de la fermeture de la modale grâce à `DailyIframe.leave()` et `.destroy()`.

---

## 5. Messagerie avec les candidats
* **Statut** : **FONCTIONNELLE**
* **Fichier** : [page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/recruteur/page.js#L809-L826) et [MessagerieClient.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/messagerie/MessagerieClient.js)
* **Détail technique** :
  * Depuis la CVthèque, un recruteur peut cliquer sur "Contacter le candidat" qui envoie un message d'accroche prédéfini via la table `messages` et redirige le recruteur sur `/messagerie`.
  * La messagerie en temps réel prend alors le relais, en identifiant le rôle recruteur via son badge `verified_recruiter` pour structurer le fil de discussion.
