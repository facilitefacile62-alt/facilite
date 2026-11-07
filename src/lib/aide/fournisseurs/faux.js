// Fournisseur « faux » : réponses fixes, aucun réseau, aucun coût. Mode par défaut partout.
// Le mot « inconnu » dans le message simule une question que l'IA ne sait pas traiter (passage à l'équipe).
export const MARQUEUR_EQUIPE = "[[EQUIPE]]";

export function creerFournisseurFaux() {
  return {
    nom: "faux",
    async repondre({ messages }) {
      const dernier = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      const texte = /inconnu/i.test(dernier)
        ? MARQUEUR_EQUIPE
        : "Réponse automatique de test (mode faux) : aucune vraie IA n'a été appelée.";
      return { texte, jetonsEntree: 0, jetonsSortie: 0, jetonsCache: 0, modele: "faux" };
    },
  };
}
