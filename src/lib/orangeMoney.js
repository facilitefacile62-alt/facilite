// Client Orange Money "Paiement Marchand" (QR code / deeplink) — abonnement
// Premium. Spécification obtenue directement du contact Orange Sonatel
// (Ndèye Fakhane Diop, OFMS) le 2026-09-11, PAS la documentation publique
// marketing de developer.orange.com (qui ne détaille aucun endpoint) :
// https://developer.orange-sonatel.com/documentation#tag/Merchant-Payment
//
// Flux réel (différent d'un webpay classique à redirection) : on génère un
// QR code + deux deeplinks (MAXIT, OM) affichés sur NOTRE page ; le client
// scanne/ouvre l'appli Orange Money de son côté ; la confirmation arrive de
// façon asynchrone sur notre webhook, jamais en réponse directe à l'appel
// d'initiation. Aucune saisie d'OTP sur notre page — ce n'était qu'une
// supposition initiale, corrigée par la doc réelle.
//
// Comme PayDunya/KPay (src/lib/paydunya.js, src/lib/kpay.js), les secrets
// sont lus ici en process.env brut, jamais centralisés dans src/lib/env.js
// (réservé aux deux variables Supabase qui doivent faire échouer le
// démarrage) : chaque fonction ci-dessous vérifie elle-même ce dont elle a
// besoin et lève une erreur explicite plutôt que d'échouer silencieusement
// sur un fetch avec des identifiants vides.
//
// Volontairement toujours SANDBOX pour l'instant (voir le "point 5" de la
// demande) : ORANGE_MONEY_API_BASE_URL n'est PAS dérivée de NODE_ENV comme
// PayDunya — une bascule vers la production doit être un choix explicite
// (changer la variable d'environnement), jamais un effet de bord d'un
// déploiement Vercel en production.
import crypto from "node:crypto";

const SANDBOX_BASE_URL = "https://api.sandbox.orange-sonatel.com";

function baseUrl() {
  return process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX_BASE_URL;
}

/**
 * Erreur d'un appel à l'API Orange Money. `message` garde le détail technique
 * (journaux et alertes uniquement) ; `messageUtilisateur` est la phrase claire,
 * en français, qu'on peut montrer à la personne qui paie.
 */
export class ErreurOrangeMoney extends Error {
  constructor(messageTechnique, { httpStatus = null, donnees = null } = {}) {
    super(messageTechnique);
    this.name = "ErreurOrangeMoney";
    this.httpStatus = httpStatus;
    this.codeOrange = extraireCodeOrange(donnees);
    this.messageUtilisateur = traduireErreurOrange({ httpStatus, codeOrange: this.codeOrange });
  }
}

function extraireCodeOrange(donnees) {
  if (!donnees || typeof donnees !== "object") return null;
  const brut = donnees.code ?? donnees.errorCode ?? donnees.error_code ?? donnees.errors?.[0]?.code ?? null;
  if (brut !== null && brut !== undefined && String(brut) !== "") return String(brut);
  // Corps de forme inattendue : le code d'un QR expiré (4004) est le seul qu'on reconnaît en texte libre.
  return /\b4004\b/.test(JSON.stringify(donnees)) ? "4004" : null;
}

/** Traduit un code Orange / un statut HTTP en phrase claire — jamais le texte brut de l'API. */
export function traduireErreurOrange({ httpStatus, codeOrange }) {
  if (codeOrange === "4004") return "Le code de paiement a expiré. Générez-en un nouveau pour réessayer.";
  if (httpStatus === 429 || codeOrange === "9") return "Trop de demandes en même temps. Patientez une minute, puis réessayez.";
  if (codeOrange === "51") return "Votre paiement est en attente de confirmation par Orange Money. Patientez quelques instants avant de réessayer.";
  if (httpStatus === 401 || httpStatus === 403 || codeOrange === "10" || codeOrange === "11") {
    return "Le paiement par Orange Money est momentanément indisponible. Réessayez plus tard ou contactez-nous.";
  }
  return "Le paiement Orange Money n'a pas pu être lancé. Réessayez dans un instant.";
}

