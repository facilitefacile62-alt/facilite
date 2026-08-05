"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const pathname = usePathname();
  const [userSession, setUserSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 1. Exclusion des routes Dashboard (admin et recruteur)
  const isDashboard = pathname.startsWith("/admin") || pathname.startsWith("/recruteur");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ne rien afficher sur les dashboards admin/recruteur
  if (isDashboard) return null;

  // 2. Maintien du Header Fixe sur les pages Standard
  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center space-x-2 group">
          <img
            src="/logo.jpeg"
            alt="Logo Facilite"
            className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200 dark:border-gray-700 group-hover:scale-105 transition-transform"
          />
          <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">
            Facilite
          </span>
        </Link>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className={`text-xs font-bold transition-colors ${
              pathname === "/"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Accueil
          </Link>
          <Link
            href="/service"
            className={`text-xs font-bold transition-colors ${
              pathname === "/service"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Services & Modèles
          </Link>
          <Link
            href="/offres"
            className={`text-xs font-bold transition-colors ${
              pathname.startsWith("/offres")
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Offres d'emploi
          </Link>
          <Link
            href="/recrutement-spontane"
            className={`text-xs font-bold transition-colors ${
              pathname.startsWith("/recrutement-spontane")
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Recrutement Spontané
          </Link>
          <Link
            href="/importer-cv"
            className={`text-xs font-bold transition-colors ${
              pathname === "/importer-cv"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Importer CV
          </Link>
          <Link
            href="/messagerie"
            className={`text-xs font-bold transition-colors ${
              pathname === "/messagerie"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Messagerie
          </Link>
        </nav>

        {/* Auth / Action */}
        <div className="flex items-center gap-3">
          {pathname !== "/" && (
            <Link
              href="/"
              className="hidden sm:inline-flex text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition items-center gap-1.5"
            >
              <i className="fa-solid fa-house text-xs"></i>
              Retour à l'accueil
            </Link>
          )}

          {userSession ? (
            <Link
              href="/profil"
              className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-user-check"></i>
              Mon Profil
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-right-to-bracket"></i>
              Se connecter
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle menu"
          >
            <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-lg`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pt-3 pb-4 space-y-2 shadow-lg">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Accueil
          </Link>
          <Link
            href="/service"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Services & Modèles
          </Link>
          <Link
            href="/offres"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Offres d'emploi
          </Link>
          <Link
            href="/recrutement-spontane"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Recrutement Spontané
          </Link>
          <Link
            href="/importer-cv"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Importer CV
          </Link>
          <Link
            href="/messagerie"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Messagerie
          </Link>
          <Link
            href="/profil"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            Mon Profil
          </Link>
        </div>
      )}
    </header>
  );
}
