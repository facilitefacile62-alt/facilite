/**
 * Client Daily.co (https://daily.co) — visioconférence pour les entretiens
 * à distance recruteur/candidat.
 *
 * Contrairement à kpay.js, ce contrat d'API n'a PAS été vérifié contre une
 * documentation ou un compte réel fourni par l'utilisateur : DAILY_API_KEY
 * n'est renseigné nulle part (ni .env.local, ni Vercel) au moment où ce
 * fichier est écrit. Les endpoints/champs ci-dessous suivent l'API REST
 * publique de Daily.co (stable, documentée sur https://docs.daily.co/reference/rest-api),
 * mais n'ont pas pu être testés en conditions réelles faute de clé — à
 * vérifier empiriquement dès qu'une vraie clé est fournie.
 */

const DAILY_API_BASE = "https://api.daily.co/v1";

function getDailyHeaders() {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[Configuration] DAILY_API_KEY manquant côté serveur. Créez un compte sur https://daily.co, " +
        "récupérez une clé API dans le tableau de bord, et renseignez-la (.env.local en local, " +
        "variables d'environnement Vercel en production) avant d'utiliser les entretiens vidéo."
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Crée un salon de visio éphémère et privé.
 *
 * @param {object} params
 * @param {string} params.name - Nom unique du salon (ex: interview-<uuid>).
 * @param {number} params.expiresInSeconds - Durée de vie avant expiration
 *   automatique côté Daily.co (le salon devient inutilisable après, même si
 *   la ligne `interviews` correspondante existe toujours en base).
 * @returns {Promise<{ id: string, name: string, url: string }>}
 */
export async function createInterviewRoom({ name, expiresInSeconds }) {
  const res = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: getDailyHeaders(),
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        // Chat natif désactivé : la Messagerie Facilite fait déjà ce rôle,
        // un doublon aurait dispersé la conversation entre deux endroits.
        enable_chat: false,
        enable_screenshare: true,
        // Salle d'attente : le candidat ne doit pas pouvoir entrer seul
        // avant que le recruteur n'ait rejoint/accepté.
        enable_knocking: true,
        enable_prejoin_ui: true,
      },
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.url) {
    const message = data?.error || data?.info || `Échec de la création du salon Daily.co (HTTP ${res.status}).`;
    throw new Error(message);
  }

  return { id: data.id, name: data.name, url: data.url };
}

/**
 * Génère un jeton de participation nominatif et à courte durée de vie pour
 * un salon existant. Jamais persisté en base : minté à la demande au moment
 * où l'utilisateur clique "Rejoindre", pour limiter la fenêtre pendant
 * laquelle un jeton qui fuiterait (log, capture d'écran d'un lien partagé...)
 * resterait exploitable.
 *
 * @param {object} params
 * @param {string} params.roomName
 * @param {boolean} params.isOwner - true pour le recruteur (droits de
 *   modération : accepter la salle d'attente, retirer un participant...).
 * @param {string} [params.userName] - Nom affiché dans l'UI Daily Prebuilt.
 * @param {number} params.expiresInSeconds
 * @returns {Promise<string>} Le jeton.
 */
export async function createMeetingToken({ roomName, isOwner, userName, expiresInSeconds }) {
  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: getDailyHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isOwner,
        user_name: userName,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      },
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.token) {
    const message = data?.error || data?.info || `Échec de la génération du jeton de participation (HTTP ${res.status}).`;
    throw new Error(message);
  }

  return data.token;
}
