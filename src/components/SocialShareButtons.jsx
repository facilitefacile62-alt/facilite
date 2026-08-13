"use strict";
"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Barre d'Engagement & Partage Réseau Social (Style LinkedIn / 4 Actions)
 * - Statuts sociaux : 👍 ❤️ 💡 (compteur) + Salaire / Contrat
 * - 4 Actions horizontales :
 *   1. 👍 J'aime
 *   2. 💰 Salaire / Info ("Non renseigné" ou montant)
 *   3. ↪️ Partager (Bouton vert avec menu déroulant de tous les réseaux sociaux)
 *   4. ✈️ Envoyer (Postuler directement)
 */
export default function SocialShareButtons({
  offer,
  variant = "compact", // "compact" | "banner"
  className = "",
  onApply,
  externalLink,
  externalButtonLabel,
  onToast,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likes, setLikes] = useState(24 + Math.floor(((offer?.id || 1) * 7) % 85));
  const [hasLiked, setHasLiked] = useState(false);
  const dropdownRef = useRef(null);

  const offerId = offer?.id || "";
  const title = offer?.title || offer?.titleFR || "Offre d'emploi";
  const company = offer?.company || "Facilite";
  const location = offer?.location || "Sénégal";
  const contract = offer?.contract || offer?.contract_type || "CDI";
  const salary = offer?.salary || offer?.salary_range || "Non renseigné";

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

  // 1. Rendu Compact pour le Flux d'Accueil et Listes (Style LinkedIn 4 Actions)
  if (variant === "compact") {
    return (
      <div className={`w-full flex flex-col pt-2 border-t border-gray-100 ${className}`} ref={dropdownRef}>
        {/* Ligne 1 : Compteurs Sociaux & Badge Salaire (Style LinkedIn) */}
        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 pb-2 px-1 border-b border-gray-100/70 select-none">
          {/* Réactions */}
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={toggleLike}>
            <div className="flex -space-x-1 items-center">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center shadow-xs">
                👍
              </span>
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center shadow-xs">
                💡
              </span>
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center shadow-xs">
                ❤️
              </span>
            </div>
            <span className={`font-extrabold ${hasLiked ? "text-blue-600" : "text-gray-600"}`}>{likes}</span>
          </div>

          {/* Salaire / Info Statut */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>{location} • {contract}</span>
          </div>
        </div>

        {/* Ligne 2 : Les 4 Actions Horizontales (J'aime, Info Salaire, Partager avec Menu, Envoyer/Postuler) */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-2">
          {/* Action 1 : J'aime */}
          <button
            type="button"
            onClick={toggleLike}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              hasLiked
                ? "text-blue-600 bg-blue-50/80"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <i className={`fa-regular fa-thumbs-up text-xs sm:text-sm ${hasLiked ? "text-blue-600 font-bold" : ""}`}></i>
            <span className="hidden xs:inline">{hasLiked ? "Aimé" : "J'aime"}</span>
          </button>

          {/* Action 2 : Salaire / Statut (Non renseigné ou montant) */}
          <div
            className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-xl text-xs font-extrabold text-gray-700 bg-gray-50 border border-gray-200/80 truncate text-center"
            title={`Salaire : ${salary}`}
          >
            <span className="text-[11px] truncate">
              {salary && salary !== "Non spécifié" && salary !== "Non renseigné" ? `💰 ${salary}` : "💰 Non renseigné"}
            </span>
          </div>

          {/* Action 3 : Partager (Bouton Vert Pilule avec Menu Déroulant) */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((prev) => !prev);
              }}
              className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs transition-all border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
              title="Partager cette annonce"
            >
              {/* Flèche incurvée de partage */}
              <svg
                className="w-3.5 h-3.5 text-emerald-800"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>Partager</span>
              <i
                className={`fa-solid fa-chevron-down text-[8px] transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              ></i>
            </button>

            {/* Menu Déroulant Flottant de Partage Social */}
            {dropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-72 sm:w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
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
              </div>
            )}
          </div>

          {/* Action 4 : Envoyer / Postuler */}
          <div className="flex-1">
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-xl bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-xs transition-all shadow-sm transform hover:-translate-y-0.5 cursor-pointer text-center"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>{externalButtonLabel || "Envoyer"}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onApply && onApply(offer)}
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-xl bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-xs transition-all shadow-sm transform hover:-translate-y-0.5 cursor-pointer text-center"
              >
                <i className="fa-solid fa-paper-plane text-xs"></i>
                <span>Envoyer</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Rendu Bannière Complète (Pour la page /offres/[id])
  return (
    <div
      className={`bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-2">
              <span>Partager cette opportunité</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">
                1 Clic
              </span>
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              Faites rayonner cette offre auprès de vos contacts et réseaux
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Reaction */}
          <button
            type="button"
            onClick={toggleLike}
            className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>👍 ❤️</span>
            <span className={hasLiked ? "text-blue-600 font-black" : ""}>{likes}</span>
          </button>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-share-from-square"></i>
              <span>Partager</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {/* WhatsApp */}
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition shadow-xs"
        >
          <i className="fa-brands fa-whatsapp text-sm"></i>
          <span>WhatsApp</span>
        </a>

        {/* LinkedIn */}
        <a
          href={shareLinks.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs font-bold transition shadow-xs"
        >
          <i className="fa-brands fa-linkedin-in text-sm"></i>
          <span>LinkedIn</span>
        </a>

        {/* Facebook */}
        <a
          href={shareLinks.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#1877F2] hover:bg-[#1464c9] text-white text-xs font-bold transition shadow-xs"
        >
          <i className="fa-brands fa-facebook-f text-sm"></i>
          <span>Facebook</span>
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
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <i className="fa-brands fa-tiktok text-sm"></i>
          <span>TikTok</span>
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
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <i className="fa-brands fa-instagram text-sm"></i>
          <span>Instagram</span>
        </button>

        {/* Twitter / X */}
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-800 hover:bg-black text-white text-xs font-bold transition shadow-xs"
        >
          <i className="fa-brands fa-x-twitter text-sm"></i>
          <span>X / Twitter</span>
        </a>

        {/* Copier le lien */}
        <button
          type="button"
          onClick={() => handleCopyLink()}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
            copied
              ? "bg-emerald-700 text-white"
              : "bg-white hover:bg-gray-100 text-gray-800 border border-gray-200"
          }`}
        >
          <i className={`fa-solid ${copied ? "fa-check text-emerald-300" : "fa-copy"}`}></i>
          <span>{copied ? "Copié !" : "Copier lien"}</span>
        </button>
      </div>
    </div>
  );
}
