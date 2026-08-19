"use client";

import { supabase } from "@/lib/supabase";

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
        path: "/candidat/extracteur",
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
        path: "/fonctionnalites",
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
      {
        id: "feat_diagnostic_cv",
        name: "Diagnostic CV Gratuit (Widget & Scan ATS)",
        path: "/diagnostic-cv",
        icon: "🩺",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Widget d'analyse IA et scanner de CV sur la page d'accueil",
      },
      {
        id: "feat_card_pret_candidature",
        name: "Prêt pour votre candidature ? (Concevoir mon CV)",
        path: "/service",
        icon: "💡",
        enabled: true,
        roles: { user: true, recruiter: true, visitor: true },
        description: "Carte latérale d'incitation à la création et conception de CV",
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

const TABLE = "feature_flags";

/**
 * Lit les overrides (enabled/roles) depuis Supabase — source commune à tous
 * les navigateurs, contrairement à l'ancien localStorage. Fail-open : une
 * Map vide en cas d'erreur réseau (mergeFeatureFlagsTree retombe alors sur
 * DEFAULT_FEATURE_TREE, tout activé — jamais un blocage sur panne Supabase).
 * @returns {Promise<Map<string, {enabled: boolean, roles: object}>>}
 */
export async function fetchFeatureFlagsOverrides() {
  try {
    const { data, error } = await supabase.from(TABLE).select("id, enabled, roles");
    if (error) throw error;
    return new Map((data || []).map((r) => [r.id, { enabled: r.enabled, roles: r.roles }]));
  } catch (err) {
    console.warn("[FeatureFlags] Erreur lecture Supabase (repli sur défauts activés) :", err.message);
    return new Map();
  }
}

/**
 * Fusion pure DEFAULT_FEATURE_TREE + overrides Supabase — même logique de
 * fusion que l'ancienne version localStorage, juste paramétrée pour être
 * testable/réutilisable indépendamment de la source des overrides.
 * @param {Map<string, {enabled: boolean, roles: object}>} overridesMap
 */
export function mergeFeatureFlagsTree(overridesMap) {
  return DEFAULT_FEATURE_TREE.map((branch) => ({
    ...branch,
    children: branch.children.map((feat) => {
      const o = overridesMap.get(feat.id);
      if (!o) return feat;
      return {
        ...feat,
        enabled: typeof o.enabled === "boolean" ? o.enabled : feat.enabled,
        roles: o.roles ? { ...feat.roles, ...o.roles } : feat.roles,
      };
    }),
  }));
}

/**
 * Raccourci fetch + fusion — l'arbre complet prêt à l'affichage/au contrôle.
 */
export async function getFeatureFlagsTreeAsync() {
  return mergeFeatureFlagsTree(await fetchFeatureFlagsOverrides());
}

/**
 * Écrit un lot d'overrides — une requête UPDATE par ligne (jamais upsert :
 * les 23 lignes existent déjà depuis le seed de la migration, l'app ne crée
 * jamais de nouvelle ligne ; upsert() émet un INSERT ... ON CONFLICT côté
 * PostgREST, qui exige un GRANT INSERT même quand la ligne existe déjà — la
 * policy/GRANT de cette table n'autorisent délibérément qu'UPDATE, moindre
 * privilège). RLS restreint déjà l'écriture aux admins — un appel par un
 * non-admin renvoie une erreur (0 ligne affectée), jamais d'exception.
 * @param {Array<{id: string, enabled: boolean, roles: object}>} rows
 */
export async function persistFeatureFlagsOverrides(rows) {
  const results = await Promise.all(
    rows.map((r) =>
      supabase
        .from(TABLE)
        .update({ enabled: r.enabled, roles: r.roles, updated_at: new Date().toISOString() })
        .eq("id", r.id)
    )
  );
  const failed = results.find((res) => res.error);
  return { error: failed?.error || null };
}

/**
 * Vérifie si une fonctionnalité est autorisée pour un rôle donné — PURE et
 * SYNCHRONE : prend l'arbre déjà chargé en paramètre au lieu de le relire
 * depuis un stockage interne, pour permettre un contrôle instantané à
 * chaque clic (Header.jsx) sans aller-retour réseau.
 * @param {Array} flagsTree - arbre déjà chargé (getFeatureFlagsTreeAsync)
 * @param {string} featureIdOrPath - ID de la fonctionnalité ou chemin (ex: 'nav_plus_service' ou '/service')
 * @param {string} userRole - 'admin' | 'publisher' | 'recruiter' | 'user' | 'visitor'
 * @returns {boolean}
 */
export function isFeatureAllowed(flagsTree, featureIdOrPath, userRole = "visitor") {
  // L'administrateur a TOUJOURS accès à tout
  if (userRole === "admin") return true;

  let found = null;

  for (const branch of flagsTree) {
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
