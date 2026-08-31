// Outil e — itinéraires de transport à Dakar.
//
// RÈGLE CENTRALE, non négociable : cet outil ne renvoie QUE des lignes
// enregistrées dans public.transport_routes. Le modèle ne doit jamais
// compléter, deviner ni extrapoler un itinéraire.
//
// Ce n'est pas une précaution de principe. Dakar est suffisamment documentée
// sur le web pour qu'un modèle produise des lignes, des numéros et des tarifs
// parfaitement plausibles — et faux. Quelqu'un enverrait alors une personne
// attendre un car rapide qui ne passe pas là, peut-être avant un entretien
// d'embauche. Un « je ne sais pas » vaut infiniment mieux.
//
// Deux garde-fous complémentaires :
//  1. la `description` ci-dessous interdit explicitement l'invention — c'est
//     elle que le modèle lit, pas ce commentaire ;
//  2. `execute` renvoie toujours un champ `aucun_resultat` explicite plutôt
//     qu'un tableau vide, et une `consigne` rappelant la règle dans la charge
//     utile elle-même. Un tableau vide seul est exactement le genre de silence
//     qu'un modèle comble de lui-même.
// Une coordonnée absente doit ressortir null, jamais 0.
//
// `Number(null)` vaut 0, et 0 passe Number.isFinite sans broncher : un arrêt
// dont le relevé GPS manque — il en existe dans le référentiel — se retrouvait
// dessiné à la latitude 0, longitude 0, dans le golfe de Guinée. La carte
// s'étirait alors de la Mauritanie au Nigeria et le trajet devenait illisible.
// Le test automatique ne le voyait pas : le point EXISTAIT bien, il était
// simplement à trois mille kilomètres.
const coordonnee = (valeur) => {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
};

