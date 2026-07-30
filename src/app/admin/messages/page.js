/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";

export default function AdminMessagesPage() {
  const [userSession, setUserSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Liste des conversations et profils associés
  const [conversations, setConversations] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filtres et recherche
  const [filterRole, setFilterRole] = useState("all"); // 'all' | 'candidat' | 'recruteur'
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Initialisation de la session et contrôle du rôle Admin
  useEffect(() => {
    async function initAdminSession() {
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

        if (profile?.role !== "admin") {
          window.location.replace("/");
          return;
        }

        setUserSession(session);
        await loadConversationsAndProfiles(session.user.id);
      } catch (err) {
        console.error("Erreur initialisation admin messages:", err);
      } finally {
        setLoading(false);
      }
    }

    initAdminSession();
  }, []);

  // 2. Récupérer toutes les conversations et les profils des utilisateurs
  const loadConversationsAndProfiles = async (adminId) => {
    try {
      // Récupérer la cartographie de tous les profils (Candidats, Recruteurs, Admins)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url");

      const map = {};
      (profilesData || []).forEach((p) => {
        map[p.id] = p;
      });
      setProfilesMap(map);

      // Charger les conversations existantes depuis la table public.conversations
      const { data: convsData, error: convsErr } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (convsErr) console.error("Erreur chargement conversations:", convsErr);

      // S'il n'y a pas encore de lignes dans conversations, construire dynamiquement la liste à partir des profils
      let finalConvs = convsData || [];

      // Si aucune conversation explicite n'existe, on génère une vue virtuelle des profils avec lesquels discuter
      if (finalConvs.length === 0 && profilesData) {
        finalConvs = profilesData
          .filter((p) => p.id !== adminId)
          .map((p) => ({
            id: `virtual-${p.id}`,
            user_1_id: adminId,
            user_2_id: p.id,
            last_message: "Aucun message pour l'instant",
            updated_at: p.created_at || new Date().toISOString(),
            isVirtual: true,
          }));
      }

      setConversations(finalConvs);
      if (finalConvs.length > 0) {
        setActiveConvId(finalConvs[0].id);
      }
    } catch (err) {
      console.error("Exception chargement conversations:", err);
    }
  };

  // 3. Charger les messages de la conversation active et marquer comme lus
  useEffect(() => {
    if (!activeConvId || !userSession) return;

    async function loadMessagesForActiveConv() {
      setLoadingMessages(true);
      try {
        const currentConv = conversations.find((c) => c.id === activeConvId);
        if (!currentConv) return;

        const otherUserId = currentConv.user_1_id === userSession.user.id
          ? currentConv.user_2_id
          : currentConv.user_1_id;

        // Si conversation virtuelle
        if (currentConv.isVirtual) {
          const { data: directMsgs } = await supabase
            .from("messages")
            .select("*")
            .or(`and(sender_id.eq.${userSession.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userSession.user.id})`)
            .order("created_at", { ascending: true });

          setMessages(directMsgs || []);
        } else {
          const { data: convMsgs } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", activeConvId)
            .order("created_at", { ascending: true });

          setMessages(convMsgs || []);

          // Marquer comme lu
          await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("conversation_id", activeConvId)
            .neq("sender_id", userSession.user.id);
        }
      } catch (err) {
        console.error("Erreur chargement des messages de la discussion:", err);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessagesForActiveConv();
  }, [activeConvId, userSession, conversations]);

  // 4. Supabase Realtime : écouter les nouveaux messages reçus en direct
  useEffect(() => {
    if (!userSession) return;

    const channel = supabase
      .channel("admin_realtime_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new;

          // Si le message appartient à la conversation active
          if (newMsg.conversation_id === activeConvId || newMsg.receiver_id === userSession.user.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Marquer comme lu immédiatement si l'admin regarde cette conversation
            if (newMsg.conversation_id === activeConvId && newMsg.sender_id !== userSession.user.id) {
              supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id);
            }
          }

          // Mettre à jour le dernier message dans la liste des conversations
          setConversations((prevConvs) =>
            prevConvs.map((c) => {
              if (c.id === newMsg.conversation_id || c.user_2_id === newMsg.sender_id || c.user_1_id === newMsg.sender_id) {
                return {
                  ...c,
                  last_message: newMsg.content,
                  updated_at: newMsg.created_at,
                };
              }
              return c;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvId, userSession]);

  // Auto-scroll en bas de tchat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. Envoi d'un message par l'Admin
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending || !activeConvId || !userSession) return;

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const currentConv = conversations.find((c) => c.id === activeConvId);
      if (!currentConv) return;

      const otherUserId = currentConv.user_1_id === userSession.user.id
        ? currentConv.user_2_id
        : currentConv.user_1_id;

      let realConvId = currentConv.id;

      // Si la conversation est virtuelle, créer une vraie entrée dans public.conversations
      if (currentConv.isVirtual) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            user_1_id: userSession.user.id,
            user_2_id: otherUserId,
            last_message: textToSend,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newConv) {
          realConvId = newConv.id;
          // Mettre à jour l'ID localement
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConvId ? { ...newConv, isVirtual: false } : c))
          );
          setActiveConvId(realConvId);
        }
      } else {
        // Mettre à jour la date et dernier message de la conversation
        await supabase
          .from("conversations")
          .update({
            last_message: textToSend,
            updated_at: new Date().toISOString(),
          })
          .eq("id", realConvId);
      }

      // Enregistrer le message
      const { data: savedMsg, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: realConvId.startsWith("virtual-") ? null : realConvId,
          sender_id: userSession.user.id,
          receiver_id: otherUserId,
          content: textToSend,
          is_read: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (msgError) {
        console.error("Erreur envoi message admin:", msgError);
      } else if (savedMsg) {
        setMessages((prev) => [...prev, savedMsg]);
      }
    } catch (err) {
      console.error("Exception lors de l'envoi de message:", err);
    } finally {
      setSending(false);
    }
  };

  // Filtrage des conversations
  const filteredConversations = conversations.filter((conv) => {
    const otherUserId = conv.user_1_id === userSession?.user?.id ? conv.user_2_id : conv.user_1_id;
    const profile = profilesMap[otherUserId] || {};

    const role = profile.role || "candidat";
    if (filterRole !== "all" && role !== filterRole) return false;

    const query = searchQuery.toLowerCase();
    if (!query) return true;

    const nameMatch = (profile.full_name || "").toLowerCase().includes(query);
    const emailMatch = (profile.email || "").toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const activeOtherUserId = activeConv
    ? (activeConv.user_1_id === userSession?.user?.id ? activeConv.user_2_id : activeConv.user_1_id)
    : null;
  const activeProfile = activeOtherUserId ? profilesMap[activeOtherUserId] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de la Messagerie Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Header Admin Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <RoleBadge role="admin" />
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-chart-line text-amber-600"></i>
              <span>Dashboard Admin</span>
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

      {/* Main Content Layout 2 colonnes */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[680px]">
          
          {/* COLONNE GAUCHE (4/12) : Liste des conversations & filtres */}
          <div className="md:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50">
            {/* Entête colonne gauche */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <h1 className="text-lg font-extrabold text-gray-900 mb-3 flex items-center gap-2">
                <span>💬 Messagerie Support Admin</span>
              </h1>

              {/* Barre de recherche */}
              <div className="relative mb-3">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom ou e-mail..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              {/* Onglets Filtres par Rôle */}
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl text-[11px] font-extrabold text-gray-600">
                <button
                  onClick={() => setFilterRole("all")}
                  className={`flex-1 py-1.5 text-center rounded-lg transition ${
                    filterRole === "all" ? "bg-white text-gray-900 shadow-xs" : "hover:text-gray-900"
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFilterRole("candidat")}
                  className={`flex-1 py-1.5 text-center rounded-lg transition ${
                    filterRole === "candidat" ? "bg-emerald-600 text-white shadow-xs" : "hover:text-gray-900"
                  }`}
                >
                  Candidats
                </button>
                <button
                  onClick={() => setFilterRole("recruteur")}
                  className={`flex-1 py-1.5 text-center rounded-lg transition ${
                    filterRole === "recruteur" ? "bg-blue-600 text-white shadow-xs" : "hover:text-gray-900"
                  }`}
                >
                  Recruteurs
                </button>
              </div>
            </div>

            {/* Liste des discussions */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">
                  Aucun utilisateur correspondant.
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const otherUserId = conv.user_1_id === userSession?.user?.id ? conv.user_2_id : conv.user_1_id;
                  const profile = profilesMap[otherUserId] || {};
                  const isSelected = conv.id === activeConvId;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={`p-4 cursor-pointer transition flex items-center space-x-3 ${
                        isSelected ? "bg-amber-50/80 border-l-4 border-amber-500" : "hover:bg-white"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.full_name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                            {(profile.full_name || profile.email || "U")[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info Profil & Dernier message */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-extrabold text-gray-900 truncate">
                            {profile.full_name || profile.email || "Utilisateur"}
                          </span>
                          <RoleBadge role={profile.role || "candidat"} />
                        </div>
                        <p className="text-[11px] text-gray-500 truncate font-medium">
                          {conv.last_message || "Aucun message pour l'instant"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLONNE DROITE (8/12) : Zone de Tchat Dynamique */}
          <div className="md:col-span-8 flex flex-col bg-white">
            {activeConv && activeProfile ? (
              <>
                {/* Entête du Tchat Actif */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-2xs">
                  <div className="flex items-center space-x-3">
                    {activeProfile.avatar_url ? (
                      <img src={activeProfile.avatar_url} alt={activeProfile.full_name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center font-extrabold text-sm">
                        {(activeProfile.full_name || activeProfile.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                        <span>{activeProfile.full_name || activeProfile.email}</span>
                        <RoleBadge role={activeProfile.role || "candidat"} />
                      </h2>
                      <p className="text-[11px] text-gray-400 font-medium">{activeProfile.email}</p>
                    </div>
                  </div>
                </div>

                {/* Zone de Messages (Scrollable) */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/30">
                  {loadingMessages ? (
                    <div className="flex justify-center py-12">
                      <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                        💬
                      </div>
                      <p className="text-xs font-bold text-gray-600">Aucun message échangé pour le moment.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Envoyez un message pour démarrer la discussion support avec cet utilisateur.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isAdminMsg = m.sender_id === userSession?.user?.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isAdminMsg ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-md px-4 py-3 rounded-2xl text-xs shadow-xs leading-relaxed ${
                              isAdminMsg
                                ? "bg-amber-500 text-white rounded-br-none"
                                : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                            }`}
                          >
                            <p className="font-medium whitespace-pre-wrap">{m.content}</p>
                            <div
                              className={`text-[9px] mt-1.5 text-right font-semibold ${
                                isAdminMsg ? "text-amber-100" : "text-gray-400"
                              }`}
                            >
                              {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Formulaire d'envoi de message */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex items-center space-x-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Écrivez un message à l'utilisateur... (Entrée pour envoyer)"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>Envoyer</span>
                    <i className="fa-solid fa-paper-plane text-xs"></i>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                Sélectionnez une conversation à gauche pour démarrer le tchat.
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer Admin */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite - Administration Support.
      </footer>
    </div>
  );
}
