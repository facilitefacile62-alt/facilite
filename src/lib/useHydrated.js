import { useSyncExternalStore } from "react";

const abonnement = () => () => {};

/**
 * Faux pendant le rendu serveur et tant que la page n'est pas « hydratée » côté navigateur, vrai ensuite. Sert à
 * désactiver visuellement (avec un indicateur) les boutons dont l'action dépend du JavaScript : sur un réseau lent, ils
 * étaient affichés par le rendu serveur mais ne réagissaient pas au toucher pendant des dizaines de secondes.
 */
export function useHydrated() {
  return useSyncExternalStore(abonnement, () => true, () => false);
}
