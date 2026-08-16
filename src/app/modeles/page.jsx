"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import TemplateCard from "@/components/TemplateCard";
import { supabase } from "@/lib/supabase";
import AdminPosterManagerModal from "@/components/AdminPosterManagerModal";

// Métadonnées vérifiées directement dans src/app/creer-cv/page.js (présence
// de photoPreview, nombre de colonnes du layout) — pas devinées. hasPhoto/
// columns pilotent les filtres Photo/Colonnes ; category pilote le filtre
// Catégorie. accentColor: false = couleur fixe du modèle (le sélecteur de
// couleur n'a aucun effet visuel sur ces 2-là, normal, pas un bug).
const TEMPLATES = [
  { id: "entrepreneur", number: 1, title: "Modèle 1 — Entrepreneur Numérique", previewImage: "/model4.png", isRecommended: true, hasPhoto: true, columns: 1, category: "pro", accentColor: false },
  { id: "modern", number: 2, title: "Modèle 2 — Professionnel Moderne", previewImage: "/affiche_cv_pro.jpg", isRecommended: true, hasPhoto: true, columns: 2, category: "modern", accentColor: true },
  { id: "minimalist", number: 3, title: "Modèle 3 — Minimaliste & Épuré", previewImage: "/model2.png", isRecommended: false, hasPhoto: false, columns: 1, category: "modern", accentColor: true },
  { id: "classic", number: 4, title: "Modèle 4 — Classique & Structuré", previewImage: "/model3.png", isRecommended: false, hasPhoto: true, columns: 1, category: "pro", accentColor: true },
  { id: "executif", number: 5, title: "Modèle 5 — Exécutif International", previewImage: "/model5.png", isRecommended: false, hasPhoto: true, columns: 1, category: "pro", accentColor: true },
  { id: "creatif", number: 6, title: "Modèle 6 — Créatif & Dynamique", previewImage: "/model6.png", isRecommended: false, hasPhoto: true, columns: 2, category: "creative", accentColor: true },
  { id: "technique", number: 7, title: "Modèle 7 — Technique & Développeur", previewImage: "/model7.png", isRecommended: false, hasPhoto: true, columns: 2, category: "technique", accentColor: true },
  { id: "professionnel", number: 8, title: "Modèle 8 — Professionnel Canva Stylisé", previewImage: "/model8.png", isRecommended: true, hasPhoto: true, columns: 2, category: "pro", accentColor: true },
  { id: "elegance", number: 9, title: "Modèle 9 — Élégance & Sombre", previewImage: "/model9.png", isRecommended: false, hasPhoto: false, columns: 2, category: "pro", accentColor: false },
];

export default function ModelesPage() {
  const router = useRouter();
  // selectedColor : sélecteur d'accent transmis tel quel à /creer-cv, PAS un
  // filtre de visibilité — les cartes affichées ne changent jamais selon la
  // couleur choisie ici (voir handleSelectTemplate).
  const [selectedColor, setSelectedColor] = useState(null);
  const [photoFilter, setPhotoFilter] = useState("");
  const [columnsFilter, setColumnsFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPosterModalOpen, setAdminPosterModalOpen] = useState(false);
  // 0, pas Date.now() : cette valeur initiale est évaluée séparément au
  // rendu serveur et à l'hydratation client (deux vrais instants distincts),
  // donc un timestamp ici cassait l'hydratation sur les 9 cartes à chaque
  // chargement. onPosterUpdated ci-dessous (déclenché uniquement par un vrai
  // clic admin, jamais pendant le rendu serveur) peut lui garder Date.now()
  // sans risque — le cache-busting continue de fonctionner après une mise à
  // jour réelle, seule la valeur de départ doit être stable.
  const [posterRefreshKey, setPosterRefreshKey] = useState(0);

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

  // color.hex (pas color.id) : /creer-cv applique directement ce code hex
  // comme accentColor initial — un id ("navy") ne correspondait à rien côté
  // générateur, c'était un paramètre mort.
  function handleSelectTemplate(templateId = "s1") {
    router.push(`/creer-cv?template=${templateId}${selectedColor ? `&color=${encodeURIComponent(selectedColor)}` : ""}`);
  }

  function handleClearFilters() {
    setPhotoFilter("");
    setColumnsFilter("");
    setCategoryFilter("");
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

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((tpl) => {
      if (photoFilter === "with" && !tpl.hasPhoto) return false;
      if (photoFilter === "without" && tpl.hasPhoto) return false;
      if (columnsFilter && tpl.columns !== Number(columnsFilter)) return false;
      if (categoryFilter && tpl.category !== categoryFilter) return false;
      return true;
    });
  }, [photoFilter, columnsFilter, categoryFilter]);

  const filtersActive = photoFilter !== "" || columnsFilter !== "" || categoryFilter !== "";

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
          {/* Ligne 1 : Couleurs (accent transmis à /creer-cv, ne filtre pas la grille) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-100 gap-4">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-700">Couleurs :</span>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor((prev) => (prev === color.hex ? null : color.hex))}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.hex ? "border-blue-600 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    aria-label={`Couleur ${color.id}`}
                    title={`Appliquer cette couleur d'accent (${color.id})`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Ligne 2 : Dropdowns (filtrent réellement la grille) et Reset */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-6 gap-4">
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              {/* Select Photo */}
              <select
                value={photoFilter}
                onChange={(e) => setPhotoFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none"
              >
                <option value="">Photo</option>
                <option value="with">Avec photo</option>
                <option value="without">Sans photo</option>
              </select>

              {/* Select Colonnes */}
              <select
                value={columnsFilter}
                onChange={(e) => setColumnsFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none"
              >
                <option value="">Colonnes</option>
                <option value="1">1 Colonne</option>
                <option value="2">2 Colonnes</option>
              </select>

              {/* Select Catégorie */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] outline-none"
              >
                <option value="">Catégorie</option>
                <option value="pro">Professionnel</option>
                <option value="creative">Créatif</option>
                <option value="modern">Moderne</option>
                <option value="technique">Technique</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!filtersActive}
              className="text-gray-400 hover:text-gray-600 underline text-sm transition-colors mt-2 md:mt-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Effacer les filtres
            </button>
          </div>
        </div>

        {/* Grille de modèles numérotés (filtrée) */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16 text-gray-400 font-semibold">
            Aucun modèle ne correspond à ces filtres.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {filteredTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                number={tpl.number}
                isRecommended={tpl.isRecommended}
                title={tpl.title}
                previewImage={`${tpl.previewImage}?v=${posterRefreshKey}`}
                onSelect={() => handleSelectTemplate(tpl.id)}
              />
            ))}
          </div>
        )}

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
