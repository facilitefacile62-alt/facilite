// --- LISTE OFFICIELLE DES MODÈLES DE CV DU STUDIO & FACTURATION ---
export const cvTemplates = [
  { id: "entrepreneur", num: 1, name: "Modèle 1 — Entrepreneur Pro", category: "Officiel Facilité (Photo & 2 Col)", icon: "fa-rocket", previewUrl: "/model4.png", accentColor: "#10E688" },
  { id: "modern", num: 2, name: "Modèle 2 — Moderne", category: "2 Colonnes structuré", icon: "fa-grip", previewUrl: "/model1.png", accentColor: "#2563EB" },
  { id: "minimalist", num: 3, name: "Modèle 3 — Minimaliste", category: "Aéré & Moderne", icon: "fa-align-left", previewUrl: "/model2.png", accentColor: "#0EA5E9" },
  { id: "classic", num: 4, name: "Modèle 4 — Classique", category: "Traditionnel & Chic", icon: "fa-newspaper", previewUrl: "/model3.png", accentColor: "#475569" },
  { id: "executif", num: 5, name: "Modèle 5 — Exécutif", category: "Bandeau formel & dense", icon: "fa-briefcase", previewUrl: "/model5.png", accentColor: "#1E293B" },
  { id: "creatif", num: 6, name: "Modèle 6 — Créatif", category: "Coloré & asymétrique", icon: "fa-palette", previewUrl: "/model6.png", accentColor: "#8B5CF6" },
  { id: "technique", num: 7, name: "Modèle 7 — Technique", category: "Grille de compétences", icon: "fa-code", previewUrl: "/model7.png", accentColor: "#059669" },
  { id: "professionnel", num: 8, name: "Modèle 8 — Professionnel Canva", category: "Style Canva 1:1 (Cadres & Badges)", icon: "fa-palette", previewUrl: "/model8.png", accentColor: "#382F2D" },
  { id: "elegance", num: 9, name: "Modèle 9 — Élégance", category: "Sidebar noire, touches dorées", icon: "fa-crown", previewUrl: "/model9.png", accentColor: "#B45309" }
];

export const DEFAULT_TEMPLATE_ID = "entrepreneur";

export const CV_MODEL_LABELS = {
  entrepreneur: "Modèle Entrepreneur Pro",
  modern: "Modèle Moderne",
  minimalist: "Modèle Minimaliste",
  classic: "Modèle Classique",
  executif: "Modèle Exécutif",
  creatif: "Modèle Créatif",
  technique: "Modèle Technique",
  professionnel: "Modèle Professionnel Canva",
  elegance: "Modèle Élégance"
};

// Aliases mapping pour URLs (?template=1, ?template=s1, ?template=minimal, ?template=elegance...)
export const TEMPLATE_ALIASES = {
  "1": "entrepreneur",
  "s1": "entrepreneur",
  "entrepreneur": "entrepreneur",
  "2": "modern",
  "s2": "modern",
  "modern": "modern",
  "moderne": "modern",
  "3": "minimalist",
  "s3": "minimalist",
  "minimal": "minimalist",
  "minimalist": "minimalist",
  "minimaliste": "minimalist",
  "4": "classic",
  "s4": "classic",
  "classic": "classic",
  "classique": "classic",
  "5": "executif",
  "s5": "executif",
  "executif": "executif",
  "executive": "executif",
  "6": "creatif",
  "s6": "creatif",
  "creatif": "creatif",
  "creative": "creatif",
  "7": "technique",
  "s7": "technique",
  "technique": "technique",
  "technical": "technique",
  "8": "professionnel",
  "s8": "professionnel",
  "professionnel": "professionnel",
  "professional": "professionnel",
  "9": "elegance",
  "s9": "elegance",
  "elegance": "elegance",
  "élégance": "elegance"
};

/**
 * Résout de façon 100% sécurisée un ID ou alias de template avec fallback silencieux sur le modèle par défaut.
 * Empêche tout ReferenceError ou plantage si le paramètre URL est invalide ou absent.
 */
export function resolveTemplateId(param) {
  if (!param) return DEFAULT_TEMPLATE_ID;
  const normalized = String(param).trim().toLowerCase();
  if (TEMPLATE_ALIASES[normalized]) {
    return TEMPLATE_ALIASES[normalized];
  }
  const exists = cvTemplates.some(t => t.id === normalized);
  return exists ? normalized : DEFAULT_TEMPLATE_ID;
}

export function labelForCvModel(cvModelId) {
  return CV_MODEL_LABELS[cvModelId] || cvModelId || "Modèle Standard";
}
