import React from "react";

export default function TemplateCard({ isRecommended = false, image, onSelect }) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      className="relative group flex flex-col rounded-xl overflow-hidden border border-gray-200 bg-white transition-all duration-300 hover:shadow-2xl hover:border-blue-400 cursor-pointer"
    >

      {/* Badge Recommandé Flottant */}
      {isRecommended && (
        <div className="absolute top-3 right-3 z-10 bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1.5 rounded shadow-sm border border-yellow-200">
          Recommandé
        </div>
      )}

      {/* Placeholder ou Image du CV */}
      <div className="relative w-full aspect-[21/29.7] bg-gray-100 flex items-center justify-center overflow-hidden">
        {image ? (
          <img src={image} alt="Modèle de CV" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
            <div className="w-1/3 h-6 bg-gray-200 rounded"></div>
            <div className="w-full h-2 bg-gray-200 rounded"></div>
            <div className="w-5/6 h-2 bg-gray-200 rounded"></div>
            <div className="w-4/6 h-2 bg-gray-200 rounded"></div>
            
            <div className="mt-4 w-1/4 h-4 bg-gray-200 rounded"></div>
            <div className="w-full h-2 bg-gray-200 rounded"></div>
            <div className="w-full h-2 bg-gray-200 rounded"></div>
          </div>
        )}
        
        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="bg-white text-blue-600 font-semibold px-6 py-2 rounded-full shadow-lg pointer-events-none">
            Choisir ce modèle
          </span>
        </div>
      </div>
    </div>
  );
}
