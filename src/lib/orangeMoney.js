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
    // Code 51 (« demande en attente ») : la demande est peut-être DÉJÀ prise en compte chez Orange. Ne JAMAIS la rejouer.
    this.nePasRejouer = this.codeOrange === "51";
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

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DELAIS_429_MS = [1000, 2000, 4000];

/**
 * fetch vers l'API Orange avec attente croissante sur 429 (limite sandbox : 60 requêtes/minute). Aucun autre rejeu automatique :
 * en particulier jamais sur 5xx / 51 (la demande a pu être prise en compte) — c'est l'appelant qui décide.
 */
async function fetchOrange(url, init) {
  let derniere = null;
  for (let essai = 0; essai <= DELAIS_429_MS.length; essai += 1) {
    derniere = await fetch(url, init);
    if (derniere.status !== 429 || essai === DELAIS_429_MS.length) return derniere;
    await attendre(DELAIS_429_MS[essai] + Math.floor(Math.random() * 250));
  }
  return derniere;
}

/** Appel authentifié : jeton en cache, et si Orange le refuse (401) on en redemande UN seul et on rejoue une fois. */
async function appelAuthentifie(chemin, { methode = "GET", entetes = {}, corps } = {}) {
  const lancer = async () => {
    const jeton = await obtenirJetonAcces();
    return fetchOrange(`${baseUrl()}${chemin}`, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton}`, ...entetesCle(), ...entetes },
      ...(corps !== undefined ? { body: corps } : {}),
    });
  };
  let reponse = await lancer();
  if (reponse.status === 401) {
    jetonCache = null;
    reponse = await lancer();
  }
  return reponse;
}

/** En-tête X-Api-Key, SEULEMENT si le contrat Orange en fournit une (ORANGE_MONEY_API_KEY). */
function entetesCle() {
  return process.env.ORANGE_MONEY_API_KEY ? { "X-Api-Key": process.env.ORANGE_MONEY_API_KEY } : {};
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

  const reponse = await fetchOrange(`${baseUrl()}/oauth/v1/token`, {
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
 * Masque ce qui pourrait ressembler à un secret dans un texte renvoyé par Orange (longues chaînes de type clé ou jeton, paramètre t= d'une
 * adresse de callback) et le tronque. Jamais de clé, de jeton ni d'en-tête Authorization dans les journaux.
 */
function masquerTexte(texte, max = 300) {
  return String(texte ?? "")
    .replace(/([?&]t=)[^&\s"]+/g, "$1[masqué]")
    .replace(/[A-Za-z0-9._~+/=-]{40,}/g, "[masqué]")
    .slice(0, max);
}

const hoteDe = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return "adresse invalide";
  }
};

/**
 * Journal du refus d'un QR code : statut HTTP, code et message d'Orange (masqués), champs reçus, identifiant de requête, et la FORME de ce
 * qui a été envoyé (longueurs, nombres, hôtes, https oui/non). Jamais la valeur du code marchand, des clés, du jeton OAuth, du jeton
 * de callback ni d'un en-tête d'autorisation.
 */
function journaliserRefusQr({ reponse, corpsBrut, donnees, requete }) {
  const identifiant = ["x-request-id", "x-correlation-id", "x-kong-request-id", "x-amzn-requestid"].map((c) => reponse.headers.get(c)).find(Boolean) ?? null;
  const code = String(requete.code ?? "");
  console.error(
    "[Orange QR refusé]",
    JSON.stringify({
      http: reponse.status,
      codeOrange: extraireCodeOrange(donnees),
      message: masquerTexte(donnees.message ?? donnees.error_description ?? donnees.description ?? donnees.detail ?? donnees.title ?? donnees.error ?? ""),
      champsRecus: donnees && typeof donnees === "object" ? Object.keys(donnees).slice(0, 12) : [],
      corpsApercu: masquerTexte(corpsBrut, 200),
      typeContenu: reponse.headers.get("content-type"),
      identifiantRequete: identifiant,
      serveur: hoteDe(baseUrl()),
      requete: {
        codeMarchandLongueur: code.length,
        codeMarchandChiffresSeulement: /^\d+$/.test(code),
        codeMarchandCommencePar62: code.startsWith("62"),
        montant: requete.montantXof,
        unite: "XOF",
        validiteSecondes: requete.validiteSecondes,
        referenceLongueur: String(requete.reference ?? "").length,
        nomLongueur: String(requete.nom ?? "").length,
        nomAscii: /^[\x20-\x7e]*$/.test(String(requete.nom ?? "")),
        successUrlHote: hoteDe(requete.callbackSuccessUrl),
        successUrlHttps: String(requete.callbackSuccessUrl ?? "").startsWith("https://"),
        cancelUrlHttps: String(requete.callbackCancelUrl ?? "").startsWith("https://"),
        callbackHote: requete.callbackUrl ? hoteDe(requete.callbackUrl) : null,
        callbackHttps: String(requete.callbackUrl ?? "").startsWith("https://"),
        callbackLongueur: String(requete.callbackUrl ?? "").length,
      },
    })
  );
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

  // X-Callback-Url : https obligatoire (Orange refuse le http et valide le certificat). À défaut, Orange utiliserait l'adresse
  // enregistrée via merchantcallback, que notre application n'a pas le droit d'utiliser en sandbox (401 « no apiproduct match »).
  const reponse = await appelAuthentifie("/api/eWallet/v4/qrcode", {
    methode: "POST",
    entetes: { "Content-Type": "application/json", ...(callbackUrl ? { "X-Callback-Url": callbackUrl } : {}) },
    corps: JSON.stringify({
      code,
      name: nom,
      amount: { value: montantXof, unit: "XOF" },
      validity: validiteSecondes,
      callbackSuccessUrl,
      callbackCancelUrl,
      reference,
    }),
  });

  // Corps lu en TEXTE d'abord : une réponse d'erreur qui n'est pas du JSON (ou un JSON de forme inattendue) ne doit pas disparaître des journaux.
  const corpsBrut = await reponse.text().catch(() => "");
  let donnees = {};
  try {
    donnees = JSON.parse(corpsBrut) ?? {};
  } catch {
    donnees = {};
  }
  if (!reponse.ok || !donnees.qrId) {
    journaliserRefusQr({ reponse, corpsBrut, donnees, requete: { code, nom, montantXof, validiteSecondes, reference, callbackSuccessUrl, callbackCancelUrl, callbackUrl } });
    throw new ErreurOrangeMoney(`Échec de génération du QR code Orange Money (${reponse.status}) : ${donnees.message || donnees.error || "réponse invalide"}.`, { httpStatus: reponse.status, donnees });
  }

  return {
    qrId: donnees.qrId,
    qrCodeBase64: donnees.qrCode || null,
    deepLink: donnees.deepLink || null,
    deepLinkMaxit: donnees.deepLinks?.MAXIT || null,
    deepLinkOm: donnees.deepLinks?.OM || null,
    valideJusqua: donnees.validFor || null,
    shortLink: donnees.shortLink || null,
  };
}

/**
 * Repli en l'absence de webhook (le statut final est garanti sous 24h par
 * Orange) — utilisé par la route de statut interrogée par le frontend en
 * polling, jamais appelé automatiquement en tâche de fond ici.
 */
export async function obtenirStatutTransaction(transactionId) {
  const reponse = await appelAuthentifie(`/api/eWallet/v1/transactions/${encodeURIComponent(transactionId)}/status`);
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

// Statuts de la documentation officielle (Orange Money API v1.1.0) : ACCEPTED, CANCELLED, FAILED, INITIATED, PENDING, PRE_INITIATED,
// REJECTED, SUCCESS. FINAUX d'échec : CANCELLED, FAILED, REJECTED (EXPIRED / CANCELED tolérés au cas où). INTERMÉDIAIRES (ACCEPTED,
// INITIATED, PENDING, PRE_INITIATED) et tout statut inconnu = « en attente » : on ne change rien. Seul SUCCESS est « payé ».
const STATUTS_ECHEC = new Set(["FAILED", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED"]);

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
 * Recherche de transactions : GET /api/eWallet/v1/transactions (filtres reference, transactionId, type, status, fromDateTime,
 * toDateTime, page, size). Renvoie un tableau (la documentation donne un tableau ; une enveloppe { content } est tolérée).
 */
export async function listerTransactionsOrange({ reference, transactionId, type = "MERCHANT_PAYMENT", status, fromDateTime, toDateTime, page = 0, size = 20 } = {}) {
  const q = new URLSearchParams();
  if (reference) q.set("reference", reference);
  if (transactionId) q.set("transactionId", transactionId);
  if (type) q.set("type", type);
  if (status) q.set("status", status);
  if (fromDateTime) q.set("fromDateTime", fromDateTime);
  if (toDateTime) q.set("toDateTime", toDateTime);
  q.set("page", String(page));
  q.set("size", String(size));
  const reponse = await appelAuthentifie(`/api/eWallet/v1/transactions?${q.toString()}`);
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new ErreurOrangeMoney(`Échec de la recherche de transactions Orange Money (${reponse.status}) : ${donnees.detail || donnees.message || donnees.error || "réponse invalide"}.`, { httpStatus: reponse.status, donnees });
  }
  return Array.isArray(donnees) ? donnees : Array.isArray(donnees?.content) ? donnees.content : [];
}

/**
 * Interroge Orange sur UNE transaction et renvoie une réponse normalisée { status, reference, amount, transactionId, source },
 * prête pour evaluerConfirmationOrange. L'API de statut ne renvoie QUE { status } (documentation) : la référence et le montant
 * viennent de la recherche de transactions, et le statut FINAL vient toujours de l'API de statut — « payé » exige que les DEUX
 * disent SUCCESS.
 *
 * Quand la recherche n'est pas autorisée pour notre application (401 / 403) ou introuvable (404), repli : statut confirmé par
 * l'API de statut, et référence / montant lus dans la notification reçue (`declare`) — qui ne fait QUE servir à vérifier la
 * cohérence avec la commande, jamais à décider seule du paiement. Sans `declare` (rattrapage), pas de repli : pas de crédit.
 */
export async function rechercherTransactionOrange({ transactionId, reference, declare } = {}) {
  let trouvee = null;
  let rechercheIndisponible = false;
  if (transactionId || reference) {
    try {
      const liste = await listerTransactionsOrange(transactionId ? { transactionId, reference } : { reference });
      const memeId = (t) => !transactionId || String(t?.transactionId ?? "") === String(transactionId);
      const memeRef = (t) => !reference || String(t?.reference ?? "") === String(reference);
      const candidates = liste.filter((t) => memeId(t) && memeRef(t));
      // Plusieurs lignes pour une même référence (rejouée) : un paiement abouti prime sur les autres.
      trouvee = candidates.find((t) => String(t?.status ?? "").toUpperCase() === "SUCCESS") ?? candidates[0] ?? null;
    } catch (erreur) {
      if (erreur instanceof ErreurOrangeMoney && [401, 403, 404].includes(erreur.httpStatus)) rechercheIndisponible = true;
      else throw erreur;
    }
  }

  const idFinal = trouvee?.transactionId || transactionId || null;
  if (!idFinal) return { status: "NOT_FOUND", reference: reference ?? null, amount: null, transactionId: null, source: "recherche" };

  // Vérité terrain : l'API de statut, appelée systématiquement avant tout crédit.
  const statut = await obtenirStatutTransaction(idFinal);
  const statutFinal = String(statut?.status ?? "").toUpperCase();

  if (trouvee) {
    const statutRecherche = String(trouvee.status ?? "").toUpperCase();
    // Les deux sources doivent dire SUCCESS ; sinon on garde le statut non-SUCCESS (attente ou échec), jamais SUCCESS.
    const status = statutFinal === "SUCCESS" && statutRecherche === "SUCCESS" ? "SUCCESS" : statutFinal !== "SUCCESS" ? statutFinal : statutRecherche;
    return { status, reference: trouvee.reference ?? null, amount: trouvee.amount ?? null, transactionId: idFinal, source: "recherche+statut" };
  }
  if (rechercheIndisponible && declare) {
    return { status: statutFinal, reference: declare.reference ?? null, amount: declare.amount ?? null, transactionId: idFinal, source: "statut+notification" };
  }
  // Rien trouvé par la recherche : on ne présume rien (référence et montant inconnus → jamais « payé »).
  return { status: statutFinal === "SUCCESS" ? "SUCCESS" : statutFinal, reference: null, amount: null, transactionId: idFinal, source: "statut" };
}

/**
 * Contrôle FACULTATIF de l'en-tête Authorization: Basic {apiKey} que la documentation annonce pour les notifications quand une
 * apiKey est enregistrée via merchantcallback. Retourne { requis, valide } : `requis` vaut false tant que la variable
 * ORANGE_MONEY_CALLBACK_BASIC_KEY n'existe pas (rien n'est imposé avant d'avoir vu en sandbox qu'Orange l'envoie). Comparaison en
 * temps constant, via empreintes de même longueur.
 */
export function controlerBasicCallback(enTeteAutorisation, attendu = process.env.ORANGE_MONEY_CALLBACK_BASIC_KEY) {
  if (!attendu) return { requis: false, valide: true };
  const recu = String(enTeteAutorisation ?? "").replace(/^Basic\s+/i, "").trim();
  if (!recu) return { requis: true, valide: false };
  const a = Buffer.from(hasherJetonCallback(recu), "utf8");
  const b = Buffer.from(hasherJetonCallback(attendu), "utf8");
  return { requis: true, valide: a.length === b.length && crypto.timingSafeEqual(a, b) };
}
