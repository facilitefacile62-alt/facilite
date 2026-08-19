"use client";

import { useState, useEffect } from "react";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 350) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    toggleVisibility();

    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Retourner en haut de la page"
      title="Retour en haut"
      className={`fixed z-[450] bottom-20 sm:bottom-8 right-4 sm:right-8 w-12 h-12 rounded-full bg-gradient-to-tr from-[#E11D48] via-[#E60049] to-[#F43F5E] text-white shadow-xl shadow-rose-500/40 flex items-center justify-center cursor-pointer transition-all duration-300 transform select-none hover:shadow-2xl hover:shadow-rose-600/50 hover:scale-110 active:scale-95 border-2 border-white/30 dark:border-white/20 ${
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-8 pointer-events-none"
      }`}
    >
      {/* Icône de flèche vers le haut avec barre (exactement comme le visuel) */}
      <svg
        className="w-6 h-6 text-white transform transition-transform group-hover:-translate-y-0.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Flèche vers le haut */}
        <path
          d="M12 3.5L4.5 11H8.5V17.5H15.5V11H19.5L12 3.5Z"
          fill="currentColor"
        />
        {/* Barre horizontale inférieure */}
        <path
          d="M4.5 19.5H19.5V21.5H4.5V19.5Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
