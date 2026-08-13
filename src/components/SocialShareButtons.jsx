"use strict";
"use client";

import { useState } from "react";

/**
 * Composant de Partage Social Universel pour les Offres d'Emploi
 * Permet le partage en 1 clic vers :
 * - WhatsApp
 * - Facebook
 * - LinkedIn
 * - Twitter / X
 * - Telegram
 * - Instagram / TikTok (via Web Share API ou Copie Intelligente du lien)
 * - Copier le lien direct
 */
export default function SocialShareButtons({
  offer,
  variant = "compact", // "compact" | "banner" | "modal"
  className = "",
  onToast,
}) {
  const [copied, setCopied] = useState(false);

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

  const handleNativeShare = async () => {
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
      handleCopyLink();
    }
  };

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };

  // 1. Rendu Compact (Pour les cartes dans les listes et flux)
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-600 mr-1 flex items-center gap-1">
          <i className="fa-solid fa-share-nodes text-emerald-700"></i>
          Partager :
        </span>

        {/* WhatsApp */}
        <a
          href={shareLinks.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          title="Partager sur WhatsApp"
          className="w-7 h-7 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs"
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
          className="w-7 h-7 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2] text-[#0A66C2] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs"
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
          className="w-7 h-7 rounded-lg bg-[#1877F2]/10 hover:bg-[#1877F2] text-[#1877F2] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs"
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
              handleNativeShare();
            } else {
              handleCopyLink("TikTok");
            }
          }}
          title="Partager sur TikTok"
          className="w-7 h-7 rounded-lg bg-black/10 hover:bg-black text-gray-900 hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs cursor-pointer"
        >
          <i className="fa-brands fa-tiktok font-bold"></i>
        </button>

        {/* Instagram */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== "undefined" && navigator.share) {
              handleNativeShare();
            } else {
              handleCopyLink("Instagram");
            }
          }}
          title="Partager sur Instagram"
          className="w-7 h-7 rounded-lg bg-[#E4405F]/10 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-[#E4405F] hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs cursor-pointer"
        >
          <i className="fa-brands fa-instagram font-bold"></i>
        </button>

        {/* Twitter / X */}
        <a
          href={shareLinks.twitter}
          target="_blank"
          rel="noopener noreferrer"
          title="Partager sur X (Twitter)"
          className="w-7 h-7 rounded-lg bg-gray-900/10 hover:bg-gray-900 text-gray-900 hover:text-white flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs"
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
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition transform hover:scale-110 shadow-2xs cursor-pointer ${
            copied ? "bg-emerald-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          <i className={`fa-solid ${copied ? "fa-check" : "fa-link"}`}></i>
        </button>
      </div>
    );
  }

  // 2. Rendu Bannière Complète (Pour la page de détail d'offre /offres/[id])
  return (
    <div
      className={`bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
            <i className="fa-solid fa-bullhorn"></i>
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-gray-900">
              Partager cette opportunité
            </h4>
            <p className="text-[11px] text-gray-500 font-medium">
              Aidez un proche ou faites rayonner cette offre sur vos réseaux
            </p>
          </div>
        </div>

        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <i className="fa-solid fa-share-from-square"></i>
            Partage rapide
          </button>
        )}
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
