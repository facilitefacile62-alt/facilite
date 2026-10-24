import {
  controlerBasicCallback,
  evaluerConfirmationOrange,
  hasherJetonCallback,
  jetonCallbackValide,
  rechercherTransactionOrange,
  secretCallbackGlobalValide,
} from "./orangeMoney.js";

// Réponses HTTP et alertes : sans dépendance au serveur Next (testable sous Node) ; la base et l'alerte réelles sont chargées à la demande.
const reponse = (statut, corps) =>
  corps === undefined ? new Response(null, { status: statut }) : new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });
async function alerteReelle(...args) {
  try {
    const { captureCriticalPaymentError: alerte } = await import("@/lib/sentryAlert");
    alerte(...args);
  } catch {
    console.error("[Webhook Orange] alerte :", ...args);
  }
}

// Traitement commun des notifications Orange Money « Paiement Marchand » (achat de jetons, formation CV), d'après la documentation
// officielle (API v1.1.0, chapitre Callbacks) :
//  - livraison « au moins une fois », éventuellement en double ou dans le désordre → déduplication par une clé d'idempotence ;
//  - un 2xx marque la notification livrée (202 au corps VIDE recommandé) ; un 4xx est un REFUS DÉFINITIF, sans nouvel essai ;
//    un 5xx ou un délai dépassé déclenche de nouveaux essais avec attente croissante. Règle appliquée ici : 4xx seulement pour un rejet
//    définitif (corps illisible, commande inconnue, jeton invalide), 5xx pour TOUT problème passager (base ou API Orange indisponible,
//    statut pas encore final alors que la notification annonce un succès).
//
// Une notification n'est jamais un crédit : c'est un DÉCLENCHEUR. L'état réel du paiement est confirmé auprès d'Orange (recherche de
// transactions + API de statut, jeton OAuth) ; sans cette confirmation, rien n'est crédité. X-Sonatel-Signature n'est PAS vérifiée :
// l'algorithme et le secret ne sont pas documentés (on ne les invente pas) ; l'en-tête est seulement noté dans les journaux.
//
// `adaptateur` décrit la commande concernée :
//   nom, tableJournal, trouverCommande(admin, reference) → { commande, erreur }, empreinteJeton(commande),
//   montantXof(commande), appliquer(admin, commande, confirmation, orangeTransactionId) → { resultat }, champsJournal(commande).

const REFERENCE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Attentes entre les essais de confirmation quand la transaction annoncée n'est pas encore listée par la recherche (3 essais au total).
const DELAIS_REESSAI_MS = [1500, 3000];
const accepte = () => reponse(202);
const refusDefinitif = (statut, message) => reponse(statut, { error: message });
const problemePassager = (statut = 503) => reponse(statut, { error: "Indisponible, réessayez." });

// Le journal des événements sert de mécanisme d'idempotence (clé UNIQUE) : il est écrit AVANT le traitement. Si le traitement échoue
// (5xx), Orange relance avec la même clé : l'événement est retiré du journal pour que la relance ne soit pas prise pour un doublon.
async function retirerJournal(admin, tableJournal, cle) {
  try {
    await admin.from(tableJournal).delete().eq("idempotency_key", cle);
  } catch (erreur) {
    console.error("[Webhook Orange] Impossible de retirer l'événement du journal :", erreur?.message);
  }
}

