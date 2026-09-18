"use client";

// Sélecteur de métier/situation actuelle organisé par domaine — remplace un
// champ texte libre par des catégories cliquables (Ingénierie, Santé,
// Métiers & Artisanat...), plus une recherche et un champ "Saisir un autre
// métier" pour tout ce qui n'y figure pas. Demande explicite de
// l'utilisateur, avec une capture de référence pour la structure.
import { useState } from "react";
import { rechercherMetiers } from "@/lib/metiersProfilData";

export default function SelecteurMetier({ valeurActuelle, onChoisir, onFermer }) {
  const [recherche, setRecherche] = useState("");
  const [autreMetier, setAutreMetier] = useState("");
  const categories = rechercherMetiers(recherche);

  const valider = (label) => {
    const val = label.trim();
    if (!val) return;
    onChoisir(val);
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs"
      onClick={onFermer}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5" />

        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-briefcase text-emerald-600 text-sm"></i>
            Ton métier ou ta situation actuelle
          </h3>
          <button
            type="button"
            onClick={onFermer}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm text-gray-600 dark:text-gray-300"></i>
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un métier..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
            <i className="fa-solid fa-pen text-amber-600 dark:text-amber-400 text-xs shrink-0"></i>
            <input
              type="text"
              value={autreMetier}
              onChange={(e) => setAutreMetier(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") valider(autreMetier);
              }}
              placeholder="Saisir un autre métier"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-white placeholder:text-amber-600/70 dark:placeholder:text-amber-500/60 focus:outline-none"
            />
            {autreMetier.trim() && (
              <button
                type="button"
                onClick={() => valider(autreMetier)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black cursor-pointer shrink-0"
              >
                OK
              </button>
            )}
          </div>

          {categories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Aucun métier ne correspond à cette recherche.</p>
          )}

          {categories.map((cat) => (
            <div key={cat.id} className="space-y-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>{cat.icone}</span>
                {cat.label}
              </h4>
              <div className="flex flex-wrap gap-2">
                {cat.metiers.map((m) => {
                  const estSelectionne = valeurActuelle === m.label;
                  return (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => valider(m.label)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                        estSelectionne
                          ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                          : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                      {estSelectionne && <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400 text-[10px]"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
