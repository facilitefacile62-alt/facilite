/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";
import { respondToAccessRequest, STATUS_LABELS, STATUS_COLORS } from "@/lib/documentAccess";

const DOCUMENT_TYPE_LABELS = {
  resume_content: "Contenu d'un CV (éditeur Facilite)",
  resume_file: "Fichier CV",
  profile_cv_file: "CV importé",
};

export default function SecuriteConnexionPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [requests, setRequests] = useState([]);
  const [logs, setLogs] = useState([]);
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

        const [requestsRes, logsRes] = await Promise.all([
          supabase
            .from("document_access_requests")
            .select("id, admin_id, reason, status, expires_at, created_at")
            .eq("candidate_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("document_access_logs")
            .select("id, admin_id, document_type, accessed_at")
            .eq("candidate_id", session.user.id)
            .order("accessed_at", { ascending: false }),
        ]);

        setRequests(requestsRes.data || []);
        setLogs(logsRes.data || []);
      } catch (err) {
        console.error("Exception /candidat/securite:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Un admin peut créer une demande à tout moment — sans Realtime, le
  // candidat ne la verrait qu'après un F5 (même patron que la
  // synchronisation agent_assignments dans mes-cvs/page.js).
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`candidat-securite-requests:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_access_requests", filter: `candidate_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) => prev.map((r) => (r.id === payload.new.id ? payload.new : r)));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userSession?.user?.id]);

  const handleRespond = async (requestId, decision) => {
    setBusyId(requestId);
    const { success, error } = await respondToAccessRequest(requestId, decision);
    setBusyId(null);

    if (error || !success) {
      alert("Impossible d'enregistrer votre réponse : " + (error?.message || "déjà traitée"));
      return;
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: decision, expires_at: decision === "approved" ? new Date(Date.now() + 7 * 86400000).toISOString() : null }
          : r
      )
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de votre espace sécurité...</p>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const decidedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilité" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilité</span>
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
              href="/candidat/mes-cvs"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-file-lines"></i>
              <span>Mes CVs</span>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">Sécurité & Connexion</h1>
        <p className="text-sm text-gray-500 font-medium mb-8">
          Gérez les demandes d'accès à vos documents et consultez qui y a accédé.
        </p>

        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-3xl border border-amber-200 shadow-xs overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 bg-amber-50/50">
              <h2 className="text-lg font-extrabold text-gray-900">
                Demandes en attente ({pendingRequests.length})
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Un administrateur souhaite consulter temporairement votre CV.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((r) => (
                <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{r.reason}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Demandé le {new Date(r.created_at).toLocaleDateString("fr-FR")} — accès valable 7 jours si approuvé
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRespond(r.id, "denied")}
                      disabled={busyId === r.id}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition disabled:opacity-50 cursor-pointer"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => handleRespond(r.id, "approved")}
                      disabled={busyId === r.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition disabled:opacity-50 cursor-pointer"
                    >
                      Approuver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-extrabold text-gray-900">Historique des demandes ({decidedRequests.length})</h2>
          </div>
          {decidedRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic">Aucune demande traitée pour le moment.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {decidedRequests.map((r) => (
                <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{r.reason}</p>
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                      <i className="fa-regular fa-clock text-[10px]"></i>
                      <span>
                        {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        {r.status === "approved" && r.expires_at && ` — accès actif jusqu'au ${new Date(r.expires_at).toLocaleDateString("fr-FR")}`}
                        {r.status === "denied" && " — accès bloqué / refusé"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    {r.status === "approved" ? (
                      <button
                        type="button"
                        onClick={() => handleRespond(r.id, "denied")}
                        disabled={busyId === r.id}
                        className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        <i className="fa-solid fa-ban text-[10px]"></i>
                        <span>{busyId === r.id ? "Modification..." : "Désapprouver l'accès"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRespond(r.id, "approved")}
                        disabled={busyId === r.id}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                      >
                        <i className="fa-solid fa-check text-[10px]"></i>
                        <span>{busyId === r.id ? "Modification..." : "Approuver l'accès"}</span>
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
            <h2 className="text-lg font-extrabold text-gray-900">Journal d'accès ({logs.length})</h2>
            <p className="text-xs text-gray-500 font-medium">
              Chaque consultation réelle de vos documents par un administrateur autorisé.
            </p>
          </div>
          {logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 italic">Aucun accès enregistré pour le moment.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((l) => (
                <div key={l.id} className="p-5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-700">{DOCUMENT_TYPE_LABELS[l.document_type] || l.document_type}</span>
                  <span className="text-gray-400">{new Date(l.accessed_at).toLocaleString("fr-FR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
