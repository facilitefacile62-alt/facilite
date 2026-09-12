"use client";

// Persistance du dernier univers utilisé (Facilité / Facilité Business) —
// implémentation web (localStorage), distincte et volontairement séparée
// de l'équivalent mobile (mobile/src/lib/userMode.ts, AsyncStorage) : deux
// codebases différentes, pas de logique partagée entre elles.
//
// N'impose jamais de choix — sert uniquement, une fois qu'un utilisateur a
// déjà visité l'un des deux univers, à faire revenir le logo/lien Accueil
// du header vers celui qu'il a utilisé en dernier (voir Header.jsx). Un
// nouvel utilisateur (aucune valeur stockée) atterrit toujours sur
// Facilité par défaut, jamais sur Facilité Business.
const CLE_USER_MODE = "facilite_user_mode";

export function obtenirUserMode() {
  if (typeof window === "undefined") return "facilite";
  try {
    return window.localStorage.getItem(CLE_USER_MODE) === "business" ? "business" : "facilite";
  } catch {
    // Stockage indisponible (navigation privée, quota plein...) : dégrade
    // silencieusement vers le défaut, jamais une erreur visible.
    return "facilite";
  }
}

export function definirUserMode(mode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_USER_MODE, mode === "business" ? "business" : "facilite");
  } catch {
    // Best-effort : un échec d'écriture ne doit jamais bloquer la navigation.
  }
}
