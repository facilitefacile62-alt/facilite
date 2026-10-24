import { nomQrOrange } from "./orangeMoney.js";

// Alerte chargée à la demande (comme webhookOrange.js) : le module se teste sous Node, hors du serveur Next. `reglages.alerter` permet aux tests
// de la remplacer ; en production c'est toujours l'alerte réelle.
async function alerteReelle(...args) {
  try {
    const { captureCriticalPaymentError: capturer } = await import("@/lib/sentryAlert");
    capturer(...args);
  } catch {
    console.error("[Achat CV] alerte :", ...args);
  }
}
export const reglages = { alerter: alerteReelle };
const alerte = (...args) => reglages.alerter(...args);

/** Prix minimum d'un modèle de CV, en FCFA : contrainte en base (cv_modeles.prix_xof) ET contrôle serveur ici. */
export const PRIX_MIN_MODELE_CV_XOF = 100;
export const montantAchatCvValide = (montant) => Number.isInteger(montant) && montant >= PRIX_MIN_MODELE_CV_XOF;

/** Champ `name` du QR Orange : « CV » + nom du modèle, sans accent, 20 caractères au plus (voir nomQrOrange). */
export const nomQrCv = (nomModele) => nomQrOrange(`CV ${nomModele}`);

/** Durée du lien de téléchargement signé du fichier livré, en secondes. */
export const DUREE_LIEN_TELECHARGEMENT_SECONDES = 60;

/**
 * Applique à un achat de modèle la confirmation d'Orange (voir evaluerConfirmationOrange dans orangeMoney.js) — même logique que
 * jetonsPaiement.js : « attente » et « incoherent » sont traités avant l'appel et ne touchent jamais l'achat. L'idempotence tient à la
 * transition atomique pending|failed → success (un achat « failed » dont Orange confirme ensuite un SUCCESS pour la bonne référence ET le bon
 * montant est bien acheté, une seule fois). Le montant attendu est celui figé à la commande par le serveur (jamais celui du navigateur).
 *
 * Retourne { resultat } : "credite" | "echec_enregistre" | "deja_traite" | "doublon_transaction" | "erreur".
 */
export async function appliquerConfirmationAchatCv(admin, achat, confirmation, orangeTransactionId = null) {
  try {
    if (confirmation.etat === "echec") {
      await admin.from("cv_achats").update({ status: "failed" }).eq("id", achat.id).eq("status", "pending");
      return { resultat: "echec_enregistre" };
    }
    if (!montantAchatCvValide(achat.montant_xof)) {
      console.error("[Achat CV] Montant de la commande invalide (inférieur au minimum) — aucun achat validé.");
      alerte("[Achat CV] Montant de la commande invalide", { achatId: achat.id });
      return { resultat: "erreur" };
    }

    const { data: misesAJour, error } = await admin
      .from("cv_achats")
      .update({ status: "success", provider_reference: orangeTransactionId || achat.provider_reference, paye_le: new Date().toISOString() })
      .eq("id", achat.id)
      .in("status", ["pending", "failed"])
      .select("id");

    if (error) {
      if (error.code === "23505") {
        // Le modèle est DÉJÀ acheté par ce compte (autre commande) : ce paiement-ci est un doublon à rembourser, jamais un second achat.
        if (/cv_achats_un_par_modele/.test(error.message || "")) {
          console.error("[Achat CV] Modèle déjà acheté par ce compte — nouveau paiement à rembourser.");
          alerte("[Achat CV] Paiement pour un modèle déjà acheté", { achatId: achat.id });
          await admin.from("cv_achats").update({ status: "failed" }).eq("id", achat.id).eq("status", "pending");
          return { resultat: "deja_traite" };
        }
        // Contrainte d'unicité : un même transactionId Orange ne peut valider QU'UN achat.
        console.error("[Achat CV] transactionId Orange déjà utilisé par un autre achat — aucune validation.");
        alerte("[Achat CV] transactionId Orange en double", { achatId: achat.id });
        return { resultat: "doublon_transaction" };
      }
      console.error("[Achat CV] Échec mise à jour de l'achat :", error.message);
      alerte("[Achat CV] Échec mise à jour de l'achat", { message: error.message, achatId: achat.id });
      return { resultat: "erreur" };
    }
    if (!misesAJour || misesAJour.length === 0) return { resultat: "deja_traite" };
    return { resultat: "credite" };
  } catch (err) {
    console.error("[Achat CV] Erreur interne :", err);
    alerte("[Achat CV] Erreur interne", { message: err?.message, achatId: achat?.id });
    return { resultat: "erreur" };
  }
}

