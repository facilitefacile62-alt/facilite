/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

export default function CandidatDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [candidatures, setCandidatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingCvId, setDownloadingCvId] = useState(null);

  useEffect(() => {
    async function loadCandidatDashboard() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }

        // Vérification de rôle : réservé aux candidats et administrateurs
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!profile || (profile.role !== "candidat" && profile.role !== "admin")) {
          window.location.replace(profile?.role === "recruteur" ? "/recruteur" : "/");
          return;
        }

        setUserSession(session);

        // Récupération des candidatures envoyées par le candidat connecté
        const { data, error } = await supabase
          .from("candidatures")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) console.error("Erreur chargement candidatures:", error);
        else setCandidatures(data || []);
      } catch (err) {
        console.error("Exception candidat dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCandidatDashboard();
  }, []);

  const handleDownloadCv = async (candidature) => {
    if (!candidature.cv_url) return;
    setDownloadingCvId(candidature.id);
    const url = await getSignedCvUrl(candidature.cv_url);
    setDownloadingCvId(null);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("Impossible d'ouvrir le CV.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "accepted":
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">Retenu 🎉</span>;
      case "rejected":
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-200">Refusé</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">En attente ⏳</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de votre Suivi Candidat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Header Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <RoleBadge role="candidat" />
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/offres"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-briefcase"></i>
              <span>Voir les Offres</span>
            </Link>
            <Link
              href="/candidat/facturation"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-file-invoice"></i>
              <span>Facturation</span>
            </Link>
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 relative"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
              <UnreadBadge count={unreadMessagesCount} />
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Suivi Candidat & Postulations
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Mes Candidatures Envoyées
            </h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Consultez le statut de vos candidatures en temps réel et votre score de compatibilité avec chaque poste.
            </p>
          </div>
        </div>

        {/* Dashboard Candidatures Table */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Historique des postulations ({candidatures.length})</h2>
              <p className="text-xs text-gray-500 font-medium">Liste exhaustive de vos démarches de recrutement</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/candidat/candidatures"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5"
              >
                <span>Suivi détaillé</span>
              </Link>
              <Link
                href="/candidat/mes-cvs"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5"
              >
                <span>Mes CVs</span>
              </Link>
              <Link
                href="/candidat/extracteur"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center space-x-1.5"
              >
                <span>⚡ L'Extracteur 1-Click</span>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Offre / Entreprise</th>
                  <th className="py-4 px-6">Score Compatibilité</th>
                  <th className="py-4 px-6">Date d'envoi</th>
                  <th className="py-4 px-6">Statut</th>
                  <th className="py-4 px-6 text-right">CV Transmis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {candidatures.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 italic">
                      Vous n'avez envoyé aucune candidature pour le moment.
                    </td>
                  </tr>
                ) : (
                  candidatures.map((c) => {
                    const score = c.cv_match_score;
                    const hasScore = score !== null && score !== undefined;
                    const scoreBadgeClass = !hasScore
                      ? "bg-gray-100 text-gray-500 border-gray-200"
                      : score >= 75
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : score >= 50
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-red-100 text-red-800 border-red-200";

                    return (
                      <tr key={c.id} className="hover:bg-emerald-50/20 transition">
                        <td className="py-4 px-6">
                          <span className="font-bold text-gray-900 block">{c.job_title}</span>
                          <span className="text-xs text-emerald-700 font-semibold">{c.company}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-extrabold border whitespace-nowrap ${scoreBadgeClass}`}>
                            <span>⚡ Match</span>
                            <span>{hasScore ? `${score}%` : "N/A"}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-500">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "Récemment"}
                        </td>
                        <td className="py-4 px-6">
                          {getStatusBadge(c.status)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {c.cv_url ? (
                            <button
                              onClick={() => handleDownloadCv(c)}
                              disabled={downloadingCvId === c.id}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 text-emerald-700 font-extrabold rounded-xl transition inline-flex items-center space-x-1 text-xs cursor-pointer"
                            >
                              <i className="fa-solid fa-file-pdf"></i>
                              <span>{downloadingCvId === c.id ? "..." : "Revoir mon CV"}</span>
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite - Espace Candidat.
      </footer>
    </div>
  );
}
