"use client";

import { useState } from "react";

// Carte du bas affichée sur la carte quand une boutique est sélectionnée (façon Google Maps) : son nom, son quartier et quatre
// boutons — Itinéraire, Appeler, WhatsApp, Partager. Aucun HTML brut : tout est rendu par React (échappement automatique, la
// protection XSS des noms de boutique ne régresse pas).
function chiffresTelephone(valeur) {
  const texte = String(valeur ?? "").trim();
  if (!texte) return "";
  const chiffres = texte.replace(/[^\d]/g, "");
  if (chiffres.length < 8) return "";
  return texte.startsWith("+") ? `+${chiffres}` : chiffres.length === 9 ? `+221${chiffres}` : `+${chiffres}`;
}

export default function CarteBoutiqueChoisie({ boutique, onFermer }) {
  const [message, setMessage] = useState("");
  if (!boutique) return null;

  const telephone = chiffresTelephone(boutique.telephone_whatsapp);
  const lieu = [boutique.quartier, boutique.ville].filter(Boolean).join(", ") || "Sénégal";
  const lienCarte = `https://www.google.com/maps/search/?api=1&query=${boutique.lat},${boutique.lng}`;
  const lienItineraire = `https://www.google.com/maps/dir/?api=1&destination=${boutique.lat},${boutique.lng}`;

  const partager = async () => {
    const donnees = { title: boutique.nom || "Boutique Facilité", text: `${boutique.nom || "Boutique"} — ${lieu} (Facilité Locaux)`, url: lienCarte };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(donnees);
        return;
      }
      await navigator.clipboard.writeText(`${donnees.text} ${donnees.url}`);
      setMessage("Lien copié");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      // Partage annulé par la personne : rien à signaler.
    }
  };

  const bouton =
    "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl text-[11px] font-black transition cursor-pointer select-none";

  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-3xl bg-gray-900/95 text-white border border-gray-700/80 shadow-2xl backdrop-blur-md p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-black truncate">{boutique.nom || "Boutique Facilité"}</p>
          <p className="text-xs text-gray-400 font-medium truncate flex items-center gap-1">
            <i className="fa-solid fa-location-dot text-[#EF4444]"></i>
            {lieu}
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer la fiche"
          className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <a href={lienItineraire} target="_blank" rel="noopener noreferrer" className={`${bouton} bg-blue-600 hover:bg-blue-500 text-white`}>
          <i className="fa-solid fa-diamond-turn-right text-base"></i>
          Itinéraire
        </a>
        {telephone ? (
          <a href={`tel:${telephone}`} className={`${bouton} bg-gray-800 hover:bg-gray-700 text-white`}>
            <i className="fa-solid fa-phone text-base"></i>
            Appeler
          </a>
        ) : (
          <span aria-disabled="true" title="Numéro non renseigné" className={`${bouton} bg-gray-800/50 text-gray-500 cursor-not-allowed`}>
            <i className="fa-solid fa-phone text-base"></i>
            Appeler
          </span>
        )}
        {boutique.whatsappUrl ? (
          <a href={boutique.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${bouton} bg-[#25D366] hover:bg-[#20bd5a] text-white`}>
            <i className="fa-brands fa-whatsapp text-base"></i>
            WhatsApp
          </a>
        ) : (
          <span aria-disabled="true" title="WhatsApp non renseigné" className={`${bouton} bg-gray-800/50 text-gray-500 cursor-not-allowed`}>
            <i className="fa-brands fa-whatsapp text-base"></i>
            WhatsApp
          </span>
        )}
        <button type="button" onClick={partager} className={`${bouton} bg-gray-800 hover:bg-gray-700 text-white`}>
          <i className="fa-solid fa-share-nodes text-base"></i>
          {message || "Partager"}
        </button>
      </div>
    </div>
  );
}
