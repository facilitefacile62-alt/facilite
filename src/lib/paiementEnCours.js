// Paiement en cours : on le garde sur l'appareil pour le RETROUVER si la page est rechargée — typiquement au retour de MAXIT (« Quitter » ou retour
// arrière envoie vers l'adresse d'annulation, ce qui recharge la page et faisait perdre le QR et les boutons). Logique pure, testable sans navigateur.
//
// Ce qui est gardé : l'identifiant de la commande, le QR (image) et les liens d'ouverture des applications, les montants, et l'heure de fin de validité.
// Rien de secret : ces liens et ce QR servent justement à payer. Les données sont rattachées au COMPTE (proprietaire) et refusées après la fin de validité.
import { lienValide } from "./ouvertureAppPaiement.js";

const PREFIXE = "paiement-en-cours:";
const MAX_QR = 200_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stockageLocal() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Enregistre le paiement qui vient d'être créé (data = réponse de la route de paiement). */
export function sauvegarderPaiementEnCours(produit, data, { proprietaire, maintenant = Date.now(), stockage = stockageLocal() } = {}) {
  if (!stockage || !proprietaire || !data?.transactionId || !data?.validForSeconds) return false;
  try {
    stockage.setItem(
      PREFIXE + produit,
      JSON.stringify({
        v: 1,
        proprietaire,
        transactionId: data.transactionId,
        qrId: data.qrId ?? null,
        qrCodeBase64: typeof data.qrCodeBase64 === "string" && data.qrCodeBase64.length <= MAX_QR ? data.qrCodeBase64 : null,
        deepLinkMaxit: data.deepLinkMaxit ?? null,
        deepLinkOm: data.deepLinkOm ?? null,
        quantiteJetons: data.quantiteJetons ?? null,
        montantXof: data.montantXof ?? null,
        finMs: maintenant + data.validForSeconds * 1000,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function effacerPaiementEnCours(produit, { stockage = stockageLocal() } = {}) {
  try {
    stockage?.removeItem(PREFIXE + produit);
  } catch {
    // Stockage indisponible : rien à effacer.
  }
}

/**
 * Paiement à restaurer, ou null : absent, d'un autre compte, expiré (ou à moins de `margeSecondes` de l'être), ou illisible. Les liens dangereux
 * (javascript:, data:…) sont écartés. `validForSeconds` est recalculé : il reste, à l'identique, le temps réellement restant.
 */
export function lirePaiementEnCours(produit, { proprietaire, maintenant = Date.now(), margeSecondes = 3, stockage = stockageLocal() } = {}) {
  try {
    const brut = stockage?.getItem(PREFIXE + produit);
    if (!brut) return null;
    const d = JSON.parse(brut);
    if (!d || d.v !== 1 || !proprietaire || d.proprietaire !== proprietaire) return null;
    if (typeof d.transactionId !== "string" || !UUID.test(d.transactionId)) return null;
    const restant = Math.floor((Number(d.finMs) - maintenant) / 1000);
    if (!Number.isFinite(restant) || restant <= margeSecondes) {
      effacerPaiementEnCours(produit, { stockage });
      return null;
    }
    return {
      transactionId: d.transactionId,
      qrId: d.qrId,
      qrCodeBase64: typeof d.qrCodeBase64 === "string" ? d.qrCodeBase64 : null,
      deepLinkMaxit: lienValide(d.deepLinkMaxit) ? d.deepLinkMaxit : null,
      deepLinkOm: lienValide(d.deepLinkOm) ? d.deepLinkOm : null,
      quantiteJetons: d.quantiteJetons,
      montantXof: d.montantXof,
      validForSeconds: restant,
    };
  } catch {
    return null;
  }
}
