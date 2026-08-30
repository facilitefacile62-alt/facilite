import searchOffersByDomain from "./searchOffersByDomain";
import editCreatedCv from "./editCreatedCv";
import compressImportedCv from "./compressImportedCv";
import queryDataBank from "./queryDataBank";
import findTransportRoute from "./findTransportRoute";

/**
 * Registre d'outils de l'assistant IA — chaque outil est un module qui
 * exporte { name, description, parameters (JSON Schema Gemini),
 * requiresConfirmation, guard(ctx), execute(ctx) }.
 *
 * Ajouter un outil plus tard = créer un fichier sur ce même modèle dans ce
 * dossier, puis l'ajouter au tableau ci-dessous. Rien d'autre à modifier :
 * ni /api/ai-chat, ni le dispatcher, ni le prompt (les déclarations sont
 * envoyées dynamiquement au modèle).
 */
export const AI_TOOLS = [searchOffersByDomain, editCreatedCv, compressImportedCv, queryDataBank, findTransportRoute];

const TOOLS_BY_NAME = new Map(AI_TOOLS.map((t) => [t.name, t]));

/** Déclarations au format attendu par l'API Gemini (`tools[0].functionDeclarations`). */
export function getGeminiFunctionDeclarations() {
  return AI_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/**
 * Déclarations des outils utilisables PENDANT le tunnel de conversation CV.
 *
 * Le fil candidat est piloté par une machine à états qui impose un
 * responseSchema à Gemini — or l'API refuse responseSchema et function
 * calling dans le même appel. Les outils étaient donc purement et simplement
 * désactivés dans la vraie messagerie : « Je veux aller à Pikine » ne
 * déclenchait jamais chercher_itineraire, et le tunnel répondait par son
 * argumentaire CV.
 *
 * La route fait désormais un appel de ROUTAGE distinct, sans responseSchema,
 * avec ces déclarations-ci. Seuls les outils sans confirmation y figurent :
 * une action qui demande l'accord explicite du candidat (modifier son CV, le
 * compresser) n'a rien à faire au milieu d'une étape du tunnel, où elle
 * détournerait la conversation de son fil.
 */
export function getDeclarationsHorsTunnel() {
  return AI_TOOLS.filter((t) => t.requiresConfirmation !== true).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function getTool(name) {
  return TOOLS_BY_NAME.get(name) || null;
}

/**
 * Exécute un appel d'outil proposé par le modèle.
 *
 * Règle transversale (tous outils, présents et futurs) : `supabase` DOIT
 * être le client scopé par le token Bearer de l'utilisateur courant, jamais
 * un client service_role — la RLS s'applique donc exactement comme si le
 * candidat agissait lui-même depuis l'UI. `guard` est toujours appelé avant
 * `execute`, y compris pour un outil sans confirmation.
 *
 * `requiresConfirmation` n'est PAS appliqué ici : c'est à l'appelant
 * (/api/ai-chat) de décider, selon qu'il s'agit d'un premier appel du
 * modèle ou d'une confirmation explicite déjà obtenue, s'il doit appeler
 * runToolCall ou renvoyer une proposition à confirmer.
 */
export async function runToolCall(name, args, { user, supabase }) {
  const tool = getTool(name);
  if (!tool) {
    return { success: false, error: `Outil inconnu : "${name}".` };
  }

  try {
    await tool.guard({ user, supabase, args });
  } catch (err) {
    return { success: false, error: err.message || "Action refusée." };
  }

  try {
    return await tool.execute({ user, supabase, args });
  } catch (err) {
    return { success: false, error: err.message || "Échec de l'exécution de l'outil." };
  }
}
