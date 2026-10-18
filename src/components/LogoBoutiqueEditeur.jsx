"use client";

import { useRef, useState } from "react";
import { definirLogoMaBoutique, televerserLogoBoutique, urlPhoto } from "@/lib/marketplaceData";

/**
 * Choix du LOGO (photo) de la boutique : un cercle, « Choisir une photo », « Retirer ». Le logo est affiché
 * à la place de l'avatar Bitmoji sur la carte, dans la liste et sur la page de la boutique.
 */
export default function LogoBoutiqueEditeur({ storeId, userId, logoPath, onChange }) {
  const entree = useRef(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const url = urlPhoto(logoPath);

  const choisir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErreur("");
    setEnCours(true);
    try {
      const chemin = await televerserLogoBoutique(userId, f);
      await definirLogoMaBoutique(storeId, chemin);
      onChange?.(chemin);
    } catch (err) {
      setErreur(err.message || "Logo impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async () => {
    setErreur("");
    setEnCours(true);
    try {
      await definirLogoMaBoutique(storeId, null);
      onChange?.(null);
    } catch (err) {
      setErreur(err.message || "Retrait impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => entree.current?.click()}
        disabled={enCours}
        aria-label="Choisir le logo de la boutique"
        className="relative w-16 h-16 rounded-full bg-[#E8E4DA] dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
      >
        {enCours ? (
          <i className="fa-solid fa-spinner fa-spin text-gray-500"></i>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Logo de la boutique" className="w-full h-full object-cover" />
        ) : (
          <i className="fa-solid fa-store text-gray-400 text-xl"></i>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-gray-900 dark:text-white">Logo de la boutique</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Une photo carrée s&apos;affiche mieux. Elle remplace l&apos;avatar sur la carte.</p>
        {erreur ? <p role="alert" className="text-[11px] font-bold text-red-600 mt-1">{erreur}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button type="button" onClick={() => entree.current?.click()} disabled={enCours} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer disabled:opacity-60">
          Choisir une photo
        </button>
        {url ? (
          <button type="button" onClick={retirer} disabled={enCours} className="text-[11px] font-black text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-60">
            Retirer
          </button>
        ) : null}
      </div>
      <input ref={entree} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choisir} />
    </div>
  );
}