/**
 * Description d'un achat de CV pour le webhook commun (src/lib/webhookOrange.js) : mêmes protections que les jetons et la formation CV
 * (jeton de callback par commande ou secret global, journal d'idempotence, confirmation recherche + statut, 503 tant que la ligne n'est pas
 * retrouvée, détection des paiements en double). `reference` porte cv_achats.id (UUID) ; le montant attendu est celui figé en base.
 */
export const adaptateurAchatCv = {
  nom: "Webhook Achat CV",
  tableJournal: "cv_achat_webhook_events",
  trouverCommande: async (admin, reference) => {
    const { data, error } = await admin
      .from("cv_achats")
      .select("id, user_id, modele_id, montant_xof, status, provider_reference, callback_token_hash")
      .eq("id", reference)
      .maybeSingle();
    return { commande: data, erreur: error };
  },
  empreinteJeton: (commande) => commande.callback_token_hash,
  montantXof: (commande) => commande.montant_xof,
  appliquer: (admin, commande, confirmation, orangeTransactionId) => appliquerConfirmationAchatCv(admin, commande, confirmation, orangeTransactionId),
  // Transaction Orange qui a validé l'achat de CE modèle par CE compte (même via une autre commande) ; null s'il n'est pas acheté.
  transactionCrediteur: async (admin, commande) => {
    const { data } = await admin
      .from("cv_achats")
      .select("provider_reference")
      .eq("user_id", commande.user_id)
      .eq("modele_id", commande.modele_id)
      .eq("status", "success")
      .limit(1)
      .maybeSingle();
    return data?.provider_reference ?? null;
  },
  champsJournal: (commande) => ({ achat_id: commande.id }),
};

/**
 * Le fichier livré n'est accessible qu'à l'ACHETEUR d'un achat CONFIRMÉ (status = success, écrit seulement par le serveur après la
 * confirmation d'Orange). Retourne { chemin, nom } ou { statut, erreur } — le lien signé de courte durée est créé ensuite par la route.
 */
export async function autoriserTelechargementCv(admin, userId, modeleId) {
  const { data: achat, error } = await admin
    .from("cv_achats")
    .select("id")
    .eq("user_id", userId)
    .eq("modele_id", modeleId)
    .eq("status", "success")
    .limit(1)
    .maybeSingle();
  if (error) return { statut: 503, erreur: "Indisponible, réessayez." };
  if (!achat) return { statut: 403, erreur: "Ce modèle n'a pas été acheté avec ce compte." };
  const { data: modele, error: erreurModele } = await admin.from("cv_modeles").select("nom, fichier_livre").eq("id", modeleId).maybeSingle();
  if (erreurModele) return { statut: 503, erreur: "Indisponible, réessayez." };
  if (!modele?.fichier_livre) return { statut: 404, erreur: "Le fichier de ce modèle n'est pas encore disponible." };
  return { chemin: modele.fichier_livre, nom: modele.nom };
}

/** Nom du fichier téléchargé : nom du modèle simplifié + extension du fichier livré (pdf, docx…). */
export function nomFichierLivre(nomModele, chemin) {
  const extension = /\.([A-Za-z0-9]{2,5})$/.exec(String(chemin ?? ""))?.[1]?.toLowerCase() ?? "pdf";
  const base = String(nomModele ?? "modele")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `CV-${base || "modele"}.${extension}`;
}

/** Chemin de l'image d'aperçu d'une page (1 = première) ; null si la page n'existe pas. */
export function cheminApercuCv(apercus, page) {
  if (!Array.isArray(apercus)) return null;
  if (!/^[0-9]{1,2}$/.test(String(page))) return null;
  const numero = Number(page);
  return numero >= 1 && numero <= apercus.length ? apercus[numero - 1] || null : null;
}

const TYPES_IMAGE = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const typeImageApercu = (chemin) => TYPES_IMAGE[/\.([A-Za-z0-9]+)$/.exec(String(chemin ?? ""))?.[1]?.toLowerCase()] ?? null;
