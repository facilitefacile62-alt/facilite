// Réponses préparées de l'aide : gratuites, sans IA. Boutons de questions fréquentes, puis
// correspondance par mots-clés et intentions, puis questions de la FAQ de l'administration.
// Les réponses ne promettent aucun délai ni aucun prix : elles orientent vers la bonne page.
import { normaliserQuestion } from "./texte.js";

/**
 * Boutons affichés en haut du panneau. `liens` : pages à proposer avec la réponse. CHAQUE lien doit être une page
 * qui existe (src/app/<chemin>/page.js) et qui répond vraiment à la question : jamais /faq, jamais une recherche.
 * `repliSansLien` : réponse donnée à la place quand la page visée est fermée par un interrupteur du site
 * (un lien vers « fonctionnalité indisponible » ne répondrait à rien). Vérifié par tests/unit/aide-unifiee.spec.js.
 */
export const QUESTIONS_FREQUENTES = [
  {
    id: "postuler",
    libelle: "Comment postuler à une offre ?",
    mots: ["postuler", "candidature", "candidater", "envoyer cv", "offre emploi"],
    reponse:
      "Ouvrez une offre depuis la page Offres, puis touchez « Postuler via Facilité ». Vous pouvez choisir un CV déjà enregistré ou en ajouter un (PDF ou Word, 10 Mo maximum) et écrire un court message.",
    liens: [{ href: "/offres", libelle: "Voir les offres" }],
  },
  {
    id: "creer_cv",
    libelle: "Créer ou importer mon CV",
    mots: ["creer cv", "faire cv", "importer cv", "mon cv", "modele cv", "redaction cv"],
    reponse:
      "Pour créer votre CV, ouvrez « Créer mon CV ». Si vous en avez déjà un, utilisez « Importer mon CV » : Facilité lit le document et remplit vos informations, que vous pouvez corriger ensuite.",
    liens: [
      { href: "/creer-cv", libelle: "Créer mon CV" },
      { href: "/importer-cv", libelle: "Importer mon CV" },
    ],
  },
  {
    id: "mot_de_passe",
    libelle: "J'ai oublié mon mot de passe",
    mots: ["mot de passe", "mdp", "password", "reinitialiser", "connexion impossible", "me connecter"],
    reponse:
      "Sur la page de connexion, touchez « Mot de passe oublié » et suivez les étapes : un lien de réinitialisation vous est envoyé. Pensez à regarder aussi vos courriers indésirables.",
    liens: [{ href: "/forgot-password", libelle: "Réinitialiser mon mot de passe" }],
  },
  {
    id: "extracteur",
    libelle: "À quoi sert l'Extracteur ?",
    mots: ["extracteur", "extraire", "scanner document", "1 click", "1-click"],
    reponse:
      "L'Extracteur lit un document (photo ou PDF) et en tire les informations utiles, sans que vous ayez à tout retaper. Vérifiez toujours le résultat avant de l'utiliser.",
    liens: [{ href: "/candidat/extracteur", libelle: "Ouvrir l'Extracteur" }],
  },
  {
    id: "messages",
    libelle: "Où voir mes messages ?",
    mots: ["messages", "messagerie", "conversation", "discussion", "ou sont mes messages"],
    reponse: "Tous vos messages sont dans la Messagerie : discussions avec les recruteurs, les vendeurs et l'équipe Facilité.",
    liens: [{ href: "/messagerie", libelle: "Ouvrir la Messagerie" }],
  },
  {
    id: "compte",
    libelle: "Modifier ou supprimer mon compte",
    mots: ["modifier compte", "supprimer compte", "supprimer mon compte", "changer email", "changer numero", "informations compte"],
    reponse:
      "Vos informations (nom, e-mail, téléphone) se modifient dans « Informations du compte ». Pour supprimer votre compte, suivez la procédure expliquée sur la page de suppression : l'effacement n'est définitif qu'après un délai de 30 jours, et vous pouvez l'annuler en vous reconnectant avant.",
    liens: [
      { href: "/informations-compte", libelle: "Informations du compte" },
      { href: "/suppression-compte", libelle: "Supprimer mon compte" },
    ],
  },
  {
    id: "vendre",
    libelle: "Vendre ou acheter sur Locaux",
    mots: ["vendre", "marketplace", "locaux", "boutique", "article", "acheter", "annonce"],
    reponse:
      "Locaux est la place de marché de Facilité : vous pouvez y parcourir les articles et discuter avec un vendeur depuis sa fiche. Pour vendre, ouvrez d'abord votre boutique avec « Ma boutique », dans le menu de votre profil.",
    liens: [{ href: "/marketplace", libelle: "Ouvrir Locaux" }],
  },
  {
    id: "tarifs",
    libelle: "Quels sont les tarifs ?",
    mots: ["tarif", "prix", "combien", "payer", "paiement", "abonnement", "gratuit"],
    reponse: "Les tarifs à jour des services sont affichés sur la page Services. Je ne veux pas vous donner un prix approximatif : le montant exact y figure toujours.",
    liens: [{ href: "/service", libelle: "Voir les tarifs" }],
    repliSansLien:
      "La page des tarifs n'est pas ouverte pour le moment, et je ne veux pas vous donner un prix approximatif. Touchez « Parler à l'équipe » : un conseiller vous donnera le tarif exact.",
  },
];

