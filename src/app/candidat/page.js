/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import { respondToAccessRequest } from "@/lib/documentAccess";
import { playNotificationSound } from "@/lib/notificationSound";

export default function CandidatDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [candidatures, setCandidatures] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
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

        const { data: userRoleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (!userRoleRow || (userRoleRow.role !== "user" && userRoleRow.role !== "admin")) {
          window.location.replace("/");
          return;
        }

        setUserSession(session);

        const [{ data: candData, error: candError }, { data: reqData }] = await Promise.all([
          supabase
            .from("candidatures")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("document_access_requests")
            .select("id, admin_id, reason, status, created_at")
            .eq("candidate_id", session.user.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        ]);

        if (candError) console.error("Erreur chargement candidatures:", candError);
        else setCandidatures(candData || []);

        if (reqData && reqData.length > 0) {
          setAccessRequests(reqData);
        }
      } catch (err) {
        console.error("Exception candidat dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCandidatDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!currentSession) {
        window.location.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Synchronisation temps réel des demandes d'inspection de document & candidatures
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`candidat-live-signals:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "candidatures", filter: `user_id=eq.${userId}` },
        (payload) => {
          setCandidatures((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_access_requests", filter: `candidate_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new.status === "pending") {
            setAccessRequests((prev) => [payload.new, ...prev.filter((r) => r.id !== payload.new.id)]);
            playNotificationSound();
          } else if (payload.eventType === "UPDATE") {
            if (payload.new.status === "pending") {
              setAccessRequests((prev) => [payload.new, ...prev.filter((r) => r.id !== payload.new.id)]);
            } else {
              setAccessRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userSession?.user?.id]);

  const handleRespondToAccess = async (requestId, decision) => {
    setRespondingRequestId(requestId);
    const { success, error } = await respondToAccessRequest(requestId, decision);
    setRespondingRequestId(null);

    if (error || !success) {
      alert("Erreur lors de la réponse : " + (error?.message || "Demande introuvable"));
      return;
    }

    setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

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
      case "interview_scheduled":
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">Entretien programmé 🎥</span>;
      case "reviewed":
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">En revue 🔎</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">Envoyée ⏳</span>;
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
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        {/* Signal d'autorisation d'inspection de document en temps réel */}
        {accessRequests.length > 0 && (
          <div className="mb-6 space-y-3">
            {accessRequests.map((req) => (
              <div
                key={req.id}
                className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-50 border-2 border-amber-400/80 rounded-3xl p-5 sm:p-6 shadow-lg backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse-subtle"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <i className="fa-solid fa-shield-halved text-lg"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-2xs">
                        Signal Requis • Inspection CV
                      </span>
                      <span className="text-[11px] text-amber-900 font-bold">
                        {new Date(req.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-900 mt-1">
                      Un conseiller administrateur souhaite consulter votre CV
                    </h3>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">
                      <span className="font-bold text-amber-900">Motif : </span>
                      {req.reason || "Accompagnement et vérification professionnelle"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRespondToAccess(req.id, "approved")}
                    disabled={respondingRequestId === req.id}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-lock-open text-xs"></i>
                    <span>{respondingRequestId === req.id ? "Validation..." : "Autoriser l'accès (7 jours)"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondToAccess(req.id, "denied")}
                    disabled={respondingRequestId === req.id}
                    className="px-3.5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                    <span>Refuser</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
              <Link
                href="/candidat/securite"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5"
              >
                <i className="fa-solid fa-shield-halved"></i>
                <span>Sécurité</span>
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
