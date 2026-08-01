"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const OPTIONS = [
  {
    id: "autonome",
    hasAgentOption: false,
    title: "Confectionner mon CV moi-même",
    price: 1500,
    description: "Accès complet à l'éditeur de CV Facilite, export illimité.",
    icon: "fa-solid fa-pen-ruler",
  },
  {
    id: "accompagne",
    hasAgentOption: true,
    title: "Accompagnement personnalisé par un expert",
    price: 2000,
    description: "Un agent Facilite relit et optimise votre CV avec vous (+500 FCFA).",
    icon: "fa-solid fa-user-tie",
  },
];

/**
 * Modale de tarification pour la confection de CV.
 * `cvModelId` identifie le modèle déjà choisi par le candidat dans l'éditeur
 * (ex: "modern", "minimalist", "classic") — la modale ne fait que choisir la
 * formule de paiement, pas le modèle lui-même.
 */
export default function PricingModal({ cvModelId, resumeId, onClose }) {
  const [selectedOptionId, setSelectedOptionId] = useState("autonome");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedOption = OPTIONS.find((opt) => opt.id === selectedOptionId);

  const handlePayAndValidate = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign("/login");
        return;
      }

      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cvModelId,
          hasAgentOption: selectedOption.hasAgentOption,
          ...(resumeId ? { resumeId } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.checkoutUrl) {
        setErrorMessage(data.error || "Impossible d'initialiser le paiement. Réessayez.");
        setIsSubmitting(false);
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error("Erreur checkout:", err);
      setErrorMessage("Une erreur réseau est survenue. Vérifiez votre connexion et réessayez.");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-t-3xl rounded-b-none sm:rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative max-h-[85vh] sm:max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer disabled:opacity-50 z-10"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-1">
          Finalisez votre CV
        </h2>
        <p className="text-sm text-gray-500 mb-6">Choisissez la formule qui vous convient.</p>

        <div className="space-y-3 mb-6">
          {OPTIONS.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isRecommended = option.id === "accompagne";
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedOptionId(option.id)}
                disabled={isSubmitting}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer disabled:opacity-60 ${
                  isSelected
                    ? "border-[#10E688] bg-[#10E688]/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-[#10E688] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <i className={option.icon}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{option.title}</p>
                        {isRecommended && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animated-gradient-badge border border-emerald-200">
                            Recommandé ✨
                          </span>
                        )}
                      </div>
                      <p className="font-extrabold text-[#10E688] text-sm whitespace-nowrap">
                        {option.price.toLocaleString("fr-FR")} FCFA
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handlePayAndValidate}
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-[#10E688] hover:bg-[#0dd17a] text-gray-900 font-extrabold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base min-h-[48px]"
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Redirection vers le paiement...
            </>
          ) : (
            <>Payer et Valider — {selectedOption.price.toLocaleString("fr-FR")} FCFA</>
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center mt-3">
          Paiement sécurisé via KPay — Wave, Orange Money, MTN Mobile Money.
        </p>
      </div>
    </div>
  );
}
