/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import UnreadBadge from "@/components/UnreadBadge";
import StatusBadge from "@/components/StatusBadge";
import { useUnreadMessagesBadge } from "@/lib/useUnreadMessages";

export default function CandidaturesPage() {
  const [userSession, setUserSession] = useState(null);
  const unreadMessagesCount = useUnreadMessagesBadge(userSession?.user?.id);
  const [candidatures, setCandidatures] = useState([]);
  const [offersById, setOffersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [revealingId, setRevealingId] = useState(null);

  useEffect(() => {
    async function loadCandidatures() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        const { data, error } = await supabase
          .from("candidatures")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erreur chargement candidatures:", error.message);
          setLoading(false);
          return;
        }

        const list = data || [];
        setCandidatures(list);

        const offerIds = [...new Set(list.map((c) => c.job_offer_id).filter(Boolean))];
        if (offerIds.length > 0) {
          const { data: offers } = await supabase
            .from("job_offers")
            .select("id, image_url, recruiter_id")
            .in("id", offerIds);
          setOffersById(Object.fromEntries((offers || []).map((o) => [o.id, o])));
        }
      } catch (err) {
        console.error("Exception candidatures:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCandidatures();
  }, []);

  // Synchronisation temps réel : le statut est changé par le RECRUTEUR sur
  // une autre session — sans Realtime, seul un F5 le ferait apparaître ici.
  useEffect(() => {
    const userId = userSession?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`candidat-candidatures-detail:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "candidatures", filter: `user_id=eq.${userId}` },
        (payload) => {
          setCandidatures((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userSession?.user?.id]);

  const handleRevealContact = async (candidature) => {
    setRevealingId(candidature.id);
    const { error } = await supabase.rpc("reveal_contact_to_recruiter", { candidature_id: candidature.id });
    setRevealingId(null);

    if (error) {
      alert("Impossible d'autoriser le recruteur pour le moment.");
      return;
    }
    setCandidatures((prev) => prev.map((c) => (c.id === candidature.id ? { ...c, contact_revealed: true } : c)));
  };

  const handleDownloadCv = async (candidature) => {
    if (!candidature.cv_url) return;
    setDownloadingId(candidature.id);
    const url = await getSignedCvUrl(candidature.cv_url);
    setDownloadingId(null);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("Impossible d'ouvrir le CV.");
    }
  };

  // candidatures.status est un champ libre historique : seules les valeurs
  // reconnues du workflow recruteur sont affichées telles quelles, toute
  // autre valeur (legacy ou inattendue) retombe sur "En attente".
  const KNOWN_STATUSES = ["pending", "reviewed", "interview_scheduled", "accepted", "rejected"];
  const displayStatus = (status) => (KNOWN_STATUSES.includes(status) ? status : "pending");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de vos candidatures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight hidden sm:inline">Facilite</span>
            </Link>
            <RoleBadge role="candidat" />
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/candidat"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5"
              title="Mon espace"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span className="hidden md:inline">Mon espace</span>
            </Link>
            <Link
              href="/candidat/mes-cvs"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5"
              title="Mes CVs"
            >
              <i className="fa-solid fa-file-lines"></i>
              <span className="hidden md:inline">Mes CVs</span>
            </Link>
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition flex items-center space-x-1.5 relative"
              title="Messagerie"
            >
              <i className="fa-solid fa-comments"></i>
              <span className="hidden md:inline">Messagerie</span>
              <UnreadBadge count={unreadMessagesCount} />
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl transition cursor-pointer flex items-center space-x-1"
              title="Déconnexion"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          Suivi de mes Candidatures
        </h1>
        <p className="text-sm text-gray-500 font-medium mb-8">
          Retrouvez le statut de chacune de vos postulations ({candidatures.length}).
        </p>

        {candidatures.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 italic">
            Vous n'avez envoyé aucune candidature pour le moment.
          </div>
        ) : (
          <div className="space-y-4">
            {candidatures.map((c) => {
              const offer = c.job_offer_id ? offersById[c.job_offer_id] : null;
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {offer?.image_url ? (
                        <img
                          src={offer.image_url}
                          alt={c.company}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                          <i className="fa-solid fa-building"></i>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-extrabold text-gray-900 truncate">{c.job_title}</p>
                        <p className="text-xs text-gray-500 truncate">{c.company}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Postulé le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <StatusBadge status={displayStatus(c.status)} />
                      {offer?.recruiter_id && (
                        <Link
                          href={`/recruteurs/${offer.recruiter_id}`}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-extrabold rounded-lg transition"
                        >
                          Revoir l'annonce
                        </Link>
                      )}
                      {(offer?.recruiter_id || c.recruiter_id) && !c.contact_revealed && (
                        <button
                          onClick={() => handleRevealContact(c)}
                          disabled={revealingId === c.id}
                          title="Autoriser ce recruteur à voir votre e-mail et télécharger votre CV pour cette candidature"
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-extrabold rounded-lg transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {revealingId === c.id ? "..." : "🔓 Autoriser le contact"}
                        </button>
                      )}
                      {c.contact_revealed && (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-extrabold rounded-lg whitespace-nowrap">
                          ✓ Coordonnées visibles
                        </span>
                      )}
                      {c.cv_url && (
                        <button
                          onClick={() => handleDownloadCv(c)}
                          disabled={downloadingId === c.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold rounded-lg transition disabled:opacity-50 cursor-pointer"
                        >
                          {downloadingId === c.id ? "..." : "Télécharger CV"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
