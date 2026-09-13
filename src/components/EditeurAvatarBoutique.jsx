"use client";

// Éditeur d'avatar façon Bitmoji pour une boutique — anonymat possible,
// aucune vraie photo obligatoire. Le rendu (aperçu + vignettes) est du SVG
// DiceBear généré en local à chaque changement, donc aucun round-trip
// serveur pour prévisualiser ; seul le clic sur "Enregistrer" écrit en base.
import { useMemo, useState } from "react";
import {
  configAvatarAleatoire,
  configAvatarParDefaut,
  dataUriAvatarBoutique,
  OPTIONS_ACCESSORIES,
  OPTIONS_BACKGROUND_COLOR,
  OPTIONS_CLOTHING,
  OPTIONS_EYEBROWS,
  OPTIONS_EYES,
  OPTIONS_FACIAL_HAIR,
  OPTIONS_HAIR_COLOR,
  OPTIONS_MOUTH,
  OPTIONS_SKIN_COLOR,
  OPTIONS_TOP,
  OPTIONS_TOP_FEMME,
  OPTIONS_TOP_HOMME,
} from "@/lib/avatarBoutique";

function LigneAxeType({ label, options, valeur, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.valeur === valeur));
  const suivant = () => onChange(options[(index + 1) % options.length].valeur);
  const precedent = () => onChange(options[(index - 1 + options.length) % options.length].valeur);

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 bg-gray-50 dark:bg-zinc-800/60 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border border-gray-100 dark:border-zinc-800/80">
        <span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 pl-1 sm:pl-2 shrink-0 max-w-[80px] sm:max-w-[100px] truncate">
          {label}
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5 justify-end flex-1 min-w-0">
          <button
            type="button"
            onClick={precedent}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 shadow-2xs flex items-center justify-center text-gray-700 dark:text-gray-200 cursor-pointer transition shrink-0 active:scale-90"
            aria-label={`${label} précédent`}
          >
            <i className="fa-solid fa-chevron-left text-[10px] sm:text-xs"></i>
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-zinc-900 dark:text-white px-1.5 sm:px-2 py-1 bg-white dark:bg-zinc-900 rounded-lg shadow-2xs flex-1 min-w-0 text-center truncate">
            {options[index]?.label}
          </span>
          <button
            type="button"
            onClick={suivant}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-600 shadow-2xs flex items-center justify-center text-gray-700 dark:text-gray-200 cursor-pointer transition shrink-0 active:scale-90"
            aria-label={`${label} suivant`}
          >
            <i className="fa-solid fa-chevron-right text-[10px] sm:text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

