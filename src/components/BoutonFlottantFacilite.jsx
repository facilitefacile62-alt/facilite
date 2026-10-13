"use client";

// Bouton flottant commun du site : Extracteur, Assistant vocal, Écrire un
// e-mail. Il remplace l'orbe isolé de l'assistant (qui reçoit maintenant sa
// demande par l'évènement window « facilite:assistant-vocal », voir
// VoiceAssistant.jsx) et occupe la même place : bottom-32, au-dessus de
// ScrollToTop. Masqué sur l'administration et sur les écrans de connexion.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MASQUE_SUR = ["/admin", "/login", "/register", "/forgot-password", "/auth", "/verifiez-votre-email", "/bienvenue"];

export default function BoutonFlottantFacilite() {
  const pathname = usePathname() || "";
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return undefined;
    const surTouche = (e) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  if (MASQUE_SUR.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const action = "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-extrabold shadow-xl border border-gray-200 dark:border-gray-800 hover:scale-105 transition";
  const puce = "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm";

  return (
    <div className="fixed bottom-32 right-4 sm:right-6 z-[999] flex flex-col items-end gap-2">
      {ouvert ? (
        <>
          <Link href="/ecrire-email" onClick={() => setOuvert(false)} className={action}>
            Écrire un e-mail <span className={`${puce} bg-blue-600`}><i className="fa-solid fa-envelope"></i></span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setOuvert(false);
              window.dispatchEvent(new Event("facilite:assistant-vocal"));
            }}
            className={action}
          >
            Assistant vocal <span className={`${puce} bg-[#085041]`}><i className="fa-solid fa-microphone-lines"></i></span>
          </button>
          <Link href="/candidat/extracteur" onClick={() => setOuvert(false)} className={action}>
            Extracteur <span className={`${puce} bg-amber-500`}><i className="fa-solid fa-wand-magic-sparkles"></i></span>
          </Link>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-label={ouvert ? "Fermer le menu des raccourcis" : "Ouvrir le menu des raccourcis"}
        aria-expanded={ouvert}
        className="w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white text-xl cursor-pointer"
        style={{ background: "conic-gradient(from 0deg, #085041, #14b89a, #9FE1CB, #085041)" }}
      >
        <i className={`fa-solid ${ouvert ? "fa-xmark" : "fa-plus"}`}></i>
      </button>
    </div>
  );
}
