// Outil d — banque d'information : interrogation en lecture seule des
// candidats, offres et commandes pour un administrateur.
//
// RÈGLE CENTRALE, non négociable (incident du 2026-08-18) : cet outil ne
// renvoie JAMAIS le contenu d'un document, ni une URL permettant de
// l'atteindre. Il ne fait pas non plus son propre contrôle d'accès aux
// documents — il s'appuie sur celui qui existe déjà en base. La policy
// « Un admin lit tous les CV » sur public.resumes appelle
// can_admin_read_document(candidate_id, auth.uid()), qui n'accepte qu'une
// demande document_access_requests au statut 'approved' et non expirée.
//
// Comme `supabase` est ici toujours le client scopé par le token de
// l'appelant (voir le contrat du registre dans ./index.js), une ligne de
// resumes non consentie n'arrive tout simplement jamais jusqu'à ce code.
// C'est volontaire : réimplémenter la règle ici créerait un second endroit
// où elle pourrait diverger.
const queryDataBank = {
  name: "interroger_banque_donnees",
  description:
    "Interroge la banque d'information de Facilité pour un administrateur : candidats inscrits, offres publiées, ou commandes. Renvoie des informations non confidentielles et des compteurs. Ne donne jamais accès au contenu d'un CV ou d'une lettre de motivation : indique seulement combien de documents sont consultables et combien nécessitent une demande d'accès au candidat.",
  parameters: {
    type: "OBJECT",
    properties: {
      entite: {
        type: "STRING",
        enum: ["candidats", "offres", "commandes"],
        description: "Ce qu'il faut interroger.",
      },
      recherche: {
        type: "STRING",
        description:
          "Filtre texte optionnel. Pour les candidats : nom ou ville. Pour les offres : intitulé ou entreprise. Ignoré pour les commandes.",
      },
      limite: {
        type: "NUMBER",
        description: "Nombre maximum de lignes à renvoyer (défaut 20, plafond 50).",
      },
    },
    required: ["entite"],
  },
  requiresConfirmation: false,

  // Réservé aux administrateurs. is_admin() est la fonction déjà utilisée
  // par /admin (voir admin/page.js) : une seule définition du statut admin.
  async guard({ user, supabase }) {
    if (!user?.id) {
      throw new Error("Session absente.");
    }
    const { data, error } = await supabase.rpc("is_admin", { check_user_id: user.id });
    if (error || data !== true) {
      throw new Error("La banque d'information est réservée aux administrateurs.");
    }
    return true;
  },

  async execute({ args, supabase }) {
    const entite = args?.entite;
    const recherche = (args?.recherche || "").trim();
    // Plafond dur : le résultat repart dans le contexte du modèle, une
    // requête sans limite le ferait exploser en tokens pour rien.
    const limite = Math.min(Math.max(Number(args?.limite) || 20, 1), 50);

    if (entite === "candidats") {
      return await interrogerCandidats({ supabase, recherche, limite });
    }
    if (entite === "offres") {
      return await interrogerOffres({ supabase, recherche, limite });
    }
    if (entite === "commandes") {
      return await interrogerCommandes({ supabase, limite });
    }
    return { success: false, error: `Entité inconnue : "${entite}".` };
  },
};

/**
 * Champs volontairement limités à ce qu'un administrateur peut voir sans
 * consentement : identité affichée, localisation, niveau d'études, et des
 * compteurs. Pas de téléphone, pas de date de naissance, pas de bio —
 * disponibles sur la fiche candidat de la page, jamais dans une réponse
 * d'assistant qui pourrait être recopiée ailleurs.
 */
async function interrogerCandidats({ supabase, recherche, limite }) {
  let requete = supabase
    .from("profiles")
    .select("id, full_name, city, country, education_level, created_at, is_public")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (recherche) {
    requete = requete.or(`full_name.ilike.%${recherche}%,city.ilike.%${recherche}%`);
  }

  const { data, error } = await requete;
  if (error) {
    return { success: false, error: `Lecture des candidats impossible : ${error.message}` };
  }

  const candidats = [];
  for (const p of data || []) {
    // Compte les documents que la RLS laisse effectivement passer. Un 0 ne
    // distingue pas « aucun CV » de « CV existant mais non consenti » — et
    // c'est le comportement voulu : l'absence de consentement ne doit pas
    // se transformer en signal exploitable.
    const { count } = await supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", p.id);

    candidats.push({
      nom: p.full_name || "(sans nom)",
      ville: p.city || p.country || null,
      niveau_etudes: p.education_level || null,
      profil_public: p.is_public === true,
      inscrit_le: p.created_at ? String(p.created_at).slice(0, 10) : null,
      documents_consultables: count ?? 0,
    });
  }

  return {
    success: true,
    entite: "candidats",
    nombre: candidats.length,
    candidats,
    note:
      "documents_consultables ne compte que les documents déjà autorisés par le candidat. Pour les autres, une demande d'accès motivée doit être faite depuis la banque d'information ; l'assistant ne peut pas la créer.",
  };
}

async function interrogerOffres({ supabase, recherche, limite }) {
  let requete = supabase
    .from("job_offers")
    .select("id, title, company, location, contract_type, status, is_active, deadline, view_count, created_at, min_education_level")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (recherche) {
    requete = requete.or(`title.ilike.%${recherche}%,company.ilike.%${recherche}%`);
  }

  const { data, error } = await requete;
  if (error) {
    return { success: false, error: `Lecture des offres impossible : ${error.message}` };
  }

  const maintenant = Date.now();
  const offres = (data || []).map((o) => ({
    intitule: o.title,
    entreprise: o.company,
    lieu: o.location || null,
    contrat: o.contract_type || null,
    statut: o.status || (o.is_active ? "active" : "inactive"),
    // L'expiration est calculée ici plutôt que filtrée en base : une offre
    // dont la date est passée mais le statut resté 'active' est justement
    // l'anomalie qu'un administrateur veut repérer.
    expiree: o.deadline ? new Date(o.deadline).getTime() < maintenant : false,
    echeance: o.deadline ? String(o.deadline).slice(0, 10) : null,
    niveau_requis: o.min_education_level || null,
    vues: o.view_count ?? 0,
  }));

  return { success: true, entite: "offres", nombre: offres.length, offres };
}

async function interrogerCommandes({ supabase, limite }) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, amount, currency, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) {
    return { success: false, error: `Lecture des commandes impossible : ${error.message}` };
  }

  const commandes = (data || []).map((o) => ({
    montant: o.amount,
    devise: o.currency || "XOF",
    statut: o.payment_status,
    moyen: o.payment_method || null,
    date: o.created_at ? String(o.created_at).slice(0, 10) : null,
  }));

  // payment_reference et invoice_url sont volontairement absents : ce sont
  // des identifiants de rapprochement chez le prestataire de paiement, ils
  // n'ont rien à faire dans une réponse conversationnelle.
  const parStatut = {};
  for (const c of commandes) {
    parStatut[c.statut] = (parStatut[c.statut] || 0) + 1;
  }

  return { success: true, entite: "commandes", nombre: commandes.length, repartition_par_statut: parStatut, commandes };
}

export default queryDataBank;
