"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import TemplateCard from "@/components/TemplateCard";
import { supabase } from "@/lib/supabase";

export default function ModelesPage() {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = useState(null);

  // Affichage des modèles : public, sans session (voir PUBLIC_ROUTES dans
  // middleware.js). L'action "Créer avec Canva" reste protégée : un
  // visiteur non connecté est redirigé vers /login?redirect=/modeles,
  // jamais directement vers le flux OAuth Canva.
  async function handleSelectTemplate() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login?redirect=/modeles");
      return;
    }
    router.push("/api/canva/auth");
  }
  const colors = [
    { id: "gray", hex: "#9CA3AF" },
    { id: "brown", hex: "#8B5A2B" },
    { id: "navy", hex: "#1E3A8A" },
    { id: "light-blue", hex: "#60A5FA" },
    { id: "green", hex: "#10B981" },
    { id: "orange", hex: "#F97316" },
    { id: "red", hex: "#EF4444" },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F1] pt-[80px] pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* En-tête */}
        <div className="text-center mt-10 mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Choisissez un modèle de CV
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Commencez par choisir un CV parmi notre sélection. Vous pourrez en changer plus tard.
          </p>
        </div>

        {/* Barre de filtrage */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-12">
          {/* Ligne 1 : Couleurs et Bouton Filtres */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-100 gap-4">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-700">Couleurs :</span>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.id)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.id ? "border-blue-600 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Couleur ${color.id}`}
                  />
                ))}
              </div>
            </div>
            
            <button className="flex items-center gap-2 px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filtres
            </button>
          </div>

          {/* Ligne 2 : Dropdowns et Reset */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-6 gap-4">
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              {/* Select Photo */}
              <select className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none">
                <option value="">Photo</option>
                <option value="with">Avec photo</option>
                <option value="without">Sans photo</option>
              </select>

              {/* Select Colonnes */}
              <select className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none">
                <option value="">Colonnes</option>
                <option value="1">1 Colonne</option>
                <option value="2">2 Colonnes</option>
              </select>

              {/* Select Catégorie */}
              <select className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none">
                <option value="">Catégorie</option>
                <option value="pro">Professionnel</option>
                <option value="creative">Créatif</option>
                <option value="modern">Moderne</option>
              </select>
            </div>
            
            <button className="text-gray-400 hover:text-gray-600 underline text-sm transition-colors mt-2 md:mt-0">
              Effacer les filtres
            </button>
          </div>
        </div>

        {/* Grille de modèles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <TemplateCard isRecommended={true} image="/model7.png" onSelect={handleSelectTemplate} />
          <TemplateCard isRecommended={true} image="/model1.jpg" onSelect={handleSelectTemplate} />
          <TemplateCard isRecommended={true} image="/model2.png" onSelect={handleSelectTemplate} />
          <TemplateCard isRecommended={true} image="/model3.png" onSelect={handleSelectTemplate} />
        </div>
        
      </div>
    </div>
  );
}