/** Phrase à montrer à l'utilisateur pour n'importe quelle erreur levée par ce module. */
export function messageUtilisateurOrange(erreur) {
  return erreur instanceof ErreurOrangeMoney ? erreur.messageUtilisateur : traduireErreurOrange({ httpStatus: null, codeOrange: null });
}

// Jeton OAuth2 mis en cache en mémoire de process — best effort seulement :
// une fonction serverless Vercel peut démarrer "à froid" sans ce cache,
// auquel cas un nouveau jeton est simplement redemandé. Le but est
// d'éviter de re-demander un jeton à CHAQUE requête sur une instance déjà
// "chaude", pas une garantie de partage entre instances (limite sandbox
// documentée : 60 req/min sur /oauth/v1/token).
let jetonCache = null; // { accessToken, expireLe }

async function obtenirJetonAcces() {
  const clientId = process.env.ORANGE_MONEY_CLIENT_ID;
  const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ORANGE_MONEY_CLIENT_ID / ORANGE_MONEY_CLIENT_SECRET manquant(s).");
  }

  const MARGE_EXPIRATION_MS = 60_000;
  if (jetonCache && jetonCache.expireLe - Date.now() > MARGE_EXPIRATION_MS) {
    return jetonCache.accessToken;
  }

  const reponse = await fetch(`${baseUrl()}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !donnees.access_token) {
    throw new ErreurOrangeMoney(`Échec d'obtention du jeton Orange Money (${reponse.status}) : ${donnees.error_description || donnees.error || "réponse invalide"}.`, { httpStatus: reponse.status, donnees });
  }

  jetonCache = {
    accessToken: donnees.access_token,
    expireLe: Date.now() + (Number(donnees.expires_in) || 3600) * 1000,
  };
  return jetonCache.accessToken;
}

/**
 * Génère un QR code / deeplinks de paiement marchand.
 *
 * `code` (le "code marchand" à 6 chiffres) est DISTINCT de
 * ORANGE_MONEY_CLIENT_ID — valeur encore à confirmer avec Orange au moment
 * d'écrire cette fonction (voir le "point 6" de la demande), lue ici via
 * ORANGE_MONEY_MERCHANT_CODE plutôt que codée en dur : tant que la variable
 * n'est pas renseignée, cette fonction échoue explicitement au lieu
 * d'envoyer une valeur inventée à l'API Orange.
 */
export async function genererQrCodePaiement({ reference, montantXof, nom, validiteSecondes = 900, callbackSuccessUrl, callbackCancelUrl, callbackUrl }) {
  const code = process.env.ORANGE_MONEY_MERCHANT_CODE;
  if (!code) {
    throw new Error("ORANGE_MONEY_MERCHANT_CODE manquant (code marchand à 6 chiffres, distinct du client_id OAuth2).");
  }

  const accessToken = await obtenirJetonAcces();

  const reponse = await fetch(`${baseUrl()}/api/eWallet/v4/qrcode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Callback-Url": callbackUrl,
    },
    body: JSON.stringify({
      code,
      name: nom,
      amount: { value: montantXof, unit: "XOF" },
      validity: validiteSecondes,
      callbackSuccessUrl,
      callbackCancelUrl,
      reference,
    }),
  });

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !donnees.qrId) {
    throw new ErreurOrangeMoney(`Échec de génération du QR code Orange Money (${reponse.status}) : ${donnees.message || donnees.error || "réponse invalide"}.`, { httpStatus: reponse.status, donnees });
  }

  return {
    qrId: donnees.qrId,
    qrCodeBase64: donnees.qrCode || null,
    deepLink: donnees.deepLink || null,
    deepLinkMaxit: donnees.deepLinks?.MAXIT || null,
    deepLinkOm: donnees.deepLinks?.OM || null,
    valideJusqua: donnees.validFor || null,
  };
}

/**
 * Repli en l'absence de webhook (le statut final est garanti sous 24h par
 * Orange) — utilisé par la route de statut interrogée par le frontend en
 * polling, jamais appelé automatiquement en tâche de fond ici.
 */
export async function obtenirStatutTransaction(transactionId) {
  const accessToken = await obtenirJetonAcces();
  const reponse = await fetch(`${baseUrl()}/api/eWallet/v1/transactions/${encodeURIComponent(transactionId)}/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new ErreurOrangeMoney(`Échec de lecture du statut Orange Money (${reponse.status}) : ${donnees.message || donnees.error || "réponse invalide"}.`, { httpStatus: reponse.status, donnees });
  }
  return donnees;
}

