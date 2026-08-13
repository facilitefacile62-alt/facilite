"use strict";
"use client";

import { useState } from "react";

/**
 * Composant de Partage Social Universel & Barre d'Engagement (Style LinkedIn / Facebook)
 * Inspiré des standards des réseaux sociaux :
 * - Bouton avec la flèche incurvée de partage (Share icon)
 * - Boutons de partage direct en 1 clic : WhatsApp, LinkedIn, Facebook, TikTok, Instagram, X, Copier
 * - Réactions interactives (👍 ❤️ 🚀)
 */
export default function SocialShareButtons({
  offer,
  variant = "compact", // "compact" | "banner"
  className = "",
  onToast,
}) {
  const [copied, setCopied] = useState(false);
  const [likes, setLikes] = useState(12 + Math.floor((offer?.id || 1) * 3 % 40));
  const [hasLiked, setHasLiked] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

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

  const handleCopyLink = (platformName = "") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      const msg = platformName
        ? `Lien copié pour partager sur ${platformName} !`
        : "Lien de l'offre copié dans le presse-papier !";
      if (onToast) onToast(msg);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async (e) => {
    if (e) e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${company}`,
          text: shareText,
          url: shareUrl,
        });
        if (onToast) onToast("Offre partagée avec succès !");
      } catch {
        // user cancelled or share failed
      }
    } else {
      setShowShareMenu(!showShareMenu);
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

  // 1. Rendu Compact (Pour le fil d'actualité et les cartes)
  if (variant === "compact") {
    return (
      <div className={`w-full flex items-center justify-between gap-2 flex-wrap ${className}`}>
        {/* Flèche de Partage Principale & Boutons Réseaux Sociaux */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Bouton avec la Flèche Incurvée Principale (Style Facebook/LinkedIn) */}
          <button
            type="button"
            onClick={handleNativeShare}
            title="Partager cette annonce"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-800 font-extrabold text-xs transition-all transform hover:scale-105 border border-gray-200/90 shadow-2xs cursor-pointer group"
          >
            {/* Flèche de partage incurvée type Facebook/LinkedIn */}
            <svg
              className="w-3.5 h-3.5 text-gray-700 group-hover:text-emerald-700 transition transform group-hover:rotate-6"
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
          </button>

          {/* WhatsApp */}
          <a
            href={shareLinks.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            title="Partager sur WhatsApp"
            className="w-7 h-7 rounded-full bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-[#25D366]/20"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fa-brands fa-whatsapp font-bold"></i>
          </a>

          {/* LinkedIn */}
          <a
            href={shareLinks.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            title="Partager sur LinkedIn"
            className="w-7 h-7 rounded-full bg-[#0A66C2]/10 hover:bg-[#0A66C2] text-[#0A66C2] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-[#0A66C2]/20"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fa-brands fa-linkedin-in font-bold"></i>
          </a>

          {/* Facebook */}
          <a
            href={shareLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            title="Partager sur Facebook"
            className="w-7 h-7 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2] text-[#1877F2] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-[#1877F2]/20"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fa-brands fa-facebook-f font-bold"></i>
          </a>

          {/* TikTok */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof navigator !== "undefined" && navigator.share) {
                handleNativeShare(e);
              } else {
                handleCopyLink("TikTok");
              }
            }}
            title="Partager sur TikTok"
            className="w-7 h-7 rounded-full bg-black/10 hover:bg-black text-gray-900 hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-gray-300 cursor-pointer"
          >
            <i className="fa-brands fa-tiktok font-bold"></i>
          </button>

          {/* Instagram */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof navigator !== "undefined" && navigator.share) {
                handleNativeShare(e);
              } else {
                handleCopyLink("Instagram");
              }
            }}
            title="Partager sur Instagram"
            className="w-7 h-7 rounded-full bg-[#E4405F]/10 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-[#E4405F] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-[#E4405F]/20 cursor-pointer"
          >
            <i className="fa-brands fa-instagram font-bold"></i>
          </button>

          {/* Twitter / X */}
          <a
            href={shareLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            title="Partager sur X (Twitter)"
            className="w-7 h-7 rounded-full bg-gray-900/10 hover:bg-gray-900 text-gray-900 hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs border border-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fa-brands fa-x-twitter font-bold"></i>
          </a>

          {/* Copier le lien direct */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
            title="Copier le lien direct"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs cursor-pointer border ${
              copied
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
            }`}
          >
            <i className={`fa-solid ${copied ? "fa-check" : "fa-link"}`}></i>
          </button>
        </div>

        {/* Réactions Sociales (Comme sur Facebook/LinkedIn : 👍 ❤️) */}
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
          <span className={`${hasLiked ? "text-blue-600" : ""}`}>{likes}</span>
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
