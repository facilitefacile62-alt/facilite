"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { sendMessage, formatMessageRow } from "@/lib/messages";
import RoleBadge from "@/components/RoleBadge";

const STATUS_TABS = [
  { id: "all", label: "Toutes", icon: "📋" },
  { id: "unread", label: "Non lu", icon: "🔴" },
  { id: "in_progress", label: "En cours", icon: "🟠" },
  { id: "resolved", label: "Résolu", icon: "🟢" },
];

const STATUS_META = {
  unread: { label: "Non lu", className: "bg-red-100 text-red-700" },
  in_progress: { label: "En cours", className: "bg-amber-100 text-amber-700" },
  resolved: { label: "Résolu", className: "bg-emerald-100 text-emerald-700" },
};

export default function AdminSupportPage() {
  const [adminSession, setAdminSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [threads, setThreads] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const chatBottomRef = useRef(null);

  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    async function loadAdminSupport() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!profile || profile.role !== "admin") {
          window.location.replace("/");
          return;
        }

        setAdminSession(session);

        const [{ data: threadsData, error: threadsErr }, { data: profilesData, error: profilesErr }] = await Promise.all([
          supabase.from("support_threads").select("*").order("last_message_at", { ascending: false }),
          supabase.from("profiles").select("id, full_name, email, role"),
        ]);

        if (threadsErr) console.error("Erreur chargement des demandes de support:", threadsErr);
        else setThreads(threadsData || []);

        if (profilesErr) console.error("Erreur chargement des profils:", profilesErr);
        else {
          const map = {};
          (profilesData || []).forEach((p) => { map[p.id] = p; });
          setProfilesById(map);
        }
      } catch (err) {
        console.error("Exception chargement support admin:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminSupport();
  }, []);

  // Temps réel : toute nouvelle demande/réponse SUPPORT met à jour la liste
  // et, si le fil concerné est ouvert, le fil de messages, sans recharger.
  useEffect(() => {
    if (!adminSession?.user?.id) return;

    const channel = supabase
      .channel("admin:support_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "type_discussion=eq.SUPPORT" },
        (payload) => {
          const newRow = payload.new;
          if (!newRow) return;
          const requesterId = newRow.receiver_id || newRow.sender_id;

          if (selectedUserId && requesterId === selectedUserId) {
            setThreadMessages((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev;
              return [...prev, formatMessageRow(newRow, adminSession.user.id)];
            });
          }

          supabase
            .from("support_threads")
            .select("*")
            .eq("user_id", requesterId)
            .single()
            .then(({ data }) => {
              if (!data) return;
              setThreads((prev) => {
                const exists = prev.some((t) => t.user_id === data.user_id);
                const next = exists ? prev.map((t) => (t.user_id === data.user_id ? data : t)) : [...prev, data];
                return next.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
              });
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminSession, selectedUserId]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadMessages]);

  const handleSelectThread = async (userId) => {
    setSelectedUserId(userId);
    setLoadingThread(true);
    setThreadMessages([]);

    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, is_read, is_pinned, created_at, type_discussion, job_offer_id")
      .eq("type_discussion", "SUPPORT")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    setLoadingThread(false);

    if (error) {
      console.error("Erreur chargement du fil de support:", error);
      triggerToast("Impossible de charger cette discussion.");
      return;
    }

    setThreadMessages((data || []).map((row) => formatMessageRow(row, adminSession.user.id)));
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUserId || sending) return;

    setSending(true);
    const content = messageText.trim();
    setMessageText("");

    const { data: savedRow, error } = await sendMessage({
      senderId: adminSession.user.id,
      receiverId: selectedUserId,
      content,
      typeDiscussion: "SUPPORT",
    });

    setSending(false);

    if (error || !savedRow) {
      triggerToast("Impossible d'envoyer la réponse.");
      setMessageText(content);
      return;
    }

    setThreadMessages((prev) => [...prev, formatMessageRow(savedRow, adminSession.user.id)]);
    setThreads((prev) =>
      prev.map((t) =>
        t.user_id === selectedUserId
          ? { ...t, status: "in_progress", last_message_at: savedRow.created_at }
          : t
      )
    );
  };

  const handleChangeStatus = async (newStatus) => {
    if (!selectedUserId) return;
    setUpdatingStatus(true);

    const { error } = await supabase
      .from("support_threads")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("user_id", selectedUserId);

    setUpdatingStatus(false);

    if (error) {
      console.error("Erreur mise à jour du statut:", error);
      triggerToast("Impossible de mettre à jour le statut.");
      return;
    }

    setThreads((prev) => prev.map((t) => (t.user_id === selectedUserId ? { ...t, status: newStatus } : t)));
    triggerToast(`Statut mis à jour : ${STATUS_META[newStatus]?.label || newStatus}`);
  };

  const filteredThreads = threads.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const p = profilesById[t.user_id];
    const q = searchQuery.toLowerCase();
    return (p?.full_name || "").toLowerCase().includes(q) || (p?.email || "").toLowerCase().includes(q);
  });

  const selectedProfile = selectedUserId ? profilesById[selectedUserId] : null;
  const selectedThread = threads.find((t) => t.user_id === selectedUserId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement du Support Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] font-sans flex flex-col">
      {/* Toast */}
      <div
        className={`fixed top-5 right-5 z-[1000] bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-xs font-extrabold">{toast}</span>
      </div>

      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/admin" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </Link>
            <span className="text-lg font-extrabold text-gray-900 tracking-tight">🎧 Support Facilite</span>
            <RoleBadge role="admin" />
          </div>
          <span className="text-xs font-semibold text-gray-500 hidden sm:inline">{adminSession?.user?.email}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-6 flex-1 w-full">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden h-[calc(100vh-140px)] flex">
          {/* Colonne gauche : liste des demandes */}
          <aside className="w-full sm:w-[340px] border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-150 space-y-3">
              <h2 className="text-sm font-extrabold text-gray-900">Demandes de support ({filteredThreads.length})</h2>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition"
              />
              <div className="flex flex-wrap gap-1.5">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1 ${
                      statusFilter === tab.id ? "bg-orange-500 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 italic font-medium">
                  Aucune demande de support pour le moment.
                </div>
              ) : (
                filteredThreads.map((t) => {
                  const p = profilesById[t.user_id];
                  const meta = STATUS_META[t.status] || STATUS_META.unread;
                  return (
                    <button
                      key={t.user_id}
                      type="button"
                      onClick={() => handleSelectThread(t.user_id)}
                      className={`w-full text-left p-4 transition cursor-pointer ${
                        selectedUserId === t.user_id ? "bg-orange-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-sm font-extrabold text-gray-900 truncate">{p?.full_name || p?.email || "Utilisateur"}</span>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                        {p?.role && <RoleBadge role={p.role} />}
                        <span>
                          {t.last_message_at
                            ? new Date(t.last_message_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Colonne droite : fil de discussion */}
          <section className="flex-1 flex flex-col bg-[#FAF9F6] min-w-0">
            {!selectedUserId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-orange-50 border border-orange-100 text-orange-500 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-xs mb-4">
                  🎧
                </div>
                <h3 className="text-base font-extrabold text-gray-900 mb-1">Support Facilite</h3>
                <p className="text-xs text-gray-500 max-w-sm font-semibold">
                  Sélectionnez une demande dans la liste pour lire et répondre à l'utilisateur.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-gray-900 truncate">
                      {selectedProfile?.full_name || selectedProfile?.email || "Utilisateur"}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-medium truncate">{selectedProfile?.email}</p>
                  </div>
                  <select
                    value={selectedThread?.status || "unread"}
                    disabled={updatingStatus}
                    onChange={(e) => handleChangeStatus(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer shadow-xs disabled:opacity-50 flex-shrink-0"
                  >
                    <option value="unread">🔴 Non lu</option>
                    <option value="in_progress">🟠 En cours</option>
                    <option value="resolved">🟢 Résolu</option>
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingThread ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : threadMessages.length === 0 ? (
                    <div className="text-center text-xs text-gray-400 italic py-8">Aucun message dans ce fil.</div>
                  ) : (
                    threadMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs border ${
                            msg.sender === "me"
                              ? "bg-gray-900 text-white border-gray-800 rounded-br-xs"
                              : "bg-white text-gray-800 border-gray-200 rounded-bl-xs"
                          }`}
                        >
                          <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          <span className="block text-right text-[9px] opacity-70 font-bold mt-1">{msg.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendReply} className="bg-white p-4 border-t border-gray-200 flex items-center space-x-2.5">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Répondre à l'utilisateur..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      messageText.trim() && !sending
                        ? "bg-orange-500 text-white hover:bg-orange-600 shadow-md"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <i className="fa-solid fa-paper-plane text-sm"></i>
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