function LigneAxeCouleur({ label, options, valeur, onChange }) {
  return (
    <div className="py-1.5">
      <span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 block mb-1 pl-1">
        {label}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap bg-gray-50 dark:bg-zinc-800/60 rounded-xl sm:rounded-2xl p-2 border border-gray-100 dark:border-zinc-800/80">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            onClick={() => onChange(o.valeur)}
            title={o.label}
            aria-label={o.label}
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 cursor-pointer transition shrink-0 ${
              valeur === o.valeur
                ? "border-emerald-500 scale-110 shadow-md ring-2 ring-emerald-500/30"
                : "border-white/50 dark:border-zinc-700 hover:scale-105"
            }`}
            style={{ backgroundColor: `#${o.valeur}` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function EditeurAvatarBoutique({ configInitial, onEnregistrer, onAnnuler }) {
  const [config, setConfig] = useState(() => ({
    ...configAvatarParDefaut("garcon"),
    ...(configInitial || {}),
  }));
  const [genre, setGenre] = useState(() => {
    if (configInitial?.genre) return configInitial.genre;
    if (configInitial?.facialHair) return "garcon";
    if (configInitial?.top && OPTIONS_TOP_FEMME.some((o) => o.valeur === configInitial.top)) {
      return "femme";
    }
    return "garcon";
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const apercu = useMemo(() => dataUriAvatarBoutique(config, 200), [config]);

  const listeCheveux = useMemo(() => {
    return genre === "femme" ? OPTIONS_TOP_FEMME : OPTIONS_TOP_HOMME;
  }, [genre]);

  const definir = (champ) => (valeur) => setConfig((c) => ({ ...c, [champ]: valeur }));

  const changerGenre = (nouveauGenre) => {
    setGenre(nouveauGenre);
    const estFemme = nouveauGenre === "femme";
    const listeNouveauxCheveux = estFemme ? OPTIONS_TOP_FEMME : OPTIONS_TOP_HOMME;
    const coiffureValide = listeNouveauxCheveux.some((o) => o.valeur === config.top)
      ? config.top
      : listeNouveauxCheveux[0].valeur;

    setConfig((prev) => ({
      ...prev,
      genre: nouveauGenre,
      top: coiffureValide,
      facialHair: estFemme ? null : prev.facialHair,
      clothing: estFemme
        ? (prev.clothing === "shirtCrewNeck" ? "shirtScoopNeck" : prev.clothing)
        : prev.clothing,
    }));
  };

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await onEnregistrer({ ...config, genre });
    } catch (err) {
      setErreur(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      {/* Aperçu centré & Bouton Aléatoire (Compact) */}
      <div className="flex items-center justify-center gap-3 pb-2.5 pt-1 shrink-0 bg-white dark:bg-zinc-900">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-3 border-emerald-400 dark:border-emerald-500 shadow-md bg-gray-100 dark:bg-zinc-800 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercu} alt="Aperçu de l'avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Aperçu en direct</span>
          <button
            type="button"
            onClick={() => setConfig(configAvatarAleatoire(genre))}
            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-black text-gray-800 dark:text-gray-100 flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
          >
            <i className="fa-solid fa-shuffle text-emerald-500 text-xs"></i>
            <span>Aléatoire</span>
          </button>
        </div>
      </div>

      {/* Sélecteur de Genre : Femme / Garçon */}
      <div className="px-1 shrink-0 pb-1">
        <div className="flex items-center justify-center p-1 bg-gray-100 dark:bg-zinc-800/90 rounded-2xl gap-1 border border-gray-200/60 dark:border-zinc-700/60">
          <button
            type="button"
            onClick={() => changerGenre("femme")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              genre === "femme"
                ? "bg-white dark:bg-zinc-900 text-pink-600 dark:text-pink-400 shadow-xs ring-1 ring-pink-500/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-venus text-sm text-pink-500"></i>
            <span>Femme</span>
          </button>
          <button
            type="button"
            onClick={() => changerGenre("garcon")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              genre === "garcon"
                ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <i className="fa-solid fa-mars text-sm text-blue-500"></i>
            <span>Garçon</span>
          </button>
        </div>
      </div>

      {/* Liste des options défilable */}
      <div className="flex-1 overflow-y-auto px-1 py-1 min-h-0 space-y-0.5 custom-scrollbar">
        <LigneAxeCouleur label="Couleur de peau" options={OPTIONS_SKIN_COLOR} valeur={config.skinColor} onChange={definir("skinColor")} />
        <LigneAxeType label="Cheveux" options={listeCheveux} valeur={config.top} onChange={definir("top")} />
        <LigneAxeCouleur
          label="Couleur cheveux"
          options={OPTIONS_HAIR_COLOR}
          valeur={config.hairColor}
          onChange={definir("hairColor")}
        />
        {genre === "garcon" && (
          <LigneAxeType label="Pilosité" options={OPTIONS_FACIAL_HAIR} valeur={config.facialHair} onChange={definir("facialHair")} />
        )}
        <LigneAxeType label="Sourcils" options={OPTIONS_EYEBROWS} valeur={config.eyebrows} onChange={definir("eyebrows")} />
        <LigneAxeType label="Yeux" options={OPTIONS_EYES} valeur={config.eyes} onChange={definir("eyes")} />
        <LigneAxeType label="Bouche" options={OPTIONS_MOUTH} valeur={config.mouth} onChange={definir("mouth")} />
        <LigneAxeType label="Vêtements" options={OPTIONS_CLOTHING} valeur={config.clothing} onChange={definir("clothing")} />
        <LigneAxeType
          label="Accessoires"
          options={OPTIONS_ACCESSORIES}
          valeur={config.accessories}
          onChange={definir("accessories")}
        />
        <LigneAxeCouleur
          label="Couleur de fond"
          options={OPTIONS_BACKGROUND_COLOR}
          valeur={config.backgroundColor}
          onChange={definir("backgroundColor")}
        />
      </div>

      {erreur && <p className="text-xs font-bold text-red-600 px-2 my-1 shrink-0">{erreur}</p>}

      {/* Barre d'action fixe en bas (100% visible et toujours accessible) */}
      <div className="shrink-0 pt-2.5 pb-1 mt-1 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-900">
        {onAnnuler && (
          <button
            type="button"
            onClick={onAnnuler}
            className="w-1/3 py-2.5 sm:py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-bold cursor-pointer transition active:scale-95 text-center"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={enregistrer}
          disabled={envoi}
          className="flex-1 py-2.5 sm:py-3 rounded-xl bg-[#0b1329] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-xs sm:text-sm font-black disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5 active:scale-95"
        >
          <i className={`fa-solid ${envoi ? "fa-spinner fa-spin" : "fa-floppy-disk"} text-xs sm:text-sm`}></i>
          <span className="truncate">{envoi ? "Enregistrement…" : "Enregistrer"}</span>
        </button>
      </div>
    </div>
  );
}
