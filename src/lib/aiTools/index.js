import searchOffersByDomain from "./searchOffersByDomain";
import editCreatedCv from "./editCreatedCv";
import compressImportedCv from "./compressImportedCv";
import queryDataBank from "./queryDataBank";

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
export const AI_TOOLS = [searchOffersByDomain, editCreatedCv, compressImportedCv, queryDataBank];

const TOOLS_BY_NAME = new Map(AI_TOOLS.map((t) => [t.name, t]));

/** Déclarations au format attendu par l'API Gemini (`tools[0].functionDeclarations`). */
export function getGeminiFunctionDeclarations() {
  return AI_TOOLS.map((t) => ({
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
