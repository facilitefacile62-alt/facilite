/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import StatusBadge from "@/components/StatusBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import { labelForCvModel } from "@/lib/cvModels";

export default function MesCvsPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [resumes, setResumes] = useState([]);
  const [accompagnements, setAccompagnements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        const [resumesRes, ordersRes, assignmentsRes] = await Promise.all([
          supabase.from("resumes").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
          supabase
            .from("orders")
            .select("*")
            .eq("user_id", session.user.id)
            .eq("has_agent_option", true)
            .order("created_at", { ascending: false }),
          supabase.from("agent_assignments").select("*").eq("candidate_id", session.user.id),
        ]);

        setResumes(resumesRes.data || []);

        const assignmentsByOrderId = Object.fromEntries(
          (assignmentsRes.data || []).map((a) => [a.order_id, a])
        );
        const merged = (ordersRes.data || []).map((order) => ({
          order,
          assignment: assignmentsByOrderId[order.id] || null,
        }));
        setAccompagnements(merged);
      } catch (err) {
        console.error("Exception mes-cvs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Synchronisation temps réel : le statut (in_progress -> completed) et le
  // CV livré sont mis à jour par un AGENT, sur une autre session — sans
  // Realtime, le candidat ne verrait sa version révisée qu'après un F5.
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`candidat-mes-cvs-assignments:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_assignments", filter: `candidate_id=eq.${userId}` },
        (payload) => {
          setAccompagnements((prev) =>
            prev.map((entry) =>
              entry.order.id === payload.new.order_id ? { ...entry, assignment: payload.new } : entry
            )
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userSession?.user?.id]);

  const handleDownloadImported = async (resume) => {
    if (!resume.file_url) return;
    setBusyId(resume.id);
    const url = await getSignedCvUrl(resume.file_url);
    setBusyId(null);

    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("Impossible d'ouvrir le CV.");
  };

  const handleDownloadRevised = async (assignment) => {
    if (!assignment.completed_cv_url) return;
    setBusyId(assignment.id);
    const { data, error } = await supabase.storage.from("completed_cvs").createSignedUrl(assignment.completed_cv_url, 3600);
    setBusyId(null);

    if (error || !data?.signedUrl) {
      console.error("Erreur signature CV finalisé:", error?.message);
      alert("Impossible d'ouvrir le CV.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de vos CVs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
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
              href="/candidat"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Mon espace</span>
            </Link>
            <Link
              href="/candidat/candidatures"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-list-check"></i>
              <span>Mes candidatures</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">Mes CVs</h1>
        <p className="text-sm text-gray-500 font-medium mb-8">Gérez vos CVs enregistrés et vos versions révisées par un expert.</p>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">CVs enregistrés ({resumes.length})</h2>
              <p className="text-xs text-gray-500 font-medium">Créés avec l'éditeur Facilite ou importés</p>
            </div>
            <Link
              href="/creer-cv"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs"
            >
              + Nouveau CV
            </Link>
          </div>

          {resumes.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic">Aucun CV enregistré pour le moment.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {resumes.map((resume) => (
                <div key={resume.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-file-lines"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{resume.title || "Mon CV"}</p>
                      <p className="text-[11px] text-gray-400">
                        {resume.type === "created" ? "Créé sur Facilite" : "Importé"} ·{" "}
                        {new Date(resume.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {resume.type === "created" && (
                      <Link
                        href={`/creer-cv?resumeId=${resume.id}`}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-extrabold rounded-lg transition"
                      >
                        Éditer
                      </Link>
                    )}
                    {resume.type === "imported" && resume.file_url && (
                      <button
                        onClick={() => handleDownloadImported(resume)}
                        disabled={busyId === resume.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        {busyId === resume.id ? "..." : "Télécharger PDF"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-extrabold text-gray-900">Accompagnement Expert</h2>
            <p className="text-xs text-gray-500 font-medium">
              Historique des versions révisées par un agent Facilite (option accompagnée, 2 000 FCFA)
            </p>
          </div>

          {accompagnements.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic">
              Aucune commande accompagnée pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {accompagnements.map(({ order, assignment }) => (
                <div
                  key={order.id}
                  data-testid={`accompagnement-${order.id}`}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-user-tie"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{labelForCvModel(order.cv_model_id)}</p>
                      <p className="text-[11px] text-gray-400">
                        Commande du {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={assignment?.status || "unassigned"} />
                    {assignment?.status === "completed" && assignment.completed_cv_url && (
                      <button
                        onClick={() => handleDownloadRevised(assignment)}
                        disabled={busyId === assignment.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        {busyId === assignment.id ? "..." : "Télécharger la version révisée"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
