# Déclaration Data Safety — Google Play

Document de travail à recopier dans **Play Console → Règles → Sécurité des données**.

Chaque ligne a été établie en relevant le code et la base réels, pas les intentions.
Les sources sont citées pour qu'un relecteur puisse vérifier sans faire confiance.

> **Règle de maintenance.** Cette déclaration et la liste des sous-traitants de
> `src/app/confidentialite/page.js` doivent dire la même chose. Une divergence
> entre les deux est un motif de rejet à elle seule. À reprendre **à chaque
> ajout d'un service tiers, ET à chaque fonctionnalité qui collecte** — deux
> rappels : l'oubli d'OpenStreetMap le 30/08/2026, corrigé le 01/09 ; et la
> Marketplace, ouverte le 01/09, qui a rendu fausse la mention « position
> traitée de façon éphémère » sans qu'aucun service tiers ne soit ajouté.
> Corrigée le 02/09.

---

## 1. Sécurité des données (trois questions d'ouverture)

| Question du formulaire | Réponse | Justification |
|---|---|---|
| L'application collecte-t-elle ou partage-t-elle des données utilisateur ? | **Oui** | Compte, profil, CV, messages. |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** | HTTPS imposé partout ; en-tête HSTS et CSP dans `next.config.mjs`. Aucun point d'entrée en clair. |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** | Page publique `/suppression-compte`, plus la suppression depuis le compte. Purge effective par `src/app/api/cron/purge-deleted-accounts/route.js`. |

