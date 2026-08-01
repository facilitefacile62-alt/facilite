// Libellés lisibles des modèles de l'éditeur CV (creer-cv/page.js: selectedTemplate).
// Centralisé ici pour rester identique entre la facture PDF et l'historique de facturation.
export const CV_MODEL_LABELS = {
  modern: "Modèle Moderne",
  minimalist: "Modèle Minimaliste",
  classic: "Modèle Classique",
  executif: "Modèle Exécutif",
  creatif: "Modèle Créatif",
  technique: "Modèle Technique",
};

export function labelForCvModel(cvModelId) {
  return CV_MODEL_LABELS[cvModelId] || cvModelId;
}