// `dependances` (tests) : { admin, rechercher, alerter } remplacent la base, l'API Orange et l'alerte réelles.
export async function traiterNotificationOrange(req, adaptateur, dependances = {}) {
  const { nom } = adaptateur;
  const rechercher = dependances.rechercher ?? rechercherTransactionOrange;
  const attendre = dependances.attendre ?? ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  const alerter = dependances.alerter ?? alerteReelle;
  // NOMS des en-têtes reçus (jamais leurs valeurs) : sert à voir ce qu'Orange envoie réellement (X-Sonatel-Signature, Authorization…).
  console.info(`[${nom}] en-têtes reçus :`, [...req.headers.keys()].sort().join(", "));

  const corpsBrut = await req.text();
  let evenement;
  try {
    evenement = JSON.parse(corpsBrut);
  } catch {
    return refusDefinitif(400, "Corps de requête invalide.");
  }
  if (!evenement || typeof evenement !== "object") return refusDefinitif(400, "Corps de requête invalide.");

  // Authorization: Basic {apiKey} — contrôlé SEULEMENT si ORANGE_MONEY_CALLBACK_BASIC_KEY existe.
  const basic = controlerBasicCallback(req.headers.get("authorization"));
  if (basic.requis && !basic.valide) {
    console.error(`[${nom}] En-tête Authorization (Basic) absent ou différent.`);
    return refusDefinitif(401, "Non autorisé.");
  }

  // Nos références sont toujours des UUID (identifiant de la commande). Autre chose = notification qui ne peut pas être la nôtre : commande
  // inconnue, refus définitif 404 — sans toucher à la base (une valeur non UUID y provoquerait une erreur, donc un 5xx et des nouveaux
  // essais inutiles d'Orange) et sans jamais interroger Orange.
  if (evenement.reference && (typeof evenement.reference !== "string" || !REFERENCE_UUID.test(evenement.reference))) {
    console.error(`[${nom}] Référence qui n'est pas un UUID : commande inconnue.`);
    return refusDefinitif(404, "Introuvable.");
  }

  let admin;
  try {
    admin = dependances.admin ?? (await import("@/lib/supabaseAdmin")).getSupabaseAdmin();
  } catch (erreur) {
    console.error(`[${nom}]`, erreur.message);
    alerter(`[${nom}] Service role manquant`, { message: erreur.message });
    return problemePassager(503);
  }

  const reference = evenement.reference;
  const orangeTransactionId = evenement.transactionId;
  const statut = evenement.status;
  if (!reference || typeof reference !== "string") {
    console.error(`[${nom}] Notification sans reference.`);
    alerter(`[${nom}] Notification sans reference`, { orangeTransactionId, statut });
    return accepte(); // rien à rattacher : inutile qu'Orange la renvoie
  }

  const { commande, erreur: erreurLecture } = await adaptateur.trouverCommande(admin, reference);
  if (erreurLecture) {
    // Base indisponible : PASSAGER → 5xx pour qu'Orange réessaie (surtout pas un 404 définitif).
    console.error(`[${nom}] Lecture de la commande impossible :`, erreurLecture.message);
    return problemePassager(503);
  }

  // Première barrière : le jeton propre à la commande (?t=) OU le secret global de l'URL de callback (?s=, ORANGE_MONEY_CALLBACK_SECRET).
  // Réponse 404 sans détail et JAMAIS d'appel à Orange : sinon n'importe qui pourrait nous faire interroger Orange à volonté.
  const parametres = new URL(req.url).searchParams;
  const filtreOk =
    jetonCallbackValide(parametres.get("t"), commande ? adaptateur.empreinteJeton(commande) : null) ||
    secretCallbackGlobalValide(parametres.get("s"), process.env.ORANGE_MONEY_CALLBACK_SECRET);
  if (!commande || !filtreOk) {
    console.error(`[${nom}] Notification refusée (commande inconnue ou jeton de callback invalide).`);
    return refusDefinitif(404, "Introuvable.");
  }

  // Clé d'idempotence : celle d'Orange si elle l'envoie, sinon dérivée de l'événement.
  const cle = req.headers.get("x-sonatel-idempotency-key") || `derivee:${hasherJetonCallback(`${reference}|${orangeTransactionId || ""}|${statut || ""}`)}`;
  const { error: erreurJournal } = await admin.from(adaptateur.tableJournal).insert({
    idempotency_key: cle,
    status: statut || null,
    orange_transaction_id: orangeTransactionId || null,
    reference,
    raw_payload: evenement,
    ...adaptateur.champsJournal(commande),
  });
  if (erreurJournal) {
    if (erreurJournal.code === "23505") return accepte(); // déjà reçue et traitée
    console.error(`[${nom}] Échec de la journalisation :`, erreurJournal.message);
    alerter(`[${nom}] Échec de la journalisation`, { message: erreurJournal.message });
    return problemePassager(500);
  }

  // La notification est enregistrée durablement. Confirmation auprès d'Orange (recherche + statut), avec ou sans transactionId.
  let confirmation;
  try {
    // La notification arrive parfois moins d'une seconde après le paiement, avant que la recherche d'Orange ne liste la transaction. Si elle
    // annonce un SUCCESS et que la ligne reste introuvable, on réessaie à courts intervalles avant de répondre 503 (Orange renverra alors la
    // notification, et le rattrapage reprend la commande). Aucun crédit tant qu'Orange n'a pas confirmé référence ET montant.
    const annonceSucces = String(statut || "").toUpperCase() === "SUCCESS";
    for (let essai = 0; essai <= DELAIS_REESSAI_MS.length; essai += 1) {
      if (essai > 0) await attendre(DELAIS_REESSAI_MS[essai - 1]);
      const reponseOrange = await rechercher({
        transactionId: orangeTransactionId,
        reference: commande.id,
        declare: { reference: evenement.reference, amount: evenement.amount },
      });
      confirmation = evaluerConfirmationOrange(reponseOrange, { reference: commande.id, montantXof: adaptateur.montantXof(commande) });
      confirmation.transactionId = reponseOrange.transactionId || orangeTransactionId || null;
      confirmation.source = reponseOrange.source;
      const nonRetrouvee = confirmation.etat === "attente" && /pas encore retrouvée/.test(confirmation.raison);
      if (!(annonceSucces && nonRetrouvee)) break;
      console.warn(`[${nom}] SUCCESS annoncé mais transaction pas encore retrouvée par la recherche (essai ${essai + 1}/${DELAIS_REESSAI_MS.length + 1}).`);
    }
  } catch (erreur) {
    // API Orange indisponible, limitée (429) ou « en attente » (51) : PASSAGER → 5xx, journal retiré pour que la relance soit traitée.
    console.error(`[${nom}] Confirmation auprès d'Orange impossible :`, erreur.message);
    await retirerJournal(admin, adaptateur.tableJournal, cle);
    return problemePassager(502);
  }

  if (confirmation.etat === "incoherent") {
    // Paiement « réussi » qui ne correspond pas à la commande (référence ou montant) : jamais de crédit, alerte, pas de nouvel essai utile.
    console.error(`[${nom}] Confirmation incohérente —`, confirmation.raison);
    alerter(`[${nom}] Confirmation incohérente avec la commande`, { reference, motif: confirmation.raison });
    return accepte();
  }
  if (confirmation.etat === "attente") {
    await retirerJournal(admin, adaptateur.tableJournal, cle);
    // La notification annonce un SUCCESS mais Orange ne le confirme pas encore : PASSAGER → 5xx pour qu'Orange réessaie. Une notification
    // à statut intermédiaire (PENDING…) n'appelle aucun nouvel essai : le statut final arrivera dans une autre notification.
    if (String(statut || "").toUpperCase() === "SUCCESS") return problemePassager(503);
    return accepte();
  }

  const { resultat } = await adaptateur.appliquer(admin, commande, confirmation, confirmation.transactionId);
  if (resultat === "erreur") {
    await retirerJournal(admin, adaptateur.tableJournal, cle);
    return problemePassager(500);
  }
  if (resultat === "doublon_transaction") {
    // Ce même transactionId Orange a déjà servi pour une autre commande : jamais deux crédits pour un paiement.
    alerter(`[${nom}] transactionId déjà utilisé par une autre commande`, { reference, transactionId: confirmation.transactionId });
  }
  await admin.from(adaptateur.tableJournal).update(adaptateur.champsJournal(commande)).eq("idempotency_key", cle);
  return accepte();
}
