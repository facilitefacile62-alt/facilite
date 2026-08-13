"use strict";
"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Composant de Partage Social Universel avec Menu Déroulant (Dropdown)
 * Permet de gagner de l'espace sur les cartes et d'offrir l'accès complet en 1 clic :
 * - WhatsApp
 * - LinkedIn
 * - Facebook
 * - TikTok
 * - Instagram
 * - Twitter / X
 * - Telegram
 * - Copier le lien
 */
export default function SocialShareButtons({
  offer,
  variant = "compact", // "compact" | "banner"
  className = "",
  onToast,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likes, setLikes] = useState(12 + Math.floor(((offer?.id || 1) * 7) % 35));
  const [hasLiked, setHasLiked] = useState(false);
  const dropdownRef = useRef(null);

  const offerId = offer?.id || "";
  const title = offer?.title || offer?.titleFR || "Offre d'emploi";
  const company = offer?.company || "Facilite";
  const location = offer?.location || "Sénégal";
  const contract = offer?.contract || offer?.contract_type || "CDI";

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://ffacilite.com";
  };

  const shareUrl = offerId ? `${getBaseUrl()}/offres/${offerId}` : getBaseUrl();
  const shareText = `🚀 Recrutement : ${title} chez ${company} (${contract} - ${location}) sur Facilite.\nDécouvrez l'offre et postulez ici :`;

  // Fermer le menu lors d'un clic extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleCopyLink = (platformName = "") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      const msg = platformName
        ? `Lien copié pour partager sur ${platformName} !`
        : "Lien de l'offre copié dans le presse-papier !";
      if (onToast) onToast(msg);
      setTimeout(() => {
        setCopied(false);
        setDropdownOpen(false);
      }, 1500);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${company}`,
          text: shareText,
          url: shareUrl,
        });
        setDropdownOpen(false);
        if (onToast) onToast("Offre partagée avec succès !");
      } catch {
        // Annulation ou non-support
      }
    } else {
      handleCopyLink();
    }
  };

  const toggleLike = (e) => {
    e.stopPropagation();
    if (hasLiked) {
      setLikes((prev) => prev - 1);
      setHasLiked(false);
    } else {
      setLikes((prev) => prev + 1);
      setHasLiked(true);
    }
  };

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };

  return (
    <div className={`relative flex items-center justify-between gap-2 w-full ${className}`} ref={dropdownRef}>
      {/* Bouton Pilule Vert de Partage avec la Flèche Incurvée */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen((prev) => !prev);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-xs transition-all transform hover:scale-105 shadow-[0_2px_8px_rgba(16,230,136,0.3)] cursor-pointer active:scale-95"
          title="Ouvrir les options de partage"
        >
          {/* Flèche incurvée de partage (Style Facebook/LinkedIn) */}
          <svg
            className="w-3.5 h-3.5 text-gray-950"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>Partager</span>
          <i
            className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          ></i>
        </button>

        {/* Menu Déroulant Complet de Partage Social */}
        {dropdownOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-2 left-0 w-72 sm:w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header du Menu */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-share-nodes text-emerald-600 text-xs"></i>
                <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Partager sur les réseaux
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDropdownOpen(false)}
                className="w-5 h-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 flex items-center justify-center text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Grille des Réseaux Sociaux */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* WhatsApp */}
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/60 hover:bg-[#25D366] text-gray-800 hover:text-white transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-[#25D366] transition-colors">
                  <i className="fa-brands fa-whatsapp font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">WhatsApp</span>
              </a>

              {/* LinkedIn */}
              <a
                href={shareLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 hover:bg-[#0A66C2] text-gray-800 hover:text-white transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-[#0A66C2] transition-colors">
                  <i className="fa-brands fa-linkedin-in font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">LinkedIn</span>
              </a>

              {/* Facebook */}
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 hover:bg-[#1877F2] text-gray-800 hover:text-white transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-[#1877F2] text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-[#1877F2] transition-colors">
                  <i className="fa-brands fa-facebook-f font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">Facebook</span>
              </a>

              {/* TikTok */}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    handleNativeShare();
                  } else {
                    handleCopyLink("TikTok");
                  }
                }}
                className="flex items-center gap-2 p-2 rounded-xl bg-gray-100 hover:bg-black text-gray-800 hover:text-white transition-colors group text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-black transition-colors">
                  <i className="fa-brands fa-tiktok font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">TikTok</span>
              </button>

              {/* Instagram */}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    handleNativeShare();
                  } else {
                    handleCopyLink("Instagram");
                  }
                }}
                className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/60 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-gray-800 hover:text-white transition-colors group text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-[#DD2A7B] transition-colors">
                  <i className="fa-brands fa-instagram font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">Instagram</span>
              </button>

              {/* Twitter / X */}
              <a
                href={shareLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl bg-gray-100 hover:bg-gray-900 text-gray-800 hover:text-white transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-gray-900 transition-colors">
                  <i className="fa-brands fa-x-twitter font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">X (Twitter)</span>
              </a>

              {/* Telegram */}
              <a
                href={shareLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 p-2 rounded-xl bg-sky-50/60 hover:bg-[#229ED9] text-gray-800 hover:text-white transition-colors group text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-[#229ED9] text-white flex items-center justify-center text-xs shadow-2xs group-hover:bg-white group-hover:text-[#229ED9] transition-colors">
                  <i className="fa-brands fa-telegram font-bold"></i>
                </div>
                <span className="text-xs font-bold truncate">Telegram</span>
              </a>

              {/* Copier le lien direct */}
              <button
                type="button"
                onClick={() => handleCopyLink()}
                className={`flex items-center gap-2 p-2 rounded-xl transition-colors group text-left cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-2xs ${
                    copied ? "bg-white text-emerald-600" : "bg-gray-700 text-white"
                  }`}
                >
                  <i className={`fa-solid ${copied ? "fa-check" : "fa-link"}`}></i>
                </div>
                <span className="text-xs font-bold truncate">
                  {copied ? "Copié !" : "Copier lien"}
                </span>
              </button>
            </div>

            {/* Bouton Partage Natif Mobile supplémentaire si disponible */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full mt-2 py-1.5 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold text-[11px] rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <i className="fa-solid fa-up-right-from-square text-[10px]"></i>
                <span>Plus d'options de partage (système)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Réactions Sociales (👍 ❤️) */}
      <div
        onClick={toggleLike}
        className="flex items-center gap-1 text-[11px] font-extrabold text-gray-500 hover:text-gray-900 bg-white hover:bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200/80 shadow-2xs cursor-pointer transition select-none"
      >
        <div className="flex -space-x-1 items-center">
          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center shadow-xs">
            👍
          </span>
          <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center shadow-xs">
            ❤️
          </span>
        </div>
        <span className={`${hasLiked ? "text-blue-600 font-black" : ""}`}>{likes}</span>
      </div>
    </div>
  );
}
