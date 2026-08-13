import React from "react";

export default function TemplateCard({ isRecommended = false, previewImage = "/affiche_cv_pro.jpg", title = "Modèle CV Pro", onSelect }) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      className="relative group flex flex-col rounded-2xl overflow-hidden border border-gray-200 bg-white transition-all duration-300 hover:shadow-2xl hover:border-emerald-400 cursor-pointer shadow-xs"
    >

      {/* Badge Recommandé Flottant */}
      {isRecommended && (
        <div className="absolute top-3 right-3 z-10 bg-amber-100 text-amber-900 text-xs font-black px-3 py-1.5 rounded-full shadow-sm border border-amber-200 flex items-center gap-1.5">
          <span>⭐</span>
          <span>Recommandé</span>
        </div>
      )}

      {/* Image de l'affiche publicitaire officielle */}
      <div className="relative w-full aspect-square bg-gray-900 overflow-hidden">
        <img
          src={previewImage}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-2xs">
          <span className="bg-[#10E688] text-gray-950 font-extrabold px-6 py-2.5 rounded-xl shadow-xl pointer-events-none text-xs transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            Choisir ce modèle
          </span>
        </div>
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <h4 className="text-sm font-extrabold text-gray-900">{title}</h4>
        <p className="text-[11px] text-gray-500 font-medium mt-0.5">Mise en page professionnelle & percutante</p>
      </div>
    </div>
  );
}
