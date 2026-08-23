// Outil b — modification du CV créé à l'éditeur (JSON). Écrit une donnée
// réelle : confirmation obligatoire avant toute exécution (voir dispatcher,
// src/lib/aiTools/index.js).
const editCreatedCv = {
  name: "modifier_cv_cree",
  description:
    "Propose une modification du contenu JSON d'un CV créé à l'éditeur Facilité (resumes.content) — ajouter/mettre à jour une expérience, une formation, une compétence, etc. N'écrit jamais directement : la modification doit être confirmée explicitement par le candidat avant d'être appliquée.",
  parameters: {
    type: "OBJECT",
    properties: {
      resumeId: { type: "STRING", description: "L'identifiant (UUID) du CV créé à modifier." },
      patch: {
        type: "OBJECT",
        description:
          "Un objet JSON représentant les champs à ajouter ou remplacer dans le contenu du CV (fusion superficielle avec le contenu existant, jamais un remplacement intégral).",
      },
      resume: {
        type: "STRING",
        description: "Résumé en une phrase, en français, de ce que ce patch va changer — affiché au candidat avant confirmation.",
      },
    },
    required: ["resumeId", "patch", "resume"],
  },
  requiresConfirmation: true,

  /**
   * Vérifie que le CV appartient bien à l'appelant ET qu'il s'agit d'un CV
   * "créé" (type='created', contenu JSON) — un CV importé (type='imported',
   * simple fichier) n'a pas de contenu JSON éditable par ce biais.
   */
  async guard({ user, supabase, args }) {
    const { resumeId } = args || {};
    if (!resumeId) throw new Error("resumeId manquant.");

    const { data, error } = await supabase
      .from("resumes")
      .select("id, user_id, type")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .eq("type", "created")
      .maybeSingle();

    if (error || !data) {
      throw new Error("CV introuvable, non modifiable par cet outil (pas un CV créé à l'éditeur), ou n'appartenant pas à ce candidat.");
    }
    return true;
  },

  /**
   * N'est appelé qu'APRÈS confirmation explicite du candidat (voir
   * dispatcher). `supabase` est le client scopé par le token de
   * l'utilisateur : l'UPDATE passe par la même RLS ("Users can manage their
   * own resumes") que l'éditeur lui-même, jamais service_role.
   */
  async execute({ args, supabase }) {
    const { resumeId, patch } = args;

    const { data: current, error: fetchError } = await supabase
      .from("resumes")
      .select("content")
      .eq("id", resumeId)
      .single();

    if (fetchError) {
      return { success: false, error: `Impossible de lire le CV : ${fetchError.message}` };
    }

    const mergedContent = { ...(current?.content || {}), ...(patch || {}) };

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ content: mergedContent })
      .eq("id", resumeId);

    if (updateError) {
      return { success: false, error: `Échec de l'écriture : ${updateError.message}` };
    }

    return { success: true, updatedFields: Object.keys(patch || {}) };
  },
};

export default editCreatedCv;
