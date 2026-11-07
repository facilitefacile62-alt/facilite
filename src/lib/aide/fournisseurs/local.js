// Fournisseur « local » : Ollama sur l'ordinateur du développeur. UNIQUEMENT en développement :
// en production (NODE_ENV différent de « development ») ce fournisseur refuse de répondre.
export function creerFournisseurLocal({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return {
    nom: "local",
    async repondre({ systeme, messages, maxTokens }) {
      if (env.NODE_ENV !== "development") throw new Error("Le fournisseur local n'existe qu'en développement.");
      const base = env.AIDE_OLLAMA_URL || "http://127.0.0.1:11434";
      const modele = env.AIDE_OLLAMA_MODELE || "llama3.2";
      const res = await fetchImpl(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: modele,
          stream: false,
          options: { num_predict: maxTokens },
          messages: [{ role: "system", content: systeme }, ...messages],
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const json = await res.json();
      return {
        texte: String(json?.message?.content || "").trim(),
        jetonsEntree: Number(json?.prompt_eval_count) || 0,
        jetonsSortie: Number(json?.eval_count) || 0,
        jetonsCache: 0,
        modele,
      };
    },
  };
}
