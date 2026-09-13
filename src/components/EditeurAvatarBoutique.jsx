"use client";

// Éditeur d'avatar façon Bitmoji pour une boutique — anonymat possible,
// aucune vraie photo obligatoire. Le rendu (aperçu + vignettes) est du SVG
// DiceBear généré en local à chaque changement, donc aucun round-trip
// serveur pour prévisualiser ; seul le clic sur "Enregistrer" écrit en base
// (via modifier_mon_avatar_boutique, appelé par le composant parent).
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
} from "@/lib/avatarBoutique";

function LigneAxeType({ label, options, valeur, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.valeur === valeur));
  const suivant = () => onChange(options[(index + 1) % options.length].valeur);
  const precedent = () => onChange(options[(index - 1 + options.length) % options.length].valeur);

  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
        <button
          type="button"
          onClick={precedent}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-600 dark:text-gray-300 cursor-pointer transition shrink-0"
          aria-label={`${label} précédent`}
        >
          <i className="fa-solid fa-chevron-left text-[10px]"></i>
        </button>
        <span className="text-xs font-semibold text-gray-900 dark:text-white min-w-0 flex-1 text-center truncate">
          {options[index]?.label}
        </span>
        <button
          type="button"
          onClick={suivant}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-600 dark:text-gray-300 cursor-pointer transition shrink-0"
          aria-label={`${label} suivant`}
        >
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
      </div>
    </div>
  );
}

function LigneAxeCouleur({ label, options, valeur, onChange }) {
  return (
    <div className="py-2.5">
      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            onClick={() => onChange(o.valeur)}
            title={o.label}
            aria-label={o.label}
            className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
              valeur === o.valeur
                ? "border-gray-900 dark:border-white scale-110 shadow-sm"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: `#${o.valeur}` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function EditeurAvatarBoutique({ configInitial, onEnregistrer, onAnnuler }) {
  const [config, setConfig] = useState(() => ({ ...configAvatarParDefaut(), ...(configInitial || {}) }));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const apercu = useMemo(() => dataUriAvatarBoutique(config, 200), [config]);

  const definir = (champ) => (valeur) => setConfig((c) => ({ ...c, [champ]: valeur }));

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await onEnregistrer(config);
    } catch (err) {
      setErreur(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Aperçu centré & Bouton Aléatoire */}
      <div className="flex flex-col items-center gap-2.5 pb-3 shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-emerald-400 dark:border-emerald-500 shadow-md bg-gray-100 dark:bg-zinc-800 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercu} alt="Aperçu de l'avatar de la boutique" className="w-full h-full object-cover" />
        </div>
        <button
          type="button"
          onClick={() => setConfig(configAvatarAleatoire())}
          className="px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-2 cursor-pointer transition shadow-xs"
        >
          <i className="fa-solid fa-shuffle text-emerald-500"></i>
          <span>Aléatoire</span>
        </button>
      </div>

      {/* Liste des options défilable */}
      <div className="divide-y divide-gray-100 dark:divide-zinc-800 pb-2">
        <LigneAxeCouleur label="Peau" options={OPTIONS_SKIN_COLOR} valeur={config.skinColor} onChange={definir("skinColor")} />
        <LigneAxeType label="Cheveux" options={OPTIONS_TOP} valeur={config.top} onChange={definir("top")} />
        <LigneAxeCouleur
          label="Couleur cheveux"
          options={OPTIONS_HAIR_COLOR}
          valeur={config.hairColor}
          onChange={definir("hairColor")}
        />
        <LigneAxeType label="Pilosité" options={OPTIONS_FACIAL_HAIR} valeur={config.facialHair} onChange={definir("facialHair")} />
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
          label="Fond"
          options={OPTIONS_BACKGROUND_COLOR}
          valeur={config.backgroundColor}
          onChange={definir("backgroundColor")}
        />
      </div>

      {erreur && <p className="text-xs font-bold text-red-600 my-2">{erreur}</p>}

      {/* Barre d'action sticky en bas (100% toujours visible pour enregistrer) */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm pt-3 pb-1 border-t border-gray-100 dark:border-zinc-800 mt-2 z-20 flex items-center gap-2">
        {onAnnuler && (
          <button
            type="button"
            onClick={onAnnuler}
            className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-black cursor-pointer transition"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={enregistrer}
          disabled={envoi}
          className="flex-2 py-3 rounded-xl bg-[#0b1329] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-xs sm:text-sm font-black disabled:opacity-50 cursor-pointer shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
        >
          <i className={`fa-solid ${envoi ? "fa-spinner fa-spin" : "fa-floppy-disk"}`}></i>
          <span>{envoi ? "Enregistrement…" : "Enregistrer les modifications"}</span>
        </button>
      </div>
    </div>
  );
}
