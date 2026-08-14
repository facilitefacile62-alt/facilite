"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TemplateCard from "@/components/TemplateCard";
import { supabase } from "@/lib/supabase";
import AdminPosterManagerModal from "@/components/AdminPosterManagerModal";

export default function ModelesPage() {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPosterModalOpen, setAdminPosterModalOpen] = useState(false);
  const [posterRefreshKey, setPosterRefreshKey] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (session.user.email === "facilitefacile62@gmail.com") {
          setIsAdmin(true);
        } else {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.role === "admin") setIsAdmin(true);
            });
        }
      }
    });
  }, []);

  function handleSelectTemplate(templateId = "s1") {
    router.push(`/creer-cv?template=${templateId}${selectedColor ? `&color=${selectedColor}` : ""}`);
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
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6">
            Commencez par choisir un CV parmi notre sélection. Vous pourrez en changer plus tard.
          </p>
          {isAdmin && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setAdminPosterModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-black py-3 px-6 rounded-full text-xs sm:text-sm transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 shadow-lg animate-pulse"
              >
                <i className="fa-solid fa-camera"></i>
                <span>Gérer et changer les affiches (Mode Admin)</span>
              </button>
            </div>
          )}
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
          <TemplateCard
            isRecommended={true}
            title="CV Entrepreneur Numérique"
            previewImage={`/model4.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("entrepreneur")}
          />
          <TemplateCard
            isRecommended={true}
            title="CV Professionnel Moderne"
            previewImage={`/affiche_cv_pro.jpg?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("modern")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Minimaliste & Épuré"
            previewImage={`/model2.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("minimalist")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Classique & Structuré"
            previewImage={`/model3.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("classic")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Exécutif International"
            previewImage={`/model5.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("executif")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Créatif & Dynamique"
            previewImage={`/model6.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("creatif")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Technique & Développeur"
            previewImage={`/model7.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("technique")}
          />
          <TemplateCard
            isRecommended={false}
            title="CV Élégance & Sombre"
            previewImage={`/model9.png?v=${posterRefreshKey}`}
            onSelect={() => handleSelectTemplate("elegance")}
          />
        </div>
        
      </div>

      {/* Modal Admin Gestionnaire d'Affiches */}
      <AdminPosterManagerModal
        isOpen={adminPosterModalOpen}
        onClose={() => setAdminPosterModalOpen(false)}
        onPosterUpdated={() => setPosterRefreshKey(Date.now())}
      />
    </div>
  );
}
