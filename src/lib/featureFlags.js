"use client";

export const DEFAULT_FEATURE_TREE = [
  {
    id: "branch_nav",
    name: "Navigation & Menu Principal",
    icon: "🧭",
    description: "Liens et boutons visibles dans l'en-tête et le menu déroulant",
    children: [
      {
        id: "nav_home",
        name: "Page d'Accueil",
        path: "/",
        icon: "🏠",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Accès à la page d'accueil principale",
      },
      {
        id: "nav_offres",
        name: "Offres d'emploi",
        path: "/offres",
        icon: "💼",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Filtrage et recherche des offres d'emploi publiques",
      },
      {
        id: "nav_extracteur",
        name: "Extracteur / Importer CV",
        path: "/importer-cv",
        icon: "⚡",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton direct vers l'outil d'importation et extraction de CV",
      },
      {
        id: "nav_messagerie",
        name: "Messagerie Échanges",
        path: "/messagerie",
        icon: "💬",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Interface de discussion en direct candidats / recruteurs",
      },
      {
        id: "nav_plus_importer",
        name: "Importer CV (Analyse IA et recommandations)",
        path: "/importer-cv",
        icon: "📄",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus pour l'import et l'analyse IA de CV",
      },
      {
        id: "nav_plus_fonctionnalites",
        name: "Fonctionnalités (Outils IA, Modèles & Recrutement)",
        path: "/service",
        icon: "✨",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers la vue d'ensemble des fonctionnalités",
      },
      {
        id: "nav_plus_service",
        name: "Services & Modèles (CVs Pro, Canada, Anglais & Lettres)",
        path: "/service",
        icon: "💼",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus menant aux modèles et services (/service)",
      },
      {
        id: "nav_plus_recrutement_spontane",
        name: "Recrutement Spontané (Répertoire des 77 entreprises)",
        path: "/recrutement-spontane",
        icon: "🏢",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers l'annuaire des 77 entreprises",
      },
      {
        id: "nav_plus_depots",
        name: "Dépôts Physiques (Stations-services & contacts)",
        path: "/recrutement-journalier",
        icon: "⛽",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers la liste des points de dépôt physiques",
      },
      {
        id: "nav_plus_concours",
        name: "Concours (Avis & examens de la fonction publique)",
        path: "/offres?q=Concours",
        icon: "🏆",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers les avis de concours publics",
      },
      {
        id: "nav_plus_formation",
        name: "Formation (Certifications & cours pro)",
        path: "/offres?q=Formation",
        icon: "🎓",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers les opportunités de formation",
      },
      {
        id: "nav_plus_boite_idees",
        name: "Boîte à idées (Suggestions & Innovation)",
        path: "/boite-a-idees",
        icon: "💡",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Bouton dans le menu Plus vers la boîte à idées communautaire",
      },
    ],
  },
  {
    id: "branch_candidat",
    name: "Espace Candidat & Création CV",
    icon: "🎓",
    description: "Outils de génération, optimisation et simulation d'entretiens",
    children: [
      {
        id: "feat_creer_cv",
        name: "Créateur de CV & Studio Canva",
        path: "/creer-cv",
        icon: "✏️",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Éditeur de CV interactif et intégration studio Canva",
      },
      {
        id: "feat_modeles_cv",
        name: "Catalogue Modèles 360°",
        path: "/modeles",
        icon: "🖼️",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Carrousel et catalogue interactif des modèles de CV",
      },
      {
        id: "feat_importer_cv",
        name: "Analyseur & Scanner IA de CV",
        path: "/importer-cv",
        icon: "🤖",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Extraction automatique par vision et conseils d'amélioration IA",
      },
      {
        id: "feat_simulation_entretien",
        name: "Simulation d'Entretien IA",
        path: "/simulation-entretien",
        icon: "🎙️",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Simulateur interactif d'entretien d'embauche avec scoring",
      },
      {
        id: "feat_candidat_dashboard",
        name: "Espace Candidat (Mes CVs / Candidatures)",
        path: "/candidat/mes-cvs",
        icon: "📁",
        enabled: true,
        roles: { user: true, recruiter: false, visitor: false },
        description: "Gestion des CVs enregistrés et suivi des candidatures envoyées",
      },
    ],
  },
  {
    id: "branch_recruteur",
    name: "Espace Recrutement & Entreprises",
    icon: "💼",
    description: "Publication d'offres, recherche de talents et accréditations",
    children: [
      {
        id: "feat_publier_offre",
        name: "Publication d'Offre d'Emploi",
        path: "/publier-offre",
        icon: "📢",
        enabled: true,
        roles: { user: false, recruiter: true, visitor: false },
        description: "Formulaire de dépôt d'offre avec validation et modération",
      },
      {
        id: "feat_recruteur_dashboard",
        name: "Tableau de Bord Recruteur",
        path: "/recruteur-dashboard",
        icon: "📊",
        enabled: true,
        roles: { user: false, recruiter: true, visitor: false },
        description: "Gestion des offres actives et des candidats reçus",
      },
      {
        id: "feat_recruteur_cvtheque",
        name: "CVthèque & Recherche Candidats",
        path: "/recruteur",
        icon: "👥",
        enabled: true,
        roles: { user: false, recruiter: true, visitor: false },
        description: "Recherche filtrée dans la base de profils de candidats",
      },
      {
        id: "feat_demande_badge",
        name: "Demande de Badge Vérifié",
        path: "/demande-badge",
        icon: "🎖️",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: false },
        description: "Procédure d'accréditation entreprise (NINEA, RCCM)",
      },
    ],
  },
  {
    id: "branch_services",
    name: "Services d'Accompagnement & Paiements",
    icon: "🛠️",
    description: "Commandes de rédaction sur-mesure et passerelle de paiement",
    children: [
      {
        id: "feat_commandes_agent",
        name: "Commandes & Accompagnement Agent",
        path: "/commandes-agent",
        icon: "🧑‍💼",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Prise en charge personnalisée de rédaction de CV par un conseiller",
      },
      {
        id: "feat_service_tarifs",
        name: "Grille Tarifaire & Abonnements",
        path: "/service",
        icon: "💳",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Visualisation des tarifs et offres d'optimisation",
      },
    ],
  },
];

