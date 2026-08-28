/**
 * Notification unique de /api/auth/confirm-after-login par session de navigation.
 *
 * INCIDENT 2026-08-28 : « la plupart des gens » restaient bloqués sur la page
 * de connexion, avec dans la console quatre
 * `POST /api/auth/confirm-after-login 429 (Too Many Requests)` d'affilée.
 *
 * Cause : Header.jsx déclenchait cet appel sur CHAQUE événement `SIGNED_IN`
 * de supabase.auth.onAuthStateChange(). Or supabase-js émet `SIGNED_IN` bien
 * au-delà d'une vraie connexion — à chaque rafraîchissement de jeton, à
 * chaque retour d'onglet au premier plan, et à chaque montage de page avec
 * une session existante. Header étant monté sur TOUTES les pages, une simple
 * navigation suffisait à épuiser le plafond de 20 requêtes par minute de
 * checkRateLimit. Passé ce seuil, les 29 routes API qui partagent ce
 * compteur répondaient 429 — dont celles nécessaires pour finir de se
 * connecter. D'où la boucle : bloqué sur /login, l'application réessaie, ce
 * qui consomme encore le quota.
 *
 * Le garde-fou est posé dans sessionStorage plutôt que dans un état React :
 * il doit survivre aux navigations et aux rechargements de page à
 * l'intérieur d'un même onglet, ce qu'un useRef ne fait pas. Un nouvel
 * onglet refera l'appel une fois, ce qui est le comportement voulu : la
 * route est idempotente et ce seul appel ne coûte rien.
 */
const PREFIXE_CLE = "facilite:confirm-after-login:";

export function notifierConnexion(session) {
  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) return;

  const cle = `${PREFIXE_CLE}${userId}`;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(cle)) return;
      // Posé AVANT l'appel : deux événements SIGNED_IN rapprochés (rafraîchissement
      // de jeton pendant que la requête est en vol) ne doivent pas en déclencher deux.
      sessionStorage.setItem(cle, String(Date.now()));
    }
  } catch {
    // Navigation privée, stockage bloqué : on laisse passer l'appel plutôt
    // que de priver l'utilisateur de la reprise de son compte.
  }

  fetch("/api/auth/confirm-after-login", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
