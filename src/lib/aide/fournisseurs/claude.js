// Fournisseur « api » : API Messages de Claude (petit modèle Haiku). La clé ANTHROPIC_API_KEY n'est lue
// que côté serveur, au moment de l'appel : jamais dans l'application, jamais dans un fichier.
//
// DOUBLE VERROU : en plus de la clé, l'appel réel exige AIDE_AUTORISER_APPEL_REEL=oui. Tant que cette
// variable n'a pas été posée (après achat de crédits et « go » explicite), rien ne part vers Anthropic,
// même si la clé existe déjà dans Vercel.
import { MODELE_PAR_DEFAUT } from "../tarifs.js";

const URL_API = "https://api.anthropic.com/v1/messages";

export function appelReelAutorise(env = process.env) {
  return String(env?.AIDE_AUTORISER_APPEL_REEL || "").toLowerCase() === "oui" && Boolean(env?.ANTHROPIC_API_KEY);
}

export function creerFournisseurClaude({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return {
    nom: "api",
    async repondre({ systeme, messages, maxTokens }) {
      if (!appelReelAutorise(env)) throw new Error("Appel réel à l'API non autorisé.");
      const modele = env.AIDE_MODELE || MODELE_PAR_DEFAUT;
      const res = await fetchImpl(URL_API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modele,
          max_tokens: maxTokens,
          // Le prompt système est identique d'un appel à l'autre : on le marque pour le cache (lecture à 0,01 $/M).
          system: [{ type: "text", text: systeme, cache_control: { type: "ephemeral" } }],
          messages,
        }),
      });
      if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
      const json = await res.json();
      const texte = (json?.content || []).filter((b) => b?.type === "text").map((b) => b.text).join("").trim();
      const u = json?.usage || {};
      return {
        texte,
        // Jetons réellement renvoyés par l'API (c'est sur eux que le plafond de dépense compte).
        jetonsEntree: Number(u.input_tokens) || 0,
        jetonsSortie: Number(u.output_tokens) || 0,
        jetonsCache: (Number(u.cache_read_input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0),
        modele,
      };
    },
  };
}
