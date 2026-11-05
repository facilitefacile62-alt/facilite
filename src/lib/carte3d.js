// Carte 3D (prototype) — interrupteur et contrôles d'appareil.
//
// INTERRUPTEUR : la carte 3D est ÉTEINTE par défaut en production. Elle s'allume si la variable NEXT_PUBLIC_CARTE_3D vaut « 1 » (à retirer / remettre à 0 sur Vercel pour la couper SANS redéployer
// le code), ou automatiquement sur les aperçus Vercel (NEXT_PUBLIC_VERCEL_ENV = « preview », variable posée par Vercel lui-même) pour que le prototype soit montrable sans réglage.
// La variable est lue au moment de la compilation : changer sa valeur demande un nouveau déploiement de la même version (pas de modification du code).
export function carte3dActive() {
  return process.env.NEXT_PUBLIC_CARTE_3D === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
}

/** Adresse de la carte 2D actuelle (Explorer de Locaux) : repli quand la 3D n'est pas possible. */
export const ADRESSE_CARTE_2D = "/marketplace?explorer=1&vue=carte";

/**
 * L'appareil peut-il afficher la 3D ? Refus si : pas de WebGL, mémoire de 2 Go ou moins, 2 cœurs ou moins, mode économie de données, connexion 2G.
 * Renvoie { ok: true } ou { ok: false, raison }. Les mesures absentes (Safari n'expose ni deviceMemory ni connection) ne bloquent jamais.
 */
export function peutAfficher3D() {
  if (typeof window === "undefined") return { ok: false, raison: "serveur" };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { ok: false, raison: "Votre appareil ne gère pas la 3D (WebGL absent)." };
  } catch {
    return { ok: false, raison: "Votre appareil ne gère pas la 3D (WebGL absent)." };
  }
  const nav = navigator;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return { ok: false, raison: "Appareil trop léger pour la 3D." };
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return { ok: false, raison: "Appareil trop léger pour la 3D." };
  const c = nav.connection;
  if (c && c.saveData) return { ok: false, raison: "Mode économie de données activé : la carte reste en 2D." };
  if (c && /(^|-)2g$/.test(String(c.effectiveType || ""))) return { ok: false, raison: "Connexion trop lente pour la 3D." };
  return { ok: true };
}