const findTransportRoute = {
  name: "chercher_itineraire",
  description:
    "Cherche comment se déplacer à Dakar vers une destination donnée, à partir de la position GPS de l'utilisateur. Les résultats proviennent EXCLUSIVEMENT du référentiel de lignes de Facilité (Tata, TER, BRT, VTC, car rapide). " +
    "INTERDICTION ABSOLUE d'inventer, de compléter ou de deviner une ligne, un numéro, un arrêt, un horaire ou un tarif qui ne figure pas dans la réponse de cet outil. " +
    "Si l'outil ne renvoie aucun résultat, dis simplement que le trajet n'est pas encore répertorié et propose à la personne de demander son ajout — ne propose JAMAIS d'itinéraire de mémoire, même si tu penses connaître la ville.",
  parameters: {
    type: "OBJECT",
    properties: {
      destination: {
        type: "STRING",
        description: "Le lieu où la personne veut se rendre, tel qu'elle l'a formulé (quartier, arrêt, ville).",
      },
      latitude: {
        type: "NUMBER",
        description: "Latitude de la position actuelle de l'utilisateur, en degrés décimaux.",
      },
      longitude: {
        type: "NUMBER",
        description: "Longitude de la position actuelle de l'utilisateur, en degrés décimaux.",
      },
      mode_prefere: {
        type: "STRING",
        enum: ["tata", "ter", "brt", "vtc", "car_rapide"],
        description: "Mode de transport souhaité. À omettre si la personne n'a pas exprimé de préférence.",
      },
    },
    required: ["destination", "latitude", "longitude"],
  },
  requiresConfirmation: false,

  // Lecture seule sur des lignes publiques : être authentifié suffit, ce que
  // la route appelante garantit déjà.
  async guard() {
    return true;
  },

  /**
   * `supabase` est TOUJOURS le client scopé par le jeton de l'appelant (voir
   * le contrat du registre dans ./index.js). rechercher_itineraires est
   * SECURITY DEFINER mais ne lit que des lignes actives, publiques par
   * policy : aucune donnée personnelle n'est en jeu.
   */
  async execute({ args, supabase }) {
    const destination = String(args?.destination || "").trim();
    const latitude = Number(args?.latitude);
    const longitude = Number(args?.longitude);

    if (!destination) {
      return { success: false, error: "Aucune destination fournie." };
    }
    // Bornes du globe, pas de Dakar : un utilisateur en déplacement doit
    // pouvoir interroger le référentiel, quitte à n'obtenir aucun résultat.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return {
        success: false,
        error: "Position GPS absente ou invalide. Demande à la personne d'autoriser la localisation, ou de préciser son quartier de départ.",
      };
    }

    const { data, error } = await supabase.rpc("rechercher_itineraires", {
      p_destination: destination,
      p_lat: latitude,
      p_lng: longitude,
      p_mode: args?.mode_prefere || null,
      p_rayon_km: 5,
      p_limite: 10,
    });

    if (error) {
      return { success: false, error: `Recherche d'itinéraire impossible : ${error.message}` };
    }

    const lignes = (data || []).map((r) => ({
      mode: r.mode,
      ligne: r.ligne || null,
      operateur: r.operateur || null,
      de: r.origine,
      vers: r.destination,
      arret_de_depart: r.arret_le_plus_proche,
      distance_a_pied_km: r.distance_km != null ? Math.round(r.distance_km * 10) / 10 : null,
      tarif_xof: r.tarif_min == null && r.tarif_max == null
        ? null
        : r.tarif_min === r.tarif_max
          ? String(r.tarif_min)
          : `${r.tarif_min ?? "?"} à ${r.tarif_max ?? "?"}`,
      details: r.description || null,
    }));

    if (lignes.length === 0) {
      return {
        success: true,
        aucun_resultat: true,
        destination,
        message:
          "Aucune ligne répertoriée pour ce trajet dans le référentiel Facilité. Ce n'est pas une absence de transport : c'est une absence dans nos données.",
        consigne:
          "Dis-le clairement à la personne et propose-lui de signaler le trajet pour qu'il soit ajouté. N'invente aucune ligne, aucun arrêt, aucun tarif.",
      };
    }

    // Géométrie destinée à l'affichage, PAS au modèle.
    //
    // Elle est rangée sous une clé préfixée d'un souligné et retirée par la
    // route avant l'appel de synthèse : soixante paires de coordonnées dans
    // le contexte du modèle coûtent cher et ne l'aident en rien — il rédige
    // à partir des noms et des tarifs, pas des latitudes. L'interface, elle,
    // en a besoin pour tracer la ligne.
    const carte = {
      destination,
      depart: { lat: latitude, lng: longitude },
      lignes: (data || []).map((r) => ({
        mode: r.mode,
        ligne: r.ligne || null,
        arret_de_depart: r.arret_le_plus_proche,
        arret: { lat: r.arret_lat, lng: r.arret_lng },
        distance_a_pied_km: r.distance_km != null ? Math.round(r.distance_km * 10) / 10 : null,
        // Repris du même calcul que la version texte : la carte et la phrase
        // de l'assistant doivent annoncer exactement le même tarif.
        tarif_xof:
          r.tarif_min == null && r.tarif_max == null
            ? null
            : r.tarif_min === r.tarif_max
              ? String(r.tarif_min)
              : `${r.tarif_min ?? "?"} à ${r.tarif_max ?? "?"}`,
        // Les arrêts sans coordonnées existent dans le référentiel (relevé
        // incomplet). Les garder ferait un tracé qui part au large de
        // l'Atlantique : on les écarte du dessin, ils restent en base.
        arrets: (Array.isArray(r.arrets) ? r.arrets : [])
          .slice()
          .sort((x, y) => (Number(x?.ordre) || 0) - (Number(y?.ordre) || 0))
          .map((a) => ({ nom: a?.nom || null, lat: coordonnee(a?.lat), lng: coordonnee(a?.lng) }))
          .filter((a) => a.lat !== null && a.lng !== null),
      })),
    };

    return {
      success: true,
      aucun_resultat: false,
      destination,
      nombre: lignes.length,
      lignes,
      _carte: carte,
      consigne:
        "Présente uniquement les lignes ci-dessus. N'ajoute aucun horaire, aucune correspondance et aucun tarif qui n'y figure pas.",
    };
  },
};

export default findTransportRoute;