/** Formulations qui demandent clairement une personne : on passe à l'équipe sans passer par l'IA. */
// Appliqués au texte NORMALISÉ (sans accents ni apostrophes : « l'équipe » devient « l equipe »).
const MOTIFS_HUMAIN = [
  /parler\s+(a|avec)\s+(quelqu\s?un|un\s+humain|une?\s+(vraie\s+)?personne|un\s+conseiller|un\s+agent|l\s?equipe|le\s+support)/,
  /(je\s+veux|je\s+voudrais|passez?\s+moi|mettez?\s+moi\s+en\s+relation\s+avec)\s+.*\b(humain|conseiller|agent|personne|equipe|support)\b/,
  /\b(vrai(e)?\s+personne|agent\s+humain|conseiller\s+humain)\b/,
  /plus\s+(parler\s+)?(a|avec)\s+un\s+robot/,
  /\bparler\s+a\s+l\s?equipe\b/,
];

export function demandeUnHumain(texte) {
  const t = normaliserQuestion(texte);
  return MOTIFS_HUMAIN.some((m) => m.test(t));
}

function mots(texteNormalise) {
  return new Set(texteNormalise.split(" ").filter((m) => m.length > 2));
}

/**
 * Trouve une réponse préparée. Ordre : (1) bouton exact, (2) FAQ de l'administration, (3) mots-clés et intentions.
 * @param {string} texte
 * @param {Array<{question: string, reponse: string}>} faqBase
 * @returns {{id: string, reponse: string, lien?: {href: string, libelle: string}} | null}
 */
export function trouverReponsePreparee(texte, faqBase = []) {
  const q = normaliserQuestion(texte);
  if (q.length < 3) return null;

  // 1. Bouton cliqué tel quel.
  for (const item of QUESTIONS_FREQUENTES) if (normaliserQuestion(item.libelle) === q) return item;

  // 2. FAQ de l'administration (contenu rédigé par l'équipe, plus précis que les mots-clés) :
  //    recouvrement de mots (Jaccard) d'au moins 0,6.
  const motsQ = mots(q);
  if (motsQ.size >= 2) {
    let trouvee = null;
    let scoreFaq = 0;
    for (const f of faqBase) {
      const motsF = mots(normaliserQuestion(f.question));
      if (!motsF.size) continue;
      let commun = 0;
      for (const m of motsQ) if (motsF.has(m)) commun++;
      const jaccard = commun / (motsQ.size + motsF.size - commun);
      if (jaccard > scoreFaq) {
        scoreFaq = jaccard;
        trouvee = f;
      }
    }
    if (trouvee && scoreFaq >= 0.6) return { id: "faq", reponse: String(trouvee.reponse) };
  }

  // 3. Mots-clés et intentions (expressions plus longues = plus de poids).
  let meilleur = null;
  let meilleurScore = 0;
  for (const item of QUESTIONS_FREQUENTES) {
    let score = 0;
    for (const mot of item.mots) {
      if (q.includes(normaliserQuestion(mot))) score += mot.trim().includes(" ") ? 2 : 1;
    }
    if (score > meilleurScore) {
      meilleur = item;
      meilleurScore = score;
    }
  }
  if (meilleur && meilleurScore >= 1) return meilleur;
  return null;
}
