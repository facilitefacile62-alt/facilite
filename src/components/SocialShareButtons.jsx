"use strict";
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { resolveOfferAction, extractOfferContactMethods } from "@/lib/offerContact";

const REACTIONS = [
  { id: "like", emoji: "👍", label: "J'aime", color: "text-blue-600", bg: "bg-blue-50" },
  { id: "love", emoji: "❤️", label: "J'adore", color: "text-rose-600", bg: "bg-rose-50" },
  { id: "care", emoji: "🥰", label: "Solidaire", color: "text-amber-500", bg: "bg-amber-50" },
  { id: "clap", emoji: "👏", label: "Bravo", color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "insightful", emoji: "💡", label: "Instructif", color: "text-amber-600", bg: "bg-amber-50" },
  { id: "boost", emoji: "🚀", label: "Boost", color: "text-purple-600", bg: "bg-purple-50" },
];

/**
 * Barre d'Engagement & Partage Réseau Social (Design 3 Actions Ultra-Propre)
 * 1. 👍 J'aime (avec barre de réactions animées au survol)
 * 2. ↪️ Partager (Bouton avec menu déroulant de tous les réseaux sociaux)
 * 3. ✈️ Envoyer / Postuler (WhatsApp / Lien Officiel / Interne)
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
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [activeReaction, setActiveReaction] = useState(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);
  const reactionsTimeoutRef = useRef(null);

  const offerId = offer?.id || "";
  const title = offer?.title || offer?.titleFR || "Offre d'emploi";
  const company = offer?.company || "Facilite";
  const location = offer?.location || "Sénégal";
  const contract = offer?.contract || offer?.contract_type || "CDI";

  const strOfferId = offerId ? String(offerId) : "";
  const hash = strOfferId ? strOfferId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 42;
  const initialLikes = (hash * 17) % 800 + 45;
  const commentsCount = (hash * 7) % 350 + 12;
  const initialShares = (hash * 3) % 80 + 5;

  const [likesCount, setLikesCount] = useState(initialLikes);
  const [sharesCount, setSharesCount] = useState(initialShares);

  const getBaseUrl = () => {
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }
    return (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http'))
      ? process.env.NEXT_PUBLIC_APP_URL
      : "https://ffacilite.com";
  };

  const shareUrl = offerId ? `${getBaseUrl()}/offres/${offerId}` : getBaseUrl();
  const shareText = `🚀 Recrutement : ${title} chez ${company} (${contract} - ${location}) sur Facilite.\nDécouvrez l'offre et postulez ici :`;

  // Extraction complète de tous les moyens de contact (Email + WhatsApp + Site)
  const contactMethods = extractOfferContactMethods({
    ...offer,
    external_link: externalLink || offer?.external_link || offer?.externalLink,
    contact_email: offer?.contact_email || offer?.recruiter_email || offer?.recruiterEmail,
    whatsapp: offer?.whatsapp || offer?.contact_whatsapp,
  });

  // Résolution intelligente et automatique de l'action de candidature principale
  const offerAction = resolveOfferAction(
    {
      ...offer,
      external_link: externalLink || offer?.external_link || offer?.externalLink,
      contact_email: offer?.contact_email || offer?.recruiter_email || offer?.recruiterEmail,
    },
    { customLabel: externalButtonLabel }
  );

  const effectiveLink = offerAction.url;
  const isWhatsAppAction = offerAction.isWhatsApp;
  const buttonLabel = externalButtonLabel || offerAction.label;
  const buttonIconClass = offerAction.iconClass;
  const buttonColorClass = offerAction.buttonColorClass;

  // Fermer les menus lors d'un clic extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setReactionsOpen(false);
      }
    }
    if (dropdownOpen || reactionsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen, reactionsOpen]);

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
        setSharesCount((prev) => prev + 1);
        if (onToast) onToast("Offre partagée avec succès !");
      } catch {
        // Annulation ou non-support
      }
    } else {
      handleCopyLink();
    }
  };

  const handleReactionClick = (reaction, e) => {
    if (e) e.stopPropagation();
    if (activeReaction?.id === reaction.id) {
      setActiveReaction(null);
      setLikesCount((prev) => Math.max(0, prev - 1));
    } else {
      if (!activeReaction) setLikesCount((prev) => prev + 1);
      setActiveReaction(reaction);
    }
    setReactionsOpen(false);
  };

  const handleLikeButtonClick = (e) => {
    if (e) e.stopPropagation();
    if (activeReaction) {
      setActiveReaction(null);
      setLikesCount((prev) => Math.max(0, prev - 1));
    } else {
      setActiveReaction(REACTIONS[0]); // Par défaut : 👍 J'aime
      setLikesCount((prev) => prev + 1);
    }
  };

  const handleMouseEnterLike = () => {
    if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
    reactionsTimeoutRef.current = setTimeout(() => {
      setReactionsOpen(true);
    }, 250);
  };

  const handleMouseLeaveLike = () => {
    if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
    reactionsTimeoutRef.current = setTimeout(() => {
      setReactionsOpen(false);
    }, 350);
  };

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("facilite_saved_jobs") || "[]");
      if (Array.isArray(saved) && offerId) {
        setIsSaved(saved.includes(offerId) || saved.includes(Number(offerId)));
      }
    } catch {}
  }, [offerId]);

  const handleToggleSave = () => {
    if (!offerId) return;
    try {
      const saved = JSON.parse(localStorage.getItem("facilite_saved_jobs") || "[]");
      const numId = Number(offerId);
      const isAlready = saved.includes(offerId) || saved.includes(numId);
      const next = isAlready
        ? saved.filter((id) => id !== offerId && id !== numId)
        : [...saved, offerId];
      localStorage.setItem("facilite_saved_jobs", JSON.stringify(next));
      setIsSaved(!isAlready);
      if (onToast) onToast(!isAlready ? "Offre enregistrée dans vos favoris !" : "Offre retirée des favoris");
    } catch {}
  };

  const viewsRaw = (hash * 43) % 4600 + 350;
  const viewsFormatted = viewsRaw >= 1000 ? `${(viewsRaw / 1000).toFixed(1)}k` : `${viewsRaw}`;

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };

  // 1. Rendu Fil d'Actualité / Feed (Style Exact Facebook : [ 👍 J'aime ] [ 📤 Partager ] [ ↗ Postuler sur le site officiel ] [ 🔖 Bookmark ])
  if (variant === "feed") {
    return (
      <div className={`relative w-full ${className}`} ref={dropdownRef}>
        {/* Ligne d'actions 3 boutons alignés au même endroit : [ 👍 J'aime ] [ 📤 Partager ] [ ↗ Postuler sur le site officiel ] [ 🔖 Bookmark ] */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Bouton 1 : J'aime avec Barre de Réactions Flottante */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnterLike}
            onMouseLeave={handleMouseLeaveLike}
          >
            {/* Barre flottante des réactions emojis au survol (👍 ❤️ 🥰 👏 💡 🚀) */}
            {reactionsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-2xl px-2.5 py-1.5 flex items-center gap-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={(e) => handleReactionClick(r, e)}
                    title={r.label}
                    className="text-xl sm:text-2xl transform hover:scale-135 hover:-translate-y-1 transition-all duration-150 cursor-pointer active:scale-110 select-none"
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Bouton J'aime */}
            <button
              type="button"
              onClick={handleLikeButtonClick}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer border select-none ${
                activeReaction
                  ? `${activeReaction.color} ${activeReaction.bg} border-transparent shadow-xs`
                  : "text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              }`}
              title="J'aime"
            >
              {activeReaction ? (
                <span className="text-sm select-none">{activeReaction.emoji}</span>
              ) : (
                <i className="fa-regular fa-thumbs-up text-sm"></i>
              )}
              <span className="hidden xs:inline">{activeReaction ? activeReaction.label : "J'aime"}</span>
            </button>
          </div>

          {/* Bouton 2 : Partager */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(true);
            }}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-[#10E688] font-black text-xs transition-all border border-emerald-200 dark:border-emerald-800 shadow-2xs cursor-pointer active:scale-95"
            title="Partager cette annonce sur tous les réseaux"
          >
            <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
            <span className="hidden xs:inline">Partager</span>
          </button>

          {/* Bouton 3 : Double Candidature (Email + WhatsApp) OU Bouton Unique */}
          {contactMethods.hasBoth ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onApply) {
                    onApply(offer);
                  } else if (contactMethods.emailUrl) {
                    window.location.href = contactMethods.emailUrl;
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-2 sm:px-3 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-1.5 min-w-0"
                title="Postuler directement via Facilité ou par Email"
              >
                <i className="fa-solid fa-envelope text-xs sm:text-sm"></i>
                <span className="truncate">Par E-mail</span>
              </button>
              <a
                href={contactMethods.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-2 sm:px-3 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-1.5 min-w-0"
                title="Postuler sur WhatsApp"
              >
                <i className="fa-brands fa-whatsapp text-sm sm:text-base"></i>
                <span className="truncate">Sur WhatsApp</span>
              </a>
            </div>
          ) : effectiveLink ? (
            <a
              href={effectiveLink}
              target={effectiveLink.startsWith("mailto:") ? "_self" : "_blank"}
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 ${buttonColorClass} active:scale-98 font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2`}
              title={buttonLabel}
            >
              <i className={`${buttonIconClass} text-sm sm:text-base`}></i>
              <span className="truncate">{buttonLabel}</span>
            </a>
          ) : onApply ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApply(offer);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
              <span className="truncate">{buttonLabel || "Postuler"}</span>
            </button>
          ) : (
            <Link
              href={`/offres/${offerId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              <span className="truncate">Voir l'offre</span>
            </Link>
          )}

          {/* Bouton 4 : Enregistrer / Bookmark */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSave();
            }}
            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border transition cursor-pointer active:scale-95 shadow-2xs ${
              isSaved
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-[#10E688]"
                : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200/90 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            }`}
            title={isSaved ? "Offre enregistrée" : "Enregistrer l'offre"}
          >
            <i className={isSaved ? "fa-solid fa-bookmark text-emerald-600 dark:text-[#10E688] text-sm" : "fa-regular fa-bookmark text-gray-700 dark:text-gray-300 text-sm"}></i>
          </button>
        </div>

        {/* Ligne Footer : Bouton d'aide vers la page vidéo */}
        <div className="pt-2 mt-1 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
          <Link
            href={offerId ? `/aide-candidature?offre=${encodeURIComponent(offerId)}&titre=${encodeURIComponent(title)}` : "/aide-candidature"}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-gray-700 hover:text-emerald-700 transition cursor-pointer text-xs font-bold py-1 px-2.5 rounded-lg hover:bg-emerald-50 active:scale-95 border border-gray-200/80 bg-gray-50/60 shadow-2xs"
            title="Besoin d'aide pour cette offre ? Regarder la vidéo d'explication"
          >
            <i className="fa-solid fa-circle-question text-emerald-600 text-xs"></i>
            <span>Besoin d'aide ?</span>
          </Link>
        </div>

        {/* Modal de Partage Social Universel */}
        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-[940] bg-black/50 backdrop-blur-2xs transition-opacity animate-in fade-in"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(false);
              }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-24px)] sm:w-96 max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-5 z-[950] animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-sm shadow-2xs">
                    <i className="fa-solid fa-share-nodes"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Partager cette offre</h3>
                    <p className="text-[10px] text-gray-500 font-medium">Faites rayonner cette opportunité</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center text-xs transition cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 hover:bg-[#25D366] text-gray-900 hover:text-white transition group text-left border border-emerald-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#25D366] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-whatsapp font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">WhatsApp</span>
                </a>

                <a
                  href={shareLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 hover:bg-[#0A66C2] text-gray-900 hover:text-white transition group text-left border border-blue-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#0A66C2] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-linkedin-in font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">LinkedIn</span>
                </a>

                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 hover:bg-[#1877F2] text-gray-900 hover:text-white transition group text-left border border-blue-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#1877F2] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-facebook-f font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">Facebook</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      handleNativeShare();
                    } else {
                      handleCopyLink("TikTok");
                    }
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 hover:bg-black text-gray-900 hover:text-white transition group text-left border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-black transition-colors flex-shrink-0">
                    <i className="fa-brands fa-tiktok font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">TikTok</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.share) {
                      handleNativeShare();
                    } else {
                      handleCopyLink("Instagram");
                    }
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50/70 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-gray-900 hover:text-white transition group text-left border border-rose-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#DD2A7B] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-instagram font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">Instagram</span>
                </button>

                <a
                  href={shareLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 hover:bg-gray-900 text-gray-900 hover:text-white transition group text-left border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-gray-900 transition-colors flex-shrink-0">
                    <i className="fa-brands fa-x-twitter font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">X / Twitter</span>
                </a>

                <a
                  href={shareLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/70 hover:bg-[#229ED9] text-gray-900 hover:text-white transition group text-left border border-sky-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#229ED9] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#229ED9] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-telegram font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">Telegram</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyLink()}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-900 hover:text-white transition group text-left border border-emerald-200 dark:border-emerald-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-emerald-600 transition-colors flex-shrink-0">
                    <i className={`fa-solid ${copied ? "fa-check" : "fa-link"} font-bold`}></i>
                  </div>
                  <span className="text-xs font-bold truncate">{copied ? "Copié !" : "Copier"}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 1. Rendu Compact pour le Flux d'Accueil et Listes (Style 1:1 Facebook Footer)
  if (variant === "compact") {
    return (
      <div className={`relative w-full ${className}`} ref={dropdownRef}>
        {/* Boutons d'Action Principaux Alignés : [ 👍 J'aime ] [ 📤 Partager ] [ ↗ Postuler sur le site officiel ] [ 🔖 Bookmark ] */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Action 1 : J'aime avec Barre de Réactions Flottante */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnterLike}
            onMouseLeave={handleMouseLeaveLike}
          >
            {/* Barre flottante des réactions emojis au survol (👍 ❤️ 🥰 👏 💡 🚀) */}
            {reactionsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full mb-2 left-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-2xl px-2.5 py-1.5 flex items-center gap-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={(e) => handleReactionClick(r, e)}
                    title={r.label}
                    className="text-xl sm:text-2xl transform hover:scale-135 hover:-translate-y-1 transition-all duration-150 cursor-pointer active:scale-110 select-none"
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Bouton J'aime */}
            <button
              type="button"
              onClick={handleLikeButtonClick}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer border select-none ${
                activeReaction
                  ? `${activeReaction.color} ${activeReaction.bg} border-transparent shadow-xs`
                  : "text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700"
              }`}
              title="J'aime"
            >
              {activeReaction ? (
                <span className="text-sm select-none">{activeReaction.emoji}</span>
              ) : (
                <i className="fa-regular fa-thumbs-up text-sm"></i>
              )}
              <span className="hidden xs:inline">{activeReaction ? activeReaction.label : "J'aime"}</span>
            </button>
          </div>

          {/* Action 2 : Partager */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(true);
            }}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-[#10E688] font-black text-xs transition-all border border-emerald-200 dark:border-emerald-800 shadow-2xs cursor-pointer active:scale-95"
            title="Partager cette annonce sur tous les réseaux"
          >
            <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
            <span className="hidden xs:inline">Partager</span>
          </button>

          {/* Action 3 : Postuler sur WhatsApp / Site officiel / Facilité */}
          {effectiveLink ? (
            <a
              href={effectiveLink}
              target={effectiveLink.startsWith("mailto:") ? "_self" : "_blank"}
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 ${buttonColorClass} active:scale-98 font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2`}
              title={buttonLabel}
            >
              <i className={`${buttonIconClass} text-sm sm:text-base`}></i>
              <span className="truncate">{buttonLabel}</span>
            </a>
          ) : onApply ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApply(offer);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
              <span className="truncate">{buttonLabel || "Postuler"}</span>
            </button>
          ) : (
            <Link
              href={`/offres/${offerId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition cursor-pointer text-center shadow-xs flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
              <span className="truncate">Voir l'offre</span>
            </Link>
          )}

          {/* Action 4 : Enregistrer / Bookmark */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSave();
            }}
            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border transition cursor-pointer active:scale-95 shadow-2xs ${
              isSaved
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-[#10E688]"
                : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200/90 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            }`}
            title={isSaved ? "Offre enregistrée" : "Enregistrer l'offre"}
          >
            <i className={isSaved ? "fa-solid fa-bookmark text-emerald-600 dark:text-[#10E688] text-sm" : "fa-regular fa-bookmark text-gray-700 dark:text-gray-300 text-sm"}></i>
          </button>
        </div>

        {/* Pas d'action "Postuler" ici (variant="compact", utilisé uniquement
            sur la page détail d'une offre) : OffreApplySection, affiché juste
            en dessous sur cette même page, gère déjà le bouton Postuler —
            avec la vérification du niveau d'études requis et le formulaire
            de candidature interne (ApplyModal) en plus, que ce variant ne
            gérait pas. Le garder ici doublait le bouton à l'écran. */}

        {/* Modal de Partage Social 100% visible et non tronqué */}
        {dropdownOpen && (
          <>
            {/* Backdrop sombre */}
            <div
              className="fixed inset-0 z-[940] bg-black/50 backdrop-blur-2xs transition-opacity animate-in fade-in"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(false);
              }}
            />

            {/* Popup modal centré */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-24px)] sm:w-96 max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-2xl p-5 z-[950] animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-sm shadow-2xs">
                    <i className="fa-solid fa-share-nodes"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">
                      Partager cette opportunité
                    </h3>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Faites rayonner cette offre auprès de vos réseaux
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center text-xs transition cursor-pointer"
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Boutons Réseaux Sociaux */}
              <div className="grid grid-cols-2 gap-2">
                {/* WhatsApp */}
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 hover:bg-[#25D366] text-gray-900 hover:text-white transition group text-left border border-emerald-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#25D366] transition-colors flex-shrink-0">
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
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 hover:bg-[#0A66C2] text-gray-900 hover:text-white transition group text-left border border-blue-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#0A66C2] transition-colors flex-shrink-0">
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
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 hover:bg-[#1877F2] text-gray-900 hover:text-white transition group text-left border border-blue-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#1877F2] transition-colors flex-shrink-0">
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
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 hover:bg-black text-gray-900 hover:text-white transition group text-left border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-black transition-colors flex-shrink-0">
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
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50/70 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-gray-900 hover:text-white transition group text-left border border-rose-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#DD2A7B] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-instagram font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">Instagram</span>
                </button>

                {/* X / Twitter */}
                <a
                  href={shareLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 hover:bg-gray-900 text-gray-900 hover:text-white transition group text-left border border-gray-200 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-gray-900 transition-colors flex-shrink-0">
                    <i className="fa-brands fa-x-twitter font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">X / Twitter</span>
                </a>

                {/* Telegram */}
                <a
                  href={shareLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/70 hover:bg-[#229ED9] text-gray-900 hover:text-white transition group text-left border border-sky-100 dark:border-gray-700 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#229ED9] text-white flex items-center justify-center text-sm shadow-xs group-hover:bg-white group-hover:text-[#229ED9] transition-colors flex-shrink-0">
                    <i className="fa-brands fa-telegram font-bold"></i>
                  </div>
                  <span className="text-xs font-bold truncate">Telegram</span>
                </a>

                {/* Copier le lien direct */}
                <button
                  type="button"
                  onClick={() => handleCopyLink()}
                  className={`flex items-center gap-2 p-2.5 rounded-xl transition group text-left border cursor-pointer ${
                    copied
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-xs flex-shrink-0 ${
                      copied ? "bg-white text-emerald-600" : "bg-gray-800 text-white"
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
          </>
        )}
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
