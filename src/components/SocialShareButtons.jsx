"use strict";
"use client";

import { useState, useRef, useEffect } from "react";

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
 * 3. ✈️ Envoyer (Postuler directement)
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

  const hash = offerId ? offerId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 42;
  const initialLikes = (hash * 17) % 800 + 45;
  const commentsCount = (hash * 7) % 350 + 12;
  const initialShares = (hash * 3) % 80 + 5;

  const [likesCount, setLikesCount] = useState(initialLikes);
  const [sharesCount, setSharesCount] = useState(initialShares);

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://ffacilite.com";
  };

  const shareUrl = offerId ? `${getBaseUrl()}/offres/${offerId}` : getBaseUrl();
  const shareText = `🚀 Recrutement : ${title} chez ${company} (${contract} - ${location}) sur Facilite.\nDécouvrez l'offre et postulez ici :`;

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

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };

  // 1. Rendu Compact pour le Flux d'Accueil et Listes (Style 1:1 Facebook Footer)
  if (variant === "compact") {
    return (
      <div className={`relative w-full pt-2 border-t border-gray-100 ${className}`} ref={dropdownRef}>
        {/* Barre de Stats Facebook (👍 796, 💬 395, ↪️ 29, 🔵👍) */}
        <div className="flex items-center justify-between px-1 pb-2 text-xs text-gray-600 font-semibold select-none">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* 👍 Likes */}
            <button
              type="button"
              onClick={handleLikeButtonClick}
              className={`flex items-center gap-1.5 hover:text-[#1877F2] transition cursor-pointer ${
                activeReaction ? "text-[#1877F2] font-bold" : "text-gray-600"
              }`}
              title="J'aime"
            >
              <i className={`fa-regular fa-thumbs-up text-sm ${activeReaction ? "text-[#1877F2] fa-solid" : ""}`}></i>
              <span>{likesCount}</span>
            </button>

            {/* 💬 Commentaires / Messagerie */}
            <Link
              href="/messagerie"
              className="flex items-center gap-1.5 hover:text-emerald-600 transition cursor-pointer text-gray-600"
              title="Commentaires et messages"
            >
              <i className="fa-regular fa-comment text-sm"></i>
              <span>{commentsCount}</span>
            </Link>

            {/* ↪️ Partages (Ouvre tous les liens au clic) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(true);
              }}
              className="flex items-center gap-1.5 hover:text-emerald-600 transition cursor-pointer text-gray-600"
              title="Partager sur tous les réseaux"
            >
              <svg
                className="w-4 h-4 text-gray-600 hover:text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>{sharesCount}</span>
            </button>
          </div>

          {/* Pastille ronde bleue Facebook */}
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[9px] shadow-2xs">
              <i className="fa-solid fa-thumbs-up"></i>
            </div>
          </div>
        </div>

        {/* Boutons d'Action Principaux */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-1 border-t border-gray-100/80">
          {/* Action 1 : J'aime avec Barre de Réactions Flottante */}
          <div
            className="relative flex-1 min-w-0"
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
              className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer border truncate ${
                activeReaction
                  ? `${activeReaction.color} ${activeReaction.bg} border-transparent shadow-xs`
                  : "text-gray-700 bg-gray-50/90 hover:bg-gray-100 border-gray-200/80 hover:border-gray-300"
              }`}
            >
              {activeReaction ? (
                <span className="text-xs sm:text-sm select-none">{activeReaction.emoji}</span>
              ) : (
                <i className="fa-regular fa-thumbs-up text-xs sm:text-sm"></i>
              )}
              <span className="truncate">{activeReaction ? activeReaction.label : "J'aime"}</span>
            </button>
          </div>

          {/* Action 2 : Partager (Ouvre le modal avec tous les liens) */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] sm:text-xs transition-all border border-emerald-200/90 shadow-2xs cursor-pointer active:scale-95 truncate"
              title="Partager cette annonce sur tous les réseaux"
            >
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
            </button>
          </div>

          {/* Action 3 : Envoyer */}
          <div className="flex-1 min-w-0">
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-[#10E688] hover:bg-[#0fd07b] text-gray-950 font-black text-[11px] sm:text-xs transition-all shadow-xs active:scale-95 truncate"
                title="Postuler à cette offre"
              >
                <i className="fa-solid fa-paper-plane text-xs flex-shrink-0"></i>
                <span className="truncate">{externalButtonLabel || "Envoyer"}</span>
              </a>
            ) : onApply ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply(offer);
                }}
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-[#10E688] hover:bg-[#0fd07b] text-gray-950 font-black text-[11px] sm:text-xs transition-all shadow-xs active:scale-95 cursor-pointer truncate"
                title="Postuler à cette offre"
              >
                <i className="fa-solid fa-paper-plane text-xs flex-shrink-0"></i>
                <span className="truncate">Envoyer</span>
              </button>
            ) : (
              <Link
                href={`/offres/${offerId}`}
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-[#10E688] hover:bg-[#0fd07b] text-gray-950 font-black text-[11px] sm:text-xs transition-all shadow-xs active:scale-95 truncate"
                title="Consulter et postuler"
              >
                <i className="fa-solid fa-paper-plane text-xs flex-shrink-0"></i>
                <span className="truncate">Envoyer</span>
              </Link>
            )}
          </div>
        </div>

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

          {/* Action 3 : Envoyer / Postuler (Bouton Principal Vert Fluo #10E688) */}
          <div className="flex-1 min-w-0">
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-[11px] sm:text-xs transition-all shadow-[0_2px_8px_rgba(16,230,136,0.3)] transform hover:-translate-y-0.5 cursor-pointer text-center truncate"
              >
                <i className="fa-solid fa-paper-plane text-xs flex-shrink-0"></i>
                <span className="truncate">{externalButtonLabel || "Envoyer"}</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onApply && onApply(offer)}
                className="w-full flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-[11px] sm:text-xs transition-all shadow-[0_2px_8px_rgba(16,230,136,0.3)] transform hover:-translate-y-0.5 cursor-pointer text-center truncate"
              >
                <i className="fa-solid fa-paper-plane text-xs flex-shrink-0"></i>
                <span className="truncate">Envoyer</span>
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