const FENETRE_ANTI_REJEU_SECONDES = 300;

/**
 * Vérifie l'en-tête X-Sonatel-Signature d'un webhook : format
 * "t={timestamp},v1={hmac_hex}[,v1={hmac_hex}…]", hmac = HMAC_SHA256(secret,
 * "{t},{corpsBrut}"). Pendant une rotation de secret Orange envoie PLUSIEURS
 * v1= (un par secret valide) : la requête est acceptée si N'IMPORTE LEQUEL
 * correspond, jamais seulement le premier. `corpsBrut` DOIT être le corps de
 * la requête tel que reçu, avant tout JSON.parse — un corps re-sérialisé ne
 * produirait pas le même octet-à-octet et casserait la vérification
 * silencieusement.
 *
 * `secret` est ORANGE_MONEY_WEBHOOK_SECRET. Orange distingue le « partner
 * endpoint secret » qui signe de l'apiKey renvoyée en `Authorization: Basic` :
 * lequel des deux est stocké ici reste à confirmer auprès d'Orange.
 */
export function verifierSignatureWebhook(corpsBrut, enTeteSignature, secret) {
  if (!enTeteSignature) return { valide: false, motif: "en-tête X-Sonatel-Signature absent" };

  // Forme documentée : ^t=\d+(,v1=[0-9a-f]{64})+$ (casse des chiffres hexa tolérée).
  const entete = enTeteSignature.trim();
  if (!/^t=\d+(,v1=[0-9a-f]{64})+$/i.test(entete)) {
    return { valide: false, motif: "format d'en-tête inattendu" };
  }
  const [partieT, ...partiesV1] = entete.split(",");
  const timestampTexte = partieT.slice(2);
  const signaturesRecues = partiesV1.map((p) => p.slice(3).toLowerCase());

  const timestamp = Number(timestampTexte);
  if (!Number.isFinite(timestamp)) return { valide: false, motif: "timestamp invalide" };

  const ecartSecondes = Math.abs(Date.now() / 1000 - timestamp);
  if (ecartSecondes > FENETRE_ANTI_REJEU_SECONDES) {
    return { valide: false, motif: `timestamp hors fenêtre anti-rejeu (${Math.round(ecartSecondes)}s d'écart)` };
  }

  const signatureAttendue = crypto
    .createHmac("sha256", secret)
    .update(`${timestampTexte},${corpsBrut}`)
    .digest("hex");
  const bufAttendu = Buffer.from(signatureAttendue, "utf8");

  // Toutes les signatures sont comparées (pas de sortie anticipée sur la
  // première qui correspond) : durée indépendante du rang du bon v1.
  let correspond = false;
  for (const recue of signaturesRecues) {
    const bufRecu = Buffer.from(recue, "utf8");
    if (bufRecu.length === bufAttendu.length && crypto.timingSafeEqual(bufAttendu, bufRecu)) correspond = true;
  }
  if (!correspond) return { valide: false, motif: "signature invalide" };

  return { valide: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// Callback sécurisé sans signature (Orange annonce le secret de signature comme « une évolution à venir »).
//
// Une notification n'est jamais un crédit : c'est un DÉCLENCHEUR. Le webhook (1) filtre par un jeton secret propre à la
// commande placé dans l'URL de callback, (2) vérifie la signature HMAC quand l'en-tête est présent, (3) confirme l'état
// réel du paiement auprès d'Orange avec notre jeton OAuth, (4) ne crédite que si statut, référence et montant
// correspondent à la commande.
// ---------------------------------------------------------------------------------------------------------------------

/** Empreinte SHA-256 (hexa) d'un jeton de callback : seule cette empreinte est stockée en base. */
export function hasherJetonCallback(jeton) {
  return crypto.createHash("sha256").update(String(jeton)).digest("hex");
}

/** Jeton imprévisible (32 octets) pour l'URL de callback d'UNE commande, avec son empreinte à stocker. */
export function genererJetonCallback() {
  const jeton = crypto.randomBytes(32).toString("base64url");
  return { jeton, empreinte: hasherJetonCallback(jeton) };
}

/** Compare le jeton reçu à l'empreinte stockée, en temps constant. Faux si l'un des deux manque. */
export function jetonCallbackValide(jetonRecu, empreinteStockee) {
  if (!jetonRecu || !empreinteStockee || !/^[0-9a-f]{64}$/i.test(empreinteStockee)) return false;
  const attendu = Buffer.from(empreinteStockee.toLowerCase(), "utf8");
  const recu = Buffer.from(hasherJetonCallback(jetonRecu), "utf8");
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}

// Statuts finaux d'échec côté Orange. Tout statut inconnu ou intermédiaire = « en attente » : on ne change rien.
const STATUTS_ECHEC = new Set(["FAILED", "EXPIRED", "CANCELED", "CANCELLED", "REJECTED"]);

/**
 * Juge la réponse de recherche de transaction d'Orange face à la commande.
 * Retourne { etat, raison } avec etat ∈ "succes" | "echec" | "attente" | "incoherent".
 *  - "succes"     : statut SUCCESS, référence ET montant identiques à la commande (devise XOF si indiquée).
 *  - "incoherent" : SUCCESS mais référence ou montant absents/différents — jamais de crédit, alerte.
 *  - "echec"      : statut final d'échec.
 *  - "attente"    : tout le reste.
 * Un champ absent de la réponse n'est jamais présumé conforme : sans référence et sans montant lisibles, pas de crédit.
 */
export function evaluerConfirmationOrange(reponse, { reference, montantXof }) {
  const statut = typeof reponse?.status === "string" ? reponse.status.toUpperCase() : "";
  if (STATUTS_ECHEC.has(statut)) return { etat: "echec", raison: `statut ${statut}` };
  if (statut !== "SUCCESS") return { etat: "attente", raison: `statut ${statut || "absent"}` };

  if (!reference || String(reponse?.reference ?? "") !== String(reference)) {
    return { etat: "incoherent", raison: "référence absente ou différente" };
  }
  const brut = reponse?.amount;
  const valeur = Number(typeof brut === "object" && brut !== null ? brut.value : brut);
  const unite = typeof brut === "object" && brut !== null ? brut.unit : null;
  if (!Number.isFinite(valeur) || !Number.isInteger(montantXof) || valeur !== montantXof) {
    return { etat: "incoherent", raison: "montant absent ou différent" };
  }
  if (unite && String(unite).toUpperCase() !== "XOF") return { etat: "incoherent", raison: "devise différente" };
  return { etat: "succes", raison: "ok" };
}

/**
 * Secret GLOBAL de l'URL de callback (version de secours : si Orange n'honore qu'une URL fixe enregistrée sur le portail,
 * le jeton par commande ne peut pas voyager dans l'URL). Comparaison en temps constant, via empreintes de même longueur.
 * Faux si l'un des deux manque.
 */
export function secretCallbackGlobalValide(recu, attendu) {
  if (!recu || !attendu) return false;
  const a = Buffer.from(hasherJetonCallback(recu), "utf8");
  const b = Buffer.from(hasherJetonCallback(attendu), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * INTERFACE de recherche d'une transaction chez Orange, utilisée par le webhook et par le rattrapage.
 * Aujourd'hui seule la recherche par identifiant de transaction Orange est branchée (chemin hérité de la spécification
 * transmise en septembre, à valider contre la documentation du portail). La recherche par référence marchande / qrId —
 * indispensable au rattrapage d'une commande dont aucune notification n'est jamais arrivée — attend la documentation
 * « recherche de transaction » : elle échoue explicitement au lieu d'inventer un chemin.
 */
export async function rechercherTransactionOrange({ transactionId, reference, qrId }) {
  if (transactionId) return obtenirStatutTransaction(transactionId);
  throw new ErreurOrangeMoney(
    `Recherche de transaction par référence (${reference || "?"}) / qrId (${qrId || "?"}) non implémentée : documentation Orange requise.`
  );
}