**URL de la politique de confidentialité à déclarer :** `https://ffacilite.com/confidentialite`
(`/politique-de-confidentialite` réexporte la même page ; ne déclarer qu'une seule des deux.)

---

## 2. Note sur la colonne « Partagées »

Google exclut explicitement de la notion de *partage* les transferts vers un
**prestataire qui traite les données pour le compte de l'éditeur**. Tous nos
tiers entrent dans ce cadre : Supabase (hébergement), Vercel (exécution),
Cloudflare R2 (stockage), Resend (e-mails), Google Gemini (traitement IA à la
demande), Microsoft Clarity et Plausible (mesure d'audience), Sentry (erreurs),
Daily.co (transport des flux d'entretien).

C'est pourquoi la colonne « Partagées » est à **Non** partout. Ce choix est
défendable mais il est nôtre : si Google le conteste, l'argument à donner est
celui ci-dessus, et il faudra alors basculer en « Oui » les lignes concernées —
pas retirer les tiers de la politique.

**Les coordonnées bancaires ne sont jamais collectées.** Le paiement se fait par
redirection vers la page de KPay ou PayDunya (`gatewayUrl`,
`src/app/api/pay/checkout/route.js:141`). Aucun numéro de carte ni identifiant
de paiement ne transite par Facilité. La ligne « Informations de paiement » du
formulaire reste donc **non cochée**.

---

## 3. Types de données à déclarer

Légende : **O** = optionnel (la personne peut utiliser l'application sans),
**R** = requis.

### Informations personnelles

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Nom | Oui | R | Fonctionnalité, Gestion du compte | `profiles.full_name` |
| Adresse e-mail | Oui | R | Fonctionnalité, Gestion du compte | `profiles.email`, `auth.users` |
| Identifiants utilisateur | Oui | R | Fonctionnalité, Gestion du compte | `profiles.id` |
| Numéro de téléphone | Oui | O | Fonctionnalité | `profiles.phone` ; `marketplace_stores.telephone_whatsapp`, **publié** sur les fiches d'articles pour permettre le contact |
| Adresse | Oui | O | Fonctionnalité | `profiles.city`, `country`, `quartier`, `location` — **saisies par la personne**, jamais déduites de l'appareil |
| Autres informations | Oui | O | Fonctionnalité | `profiles.date_naissance`, `gender`, `bio`, `headline`, `languages`, `skills`, `interests`, `website_url`, `education_level` |

> `date_naissance` et `gender` n'ont pas de case dédiée dans le formulaire :
> ils vont dans « Autres informations ». Ne pas les omettre.

### Informations financières

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Historique d'achat | Oui | O | Fonctionnalité | `transactions`, commandes de CV |
| Informations de paiement | **Non** | — | — | Saisies chez KPay / PayDunya, jamais reçues |

### Position

| Type Play | Collectée | Éphémère | O/R | Finalités | Source |
|---|---|---|---|---|---|
| Position précise | Oui | **Oui** pour l'acheteur, **Non** pour le vendeur | O | Fonctionnalité | Géolocalisation du navigateur : itinéraire de transport et recherche de boutiques proches (`MessagerieClient`, `MarketplaceClient`, outil `chercher_itineraire`) ; position de boutique enregistrée dans `marketplace_stores` |

> **Attention à la case « traitée de façon éphémère ».** Elle ne couvre PAS
> tous les usages depuis l'ouverture de la Marketplace (01/09/2026). Deux cas
> distincts, à déclarer comme un seul type mais à savoir expliquer :
>
> * **Acheteur** — la position sert à trier les résultats par distance puis
>   est oubliée. Rien n'est écrit. Éphémère au sens de Google.
> * **Vendeur** — la position de sa boutique est **enregistrée durablement**
>   (`marketplace_stores.latitude/longitude`) et **rendue publique** : c'est
>   ce qui permet aux acheteurs de la trouver. Ce n'est pas éphémère.
>
> Google n'offrant qu'une case par type de données, cocher « éphémère » serait
> inexact. **Laisser la case décochée** et s'appuyer sur la politique, qui
> distingue explicitement les deux depuis le 02/09/2026.

Quatre précisions à retenir, car elles peuvent être contrôlées :

- Côté **itinéraire**, la position n'est pas conservée. Elle sert à trouver
  l'arrêt le plus proche puis à placer le repère « Vous êtes ici » pendant la
  conversation, et elle est retirée avant l'enregistrement du message
  (`payloadSansPosition`, migration `20260901120000`).
- Côté **boutique**, elle l'est — voir l'encadré ci-dessus. La personne la
  saisit elle-même, en connaissance de cause, pour être trouvée.
- Elle **n'est jamais transmise au modèle d'IA**. Les coordonnées envoyées à
  Gemini sont celles qu'il a lui-même produites ; le serveur les remplace par
  les vraies au moment d'exécuter l'outil, après l'appel au modèle.
- Le fond de carte vient d'**OpenStreetMap**, chargé par le navigateur. La zone
  affichée et l'adresse IP lui parviennent, comme pour n'importe quel serveur
  d'images. Les coordonnées GPS, elles, ne lui sont pas envoyées.

### Messages

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Autres messages dans l'application | Oui | O | Fonctionnalité | `messages`, `assistant_messages`, `contact_messages` |

Le contenu des échanges avec l'assistant est transmis à Google Gemini pour
produire la réponse. À dire tel quel si Google pose la question.

### Photos et vidéos

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Photos | Oui | O | Fonctionnalité | Buckets `avatars`, `covers`, `chat-attachments`, `badge-documents`, `marketplace-photos` |
| Vidéos | Oui | O | Fonctionnalité | Pièces jointes de conversation |

`badge-documents` contient des **pièces d'identité**, lues par Gemini pour la
vérification (annoncé dans la politique). Elles restent dans un bucket privé.
Les entretiens vidéo passent par Daily.co **sans enregistrement** : la salle est
créée avec une simple date d'expiration, aucune option d'enregistrement
(`src/app/api/interviews/create-room/route.js`). Rien n'est donc à déclarer au
titre d'un stockage de vidéo d'entretien.

### Fichiers audio

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Enregistrements vocaux | Oui | O | Fonctionnalité | Messages vocaux, bucket `chat-attachments` |

### Fichiers et documents

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Fichiers et documents | Oui | O | Fonctionnalité | Buckets `resumes`, `completed_cvs`, `invoices` — CV importés et générés |

Le contenu des CV est analysé par Gemini (et, en secours, Groq ou DeepSeek).

### Activité dans l'application

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Interactions dans l'application | Oui | O | Analyses | Microsoft Clarity — **rejoue les sessions** : clics, défilement, parcours (`src/app/layout.js`) ; Plausible pour la fréquentation |
| Autres contenus générés | Oui | O | Fonctionnalité | Publications, commentaires, profil public, annonces Marketplace (titre, description, prix, stock) |

Clarity enregistre le parcours de navigation. Le minimiser serait un motif de
rejet ; la politique le dit déjà explicitement.

### Informations et performances de l'application

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Journaux de plantage | Oui | O | Fonctionnalité | Sentry (`src/instrumentation.js`, `src/sentry.server.config.js`) |
| Diagnostics | Oui | O | Fonctionnalité | Sentry, journaux Vercel |

### Identifiants d'appareil ou autres

| Type Play | Collectée | O/R | Finalités | Source |
|---|---|---|---|---|
| Identifiants d'appareil ou autres | Oui | O | Analyses | Identifiant de session déposé par Clarity |

---

## 4. Ce qui n'est PAS collecté — à laisser décoché

Répertorié pour qu'une relecture ultérieure ne se demande pas si l'omission est
un oubli :

- Origine ethnique, opinions politiques ou religieuses, orientation sexuelle
- Informations de santé
- Contacts, agenda, SMS, appels, applications installées
- Historique de navigation web, historique de recherche hors application
- Coordonnées bancaires (voir §2)
- Publicité et ciblage : **aucun**. Aucun cookie publicitaire, aucun partage à
  des fins marketing.

---

## 5. Avant de soumettre

1. Vérifier que la liste de `src/app/confidentialite/page.js` et le §3 ci-dessus
   citent exactement les mêmes tiers.
2. Vérifier que `https://ffacilite.com/confidentialite` répond en 200 sans
   connexion — le proxy la déclare publique (`src/proxy.js`).
3. Vérifier que `https://ffacilite.com/suppression-compte` répond en 200 sans
   connexion : Google teste ce lien.
4. Ne déclarer qu'**une** URL de politique de confidentialité.
