# Activation du « Send SMS Hook » (Orange puis Twilio)

La route `/api/auth/send-sms-hook` reçoit de Supabase Auth, à chaque code de connexion par téléphone, le numéro et le code à 6 chiffres, et envoie le SMS elle-même.
**Tant que le hook n'est pas activé dans Supabase, elle ne reçoit rien : fusionner cette PR ne change rien pour personne.**

## Étapes d'activation (dans cet ordre, une seule à la fois, rien n'est irréversible)

1. **Variables Vercel d'abord** (Production), puis redéploiement. Voir la liste ci-dessous. Sans les variables Twilio, activer le hook ferait échouer tous les codes.
2. **Migration du journal** `supabase/migrations/20261025210000_journal_envois_sms.sql` (sur « go » explicite pour ce fichier). Sans elle, le hook fonctionne mais ne journalise pas.
3. **Hook activé avec `SMS_PROVIDER=twilio`** (valeur par défaut) : Authentication → Hooks → Send SMS, type HTTPS, adresse `https://ffacilite.com/api/auth/send-sms-hook`,
   puis copier le secret généré (il commence par `v1,whsec_`) dans `SEND_SMS_HOOK_SECRET`. Ce palier vérifie tout le trajet du hook (signature, limites, journal) **sans Orange**.
4. **Un SMS réel vers le numéro du propriétaire** (connexion par téléphone depuis l'application). Contrôler : le SMS arrive, une ligne `twilio / ok` apparaît dans `sms_envois_journal`.
5. **`SMS_PROVIDER=orange`** seulement quand les clés Orange sont validées (forfait acheté, nom d'expéditeur approuvé, si utilisé). Un nouveau SMS réel pour vérifier : ligne `orange / ok`.
6. Surveiller 48 h : lignes `echec` / `secours_apres_…` du journal, e-mails d'alerte, solde Orange.

## Retour arrière
- **Un clic :** désactiver le hook dans Supabase (Authentication → Hooks). Supabase revient à son envoi Twilio intégré (sa configuration n'a pas été touchée).
- **Sans toucher à Supabase :** remettre `SMS_PROVIDER=twilio` dans Vercel (Twilio seul, en passant par le hook).
- Le journal peut être supprimé avec `docs/rollbacks/20261025210000_journal_envois_sms.down.sql` (le hook n'en dépend pas).

## Variables Vercel (noms seulement)
| Variable | Rôle |
|---|---|
| `SEND_SMS_HOOK_SECRET` | Secret du hook (copié depuis Supabase). **Obligatoire.** |
| `SMS_PROVIDER` | `twilio` (défaut) ou `orange` (Orange d'abord, Twilio en secours). |
| `TWILIO_ACCOUNT_SID` | Identifiant du compte Twilio. **Obligatoire** (secours ou fournisseur). |
| `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` | **Clé d'API Twilio, à préférer** : révocable seule, sans exposer le compte. |
| `TWILIO_AUTH_TOKEN` | Accepté à défaut de clé d'API (à éviter dans Vercel). |
| `TWILIO_MESSAGING_SERVICE_SID` ou `TWILIO_SMS_FROM` | Expéditeur Twilio (l'un des deux). |
| `ORANGE_SMS_CLIENT_ID`, `ORANGE_SMS_CLIENT_SECRET` | Identifiants de l'application Orange Developer (ou `ORANGE_SMS_AUTHORIZATION_HEADER`). |
| `ORANGE_SMS_SENDER_NUMBER` | Facultative, `2210000` par défaut (expéditeur numérique du Sénégal). |
| `ORANGE_SMS_SENDER_NAME` | Facultative : nom d'expéditeur (11 caractères) **après** validation par Orange. |
| `SMS_ALERTE_EMAIL` | Adresse qui reçoit les alertes (échec Orange, plafonds, solde bas). |
| `SMS_SOLDE_ALERTE` | Facultative, 200 : seuil de SMS restants qui déclenche l'alerte. |
| `SMS_PLAFOND_JOUR` | Facultative, 300 : plafond global de SMS par jour. |
| `SMS_PLAFOND_TWILIO_SECOURS_JOUR` | Facultative, 20 : plafond du **secours** Twilio par jour (ne s'applique pas quand `SMS_PROVIDER=twilio`). |
| `SMS_A_BLANC` | Essais seulement (Preview / Development) : `1` = journal sans envoi. **Jamais en Production avec le hook actif.** |
| `CRON_SECRET`, `RESEND_API_KEY` | Déjà présentes (cron du solde, e-mails d'alerte). |

## Ce que le hook ne fait pas
- Pas de limite **par adresse IP** : le hook ne reçoit pas l'IP du client. Les limites propres de Supabase Auth s'appliquent avant ; ici : 3 codes/heure et 10/jour par numéro, plafond global par jour.
- Pas encore de réception des accusés de livraison d'Orange (option : adresse HTTPS déclarée à Orange, liste blanche d'IP).
