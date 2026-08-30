// Outil f — passer la main à un conseiller humain.
//
// RÈGLE CENTRALE : cet outil ne se déclenche que sur une demande EXPLICITE de
// la personne. Jamais parce que l'assistant patine, jamais « au cas où », et
// jamais dans l'autre sens — rien ici ne permet de renvoyer quelqu'un vers
// l'IA. Ce retour est réservé aux administrateurs (repondre_escalade).
//
// La raison de cette asymétrie : une escalade déclenchée d'office remplirait
// la file des conseillers de conversations que l'assistant traitait très bien,
// et le jour où la file déborde, les vraies demandes attendent derrière.
//
// Ce que l'outil fait concrètement : bascule le fil en « attente_humain » et
// notifie chaque administrateur actif. La conversation ne change pas de
// place — c'est le même fil, seul le statut change, et un bandeau l'annonce.
const requestHuman = {
  name: "demander_un_humain",
  description:
    "Transmet la conversation à un conseiller humain de Facilité. " +
    "À n'appeler QUE si la personne demande explicitement à parler à un humain, un conseiller, un agent ou une vraie personne — " +
    "par exemple « je veux parler à quelqu'un », « passez-moi un humain », « je ne veux plus parler à un robot ». " +
    "N'appelle JAMAIS cet outil de ta propre initiative : ni parce que tu ne comprends pas la question, ni parce que le sujet te dépasse, " +
    "ni pour clore une conversation difficile. Dans ces cas-là, reformule et redemande. " +
    "Après l'appel, dis simplement à la personne qu'un conseiller a été prévenu et qu'il répondra dans cette même conversation.",
  parameters: {
    type: "OBJECT",
    properties: {
      motif: {
        type: "STRING",
        description:
          "Ce que la personne cherche à obtenir, en une phrase, dans ses propres termes. Sert au conseiller à préparer sa réponse. Facultatif.",
      },
    },
    required: [],
  },
  requiresConfirmation: false,

  async guard({ user }) {
    if (!user?.id) {
      throw new Error("Connexion requise pour joindre un conseiller.");
    }
    return true;
  },

  /**
   * `supabase` est le client scopé au jeton de l'appelant. demander_un_humain
   * est SECURITY DEFINER et n'agit que sur le fil de auth.uid() : personne ne
   * peut escalader la conversation de quelqu'un d'autre.
   */
  async execute({ args, supabase }) {
    const motif = typeof args?.motif === "string" ? args.motif.trim().slice(0, 500) : null;

    const { data, error } = await supabase.rpc("demander_un_humain", { p_motif: motif || null });

    if (error) {
      return {
        success: false,
        error: `Impossible de joindre un conseiller pour le moment : ${error.message}`,
      };
    }

    const dejaHumain = data?.mode === "humain";
    return {
      success: true,
      mode: data?.mode,
      message: dejaHumain
        ? "Un conseiller suit déjà cette conversation."
        : "Un conseiller a été prévenu et répondra dans cette même conversation.",
      consigne:
        "Confirme-le simplement à la personne, dans sa langue. Ne promets aucun délai précis : tu n'en connais aucun. " +
        "Reste disponible pour continuer à l'aider en attendant.",
    };
  },
};

export default requestHuman;
