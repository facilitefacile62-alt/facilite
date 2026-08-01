"use client";

import { useEffect, useCallback } from "react";
import { Eye, X, ArrowRight, FileText } from "lucide-react";

export interface Template {
  id: string;
  name: string;
  previewUrl: string; // URL de l'image ou du PDF de rendu
  description?: string;
}

export interface TemplatePreviewModalProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (template: Template) => void;
}

function isPdfUrl(url: string): boolean {
  return url.toLowerCase().split("?")[0].endsWith(".pdf");
}

export default function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onConfirm,
}: TemplatePreviewModalProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !template) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10E688]/10 text-[#10E688]">
              <FileText size={20} />
            </span>
            <div className="min-w-0">
              <h2
                id="template-preview-title"
                className="truncate text-base font-bold text-gray-900 dark:text-white"
              >
                {template.name}
              </h2>
              {template.description && (
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {template.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps : aperçu du document */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 dark:bg-gray-950 sm:p-6">
          {template.previewUrl ? (
            isPdfUrl(template.previewUrl) ? (
              <iframe
                src={template.previewUrl}
                title={`Aperçu du modèle ${template.name}`}
                className="mx-auto h-[60vh] w-full max-w-xl rounded-lg border border-gray-200 bg-white dark:border-gray-800"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.previewUrl}
                alt={`Aperçu du modèle ${template.name}`}
                className="mx-auto max-h-[60vh] w-auto rounded-lg border border-gray-200 object-contain shadow-sm dark:border-gray-800"
              />
            )
          ) : (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-gray-400">
              <Eye size={32} />
              <p className="text-sm font-medium">Aucun aperçu disponible</p>
            </div>
          )}
        </div>

        {/* Footer : actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(template)}
            className="flex items-center gap-2 rounded-xl bg-[#10E688] px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm transition hover:bg-[#0dd17b]"
          >
            Utiliser ce modèle
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