const STORAGE_KEY = "facilite_feature_flags_tree";

/**
 * Récupère l'arbre des fonctionnalités depuis localStorage ou la valeur par défaut
 */
export function getFeatureFlagsTree() {
  if (typeof window === "undefined") return DEFAULT_FEATURE_TREE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_FEATURE_TREE;
    const parsed = JSON.parse(saved);

    // Fusion intelligente pour conserver les labels et icônes à jour tout en gardant les statuts activés/désactivés
    return DEFAULT_FEATURE_TREE.map((branch) => {
      const savedBranch = parsed.find((b) => b.id === branch.id);
      if (!savedBranch) return branch;
      return {
        ...branch,
        children: branch.children.map((feat) => {
          const savedFeat = savedBranch.children?.find((f) => f.id === feat.id);
          if (!savedFeat) return feat;
          return {
            ...feat,
            enabled: typeof savedFeat.enabled === "boolean" ? savedFeat.enabled : feat.enabled,
            roles: savedFeat.roles ? { ...feat.roles, ...savedFeat.roles } : feat.roles,
          };
        }),
      };
    });
  } catch (err) {
    console.warn("[FeatureFlags] Erreur lecture localStorage:", err);
    return DEFAULT_FEATURE_TREE;
  }
}

/**
 * Sauvegarde l'arbre des fonctionnalités et déclenche un événement de mise à jour instantanée
 */
export function saveFeatureFlagsTree(newTree) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTree));
    window.dispatchEvent(new CustomEvent("feature_flags_updated", { detail: newTree }));
  } catch (err) {
    console.error("[FeatureFlags] Erreur sauvegarde localStorage:", err);
  }
}

/**
 * Vérifie si une fonctionnalité est autorisée pour un rôle donné
 * @param {string} featureId - ID de la fonctionnalité ou chemin (ex: 'nav_plus_service' ou '/service')
 * @param {string} userRole - 'admin' | 'publisher' | 'recruiter' | 'user' | 'visitor'
 * @returns {boolean}
 */
export function isFeatureAllowed(featureIdOrPath, userRole = "visitor") {
  // L'administrateur a TOUJOURS accès à tout
  if (userRole === "admin") return true;

  const tree = getFeatureFlagsTree();
  let found = null;

  for (const branch of tree) {
    for (const feat of branch.children) {
      if (feat.id === featureIdOrPath || feat.path === featureIdOrPath) {
        found = feat;
        break;
      }
    }
    if (found) break;
  }

  if (!found) return true; // Par défaut autorisé si non restreint explicitement

  // Si le bouton maître est désactivé
  if (!found.enabled) return false;

  // Normalisation du rôle
  const roleKey =
    userRole === "verified_recruiter" || userRole === "recruiter"
      ? "recruiter"
      : userRole === "user" || userRole === "candidate"
      ? "user"
      : "visitor";

  return found.roles?.[roleKey] !== false;
}
