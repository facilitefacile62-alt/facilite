// Outil c — compression d'un CV importé (fichier). Le seul moteur de
// compression PDF réel de ce dépôt est 100% côté navigateur (Canvas +
// PDF.js, voir src/lib/pdfCompression.js, extrait de
// FonctionnalitesClient.jsx) : il n'existe aucun équivalent Node exécutable
// côté serveur malgré sharp/pdf-lib en dépendances (confirmé le
// 2026-08-22). `execute` ne compresse donc rien lui-même : il valide la
// cible puis renvoie un signal que le CLIENT doit exécuter avec
// compressPdfFile(). Écrit potentiellement une donnée (remplacement du
// fichier) : confirmation obligatoire, comme modifier_cv_cree.
const compressImportedCv = {
  name: "compresser_cv_importe",
  description:
    "Propose de compresser un CV importé (fichier PDF) trop volumineux, en utilisant le moteur de compression du candidat (déclenché côté client). Ne compresse jamais directement côté serveur — prépare seulement l'action, à exécuter après confirmation.",
  parameters: {
    type: "OBJECT",
    properties: {
      resumeId: { type: "STRING", description: "L'identifiant (UUID) du CV importé à compresser." },
      resume: {
        type: "STRING",
        description: "Résumé en une phrase, en français, de l'action proposée — affiché au candidat avant confirmation.",
      },
    },
    required: ["resumeId", "resume"],
  },
  requiresConfirmation: true,

  async guard({ user, supabase, args }) {
    const { resumeId } = args || {};
    if (!resumeId) throw new Error("resumeId manquant.");

    const { data, error } = await supabase
      .from("resumes")
      .select("id, user_id, file_url")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .not("file_url", "is", null)
      .maybeSingle();

    if (error || !data) {
      throw new Error("CV introuvable, sans fichier à compresser, ou n'appartenant pas à ce candidat.");
    }
    return true;
  },

  /**
   * Ne touche à aucune donnée : valide simplement que la cible existe
   * toujours au moment de la confirmation, puis renvoie les informations
   * nécessaires au client pour lancer compressPdfFile() lui-même et
   * réimporter le résultat via le flux d'upload existant.
   */
  async execute({ args, supabase }) {
    const { resumeId } = args;

    const { data, error } = await supabase
      .from("resumes")
      .select("id, file_url, title")
      .eq("id", resumeId)
      .not("file_url", "is", null)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "CV introuvable ou sans fichier à compresser." };
    }

    return {
      success: true,
      action: "trigger_client_compression",
      resumeId: data.id,
      fileUrl: data.file_url,
      title: data.title,
    };
  },
};

export default compressImportedCv;
