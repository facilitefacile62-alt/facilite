/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import { uploadChatAttachment, validateChatFile } from "@/lib/chatAttachments";
import ChatAttachmentUrl from "@/components/ChatAttachmentUrl";
import RoleBadge from "@/components/RoleBadge";

// Trie les conversations par activité la plus récente — utilisé après chaque
// mise à jour optimiste ou événement Realtime pour faire remonter le fil qui
// vient de recevoir un message, sans recharger la liste depuis la base.
function reorderByUpdatedAt(list) {
  return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

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

  // State pour la Modale Répertoire Utilisateurs
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [allProfiles, setAllProfiles] = useState([]);
  const [startingChat, setStartingChat] = useState(false);

  // Voice Recording & File Attachment states
  const [isAdminRecording, setIsAdminRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // useRef plutôt que useState : adminMediaRecorder est une instance
  // MediaRecorder (API impérative — .stop(), .onstop), jamais lue en JSX ni
  // censée déclencher un re-render ; la muter directement (nécessaire pour
  // .stop()/.onstop) violait react-hooks/immutability tant qu'elle était en
  // useState.
  const adminMediaRecorderRef = useRef(null);
  const [adminAudioChunks, setAdminAudioChunks] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const timerRef = useRef(null);
  const adminFileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Retour non bloquant : remplace alert() (modale bloquante du navigateur,
  // perçue comme une "alerte globale" intrusive) pour les erreurs qui
  // n'empêchent pas de continuer à utiliser la page, à commencer par l'accès
  // micro refusé/indisponible.
  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Récupère toutes les conversations et les profils des utilisateurs.
  // Déclarée avant l'effet d'initialisation qui l'appelle (react-hooks/immutability
  // ne crédite pas le hoisting des déclarations de fonction ici).
  async function loadConversationsAndProfiles(adminId) {
    try {
      // Récupérer la cartographie de tous les profils (Candidats, Recruteurs, Admins)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, avatar_url");

      setAllProfiles(profilesData || []);

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

      // Le répertoire ("+") est désormais l'unique point d'entrée pour
      // démarrer une discussion avec un nouvel utilisateur : cette colonne
      // n'affiche que les conversations réellement engagées. (Générer une
      // conversation virtuelle par profil ici serait redondant avec la
      // modale, et créait une incohérence — la liste "Tous les profils"
      // disparaissait dès qu'une seule vraie conversation existait.)
      const finalConvs = convsData || [];

      setConversations(finalConvs);
      if (finalConvs.length > 0) {
        setActiveConvId(finalConvs[0].id);
      }
    } catch (err) {
      console.error("Exception chargement conversations:", err);
    }
  }

  // 1. Initialisation de la session et contrôle du rôle Admin
  useEffect(() => {
    async function initAdminSession() {
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

        if (userRoleRow?.role !== "admin" && userRoleRow?.role !== "publisher") {
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

  // 4a. Supabase Realtime : canal dédié à la conversation active, filtré côté
  // serveur par conversation_id. Re-souscrit (et ferme proprement l'ancien
  // canal) à chaque changement de conversation ou démontage.
  //
  // Cas des conversations "virtuelles" (fallback créé si l'INSERT dans
  // public.conversations a échoué, voir handleSelectUserFromDirectory) :
  // elles n'ont pas de conversation_id réel à filtrer côté serveur, donc pas
  // de véritable id de correspondant non plus — on le retrouve directement
  // dans l'id local ("virtual-<userId>") plutôt que de dépendre de l'état
  // `conversations`, ce qui éviterait sinon de resouscrire à chaque mise à
  // jour de la liste (reorder, etc.).
  useEffect(() => {
    if (!activeConvId || !userSession) return;

    const isVirtual = activeConvId.startsWith("virtual-");
    const myId = userSession.user.id;
    const otherUserId = isVirtual ? activeConvId.replace("virtual-", "") : null;

    const channel = supabase
      .channel(`chat:${activeConvId}`)
      .on(
        "postgres_changes",
        isVirtual
          ? { event: "INSERT", schema: "public", table: "messages" }
          : { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg) return;

          const belongsToActiveConv = isVirtual
            ? (newMsg.sender_id === otherUserId && newMsg.receiver_id === myId) ||
              (newMsg.sender_id === myId && newMsg.receiver_id === otherUserId)
            : newMsg.conversation_id === activeConvId;

          if (!belongsToActiveConv) return;

          // Le message peut déjà être présent (écho de notre propre envoi
          // optimiste, remplacé par la ligne réelle dès la réponse de
          // l'insert) : on ne l'ajoute que s'il est vraiment nouveau.
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== myId) {
            supabase.from("messages").update({ is_read: true }).eq("id", newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvId, userSession]);

  // 4b. Supabase Realtime : canal global sur public.conversations pour faire
  // remonter en direct, dans la colonne de gauche, le fil qui vient de
  // recevoir un message (le sien ou celui d'un autre admin) — sans dépendre
  // du contenu de la conversation actuellement ouverte.
  useEffect(() => {
    if (!userSession) return;

    const channel = supabase
      .channel("admin_conversations_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setConversations((prev) => prev.filter((c) => c.id !== payload.old?.id));
            return;
          }
          const row = payload.new;
          if (!row) return;

          setConversations((prev) => {
            const exists = prev.some((c) => c.id === row.id);
            const next = exists ? prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)) : [row, ...prev];
            return reorderByUpdatedAt(next);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userSession]);

  // Auto-scroll en bas de tchat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- GESTION DES NOTES VOCALES (MICROPHONE) ---
  const startAdminVoiceRecording = async () => {
    // Vérification explicite avant tout appel : certains contextes (navigateur
    // trop ancien, contexte non sécurisé...) n'exposent pas mediaDevices du
    // tout, ce qui lèverait un TypeError peu explicite depuis getUserMedia
    // directement plutôt qu'un message clair pour l'utilisateur.
    if (!navigator.mediaDevices?.getUserMedia) {
      triggerToast("Micro non disponible sur ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          await uploadAndSendAttachment(audioBlob, "audio_note.webm", "audio");
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      adminMediaRecorderRef.current = recorder;
      setAdminAudioChunks(chunks);
      setIsAdminRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Accès microphone refusé:", err);
      const message =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Accès au microphone refusé. Autorisez-le dans les paramètres du navigateur."
          : err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError"
          ? "Aucun microphone détecté sur cet appareil."
          : "Micro non disponible pour le moment.";
      triggerToast(message);
    }
  };

  const stopAdminVoiceRecording = () => {
    const recorder = adminMediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    clearInterval(timerRef.current);
    setIsAdminRecording(false);
  };

  const cancelAdminVoiceRecording = () => {
    const recorder = adminMediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
      if (recorder.stream) {
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    }
    clearInterval(timerRef.current);
    setIsAdminRecording(false);
    setRecordingTime(0);
  };

  // --- GESTION DES FICHIERS & PDF (TROMBONE) ---
  const handleAdminFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { valid, error: validationError } = await validateChatFile(file);
    if (!valid) {
      alert(validationError);
      e.target.value = "";
      return;
    }

    await uploadAndSendAttachment(file, file.name);
    e.target.value = "";
  };

  const uploadAndSendAttachment = async (fileOrBlob, fileName, forcedType) => {
    if (!activeConvId || !userSession || uploadingFile) return;

    const currentConv = conversations.find((c) => c.id === activeConvId);
    if (!currentConv) return;

    const otherUserId = currentConv.user_1_id === userSession.user.id
      ? currentConv.user_2_id
      : currentConv.user_1_id;

    setUploadingFile(true);

    try {
      const { attachment_url: publicUrl, attachment_type: attachmentType, file_name: resolvedFileName, file_size: fileSizeText, error: uploadError } =
        await uploadChatAttachment({
          file: fileOrBlob,
          userId: userSession.user.id,
          fileName,
          attachmentType: forcedType,
        });

      if (uploadError || !publicUrl) {
        // Ne jamais envoyer un message avec un lien de pièce jointe cassé :
        // en cas d'échec de l'upload, on prévient l'admin et on abandonne
        // l'envoi plutôt que d'insérer une URL factice.
        alert("Échec de l'envoi de la pièce jointe. Réessayez.");
        return;
      }

      const captionText = attachmentType === "audio" ? "🎙️ Note vocale" : `📎 Fichier joint : ${resolvedFileName}`;
      const nowIso = new Date().toISOString();
      let realConvId = currentConv.id;

      if (currentConv.isVirtual) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            user_1_id: userSession.user.id,
            user_2_id: otherUserId,
            last_message: captionText,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (newConv) {
          realConvId = newConv.id;
          setConversations((prev) =>
            reorderByUpdatedAt(prev.map((c) => (c.id === activeConvId ? { ...newConv, isVirtual: false } : c)))
          );
          setActiveConvId(realConvId);
        }
      } else {
        // Garde le fil à jour côté serveur et le remonte en tête de la
        // colonne de gauche, exactement comme pour un message texte.
        await supabase
          .from("conversations")
          .update({ last_message: captionText, updated_at: nowIso })
          .eq("id", realConvId);
        setConversations((prev) =>
          reorderByUpdatedAt(prev.map((c) => (c.id === realConvId ? { ...c, last_message: captionText, updated_at: nowIso } : c)))
        );
      }

      const { data: savedMsg, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: realConvId.startsWith("virtual-") ? null : realConvId,
          sender_id: userSession.user.id,
          receiver_id: otherUserId,
          content: captionText,
          attachment_url: publicUrl,
          attachment_type: attachmentType,
          file_name: resolvedFileName,
          file_size: fileSizeText,
          is_read: true,
          created_at: nowIso,
        })
        .select()
        .single();

      if (!msgError && savedMsg) {
        setMessages((prev) => [...prev, savedMsg]);
      } else if (msgError) {
        console.error("Erreur enregistrement message pièce jointe:", msgError);
        alert("La pièce jointe a été envoyée mais le message n'a pas pu être enregistré.");
      }
    } catch (err) {
      console.error("Exception téléversement pièce jointe:", err);
      alert("Échec de l'envoi de la pièce jointe. Réessayez.");
    } finally {
      setUploadingFile(false);
    }
  };

  // 5. Envoi d'un message par l'Admin — affichage optimiste : le message
  // apparaît immédiatement (id temporaire, statut "sending"), avant même la
  // confirmation serveur, puis est remplacé par la ligne réelle renvoyée par
  // Supabase (ou marqué en échec si l'insertion échoue).
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending || !activeConvId || !userSession) return;

    const currentConv = conversations.find((c) => c.id === activeConvId);
    if (!currentConv) return;

    const otherUserId = currentConv.user_1_id === userSession.user.id
      ? currentConv.user_2_id
      : currentConv.user_1_id;

    const textToSend = inputText.trim();
    const nowIso = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;

    setInputText("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversation_id: currentConv.isVirtual ? null : activeConvId,
        sender_id: userSession.user.id,
        receiver_id: otherUserId,
        content: textToSend,
        is_read: true,
        created_at: nowIso,
        _status: "sending",
      },
    ]);
    setConversations((prev) =>
      reorderByUpdatedAt(
        prev.map((c) => (c.id === activeConvId ? { ...c, last_message: textToSend, updated_at: nowIso } : c))
      )
    );

    try {
      let realConvId = currentConv.id;

      // Si la conversation est virtuelle, créer une vraie entrée dans public.conversations
      if (currentConv.isVirtual) {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            user_1_id: userSession.user.id,
            user_2_id: otherUserId,
            last_message: textToSend,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (newConv) {
          realConvId = newConv.id;
          setConversations((prev) =>
            reorderByUpdatedAt(prev.map((c) => (c.id === activeConvId ? { ...newConv, isVirtual: false } : c)))
          );
          setActiveConvId(realConvId);
        }
      } else {
        await supabase
          .from("conversations")
          .update({
            last_message: textToSend,
            updated_at: nowIso,
          })
          .eq("id", realConvId);
      }

      const { data: savedMsg, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: realConvId.startsWith("virtual-") ? null : realConvId,
          sender_id: userSession.user.id,
          receiver_id: otherUserId,
          content: textToSend,
          is_read: true,
          created_at: nowIso,
        })
        .select()
        .single();

      if (msgError) {
        console.error("Erreur envoi message admin:", msgError);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m)));
      } else if (savedMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? savedMsg : m)));
      }
    } catch (err) {
      console.error("Exception lors de l'envoi de message:", err);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m)));
    } finally {
      setSending(false);
    }
  };

  // 6. Gestion du clic sur un utilisateur dans le Répertoire pour démarrer une discussion
  const handleSelectUserFromDirectory = async (targetUser) => {
    if (!userSession || startingChat) return;
    setStartingChat(true);

    try {
      const adminId = userSession.user.id;
      const targetUserId = targetUser.id;

      // Chercher si une conversation existe déjà entre l'admin et cet utilisateur
      const existingConv = conversations.find((c) => {
        return (c.user_1_id === adminId && c.user_2_id === targetUserId) ||
               (c.user_1_id === targetUserId && c.user_2_id === adminId);
      });

      if (existingConv) {
        setActiveConvId(existingConv.id);
        setIsDirectoryModalOpen(false);
        setDirectorySearch("");
        return;
      }

      // Si aucune conversation n'existe, créer la ligne dans la table public.conversations
      const { data: newConv, error: createErr } = await supabase
        .from("conversations")
        .insert({
          user_1_id: adminId,
          user_2_id: targetUserId,
          last_message: "Discussion initialisée par l'administration",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) {
        console.error("Erreur création conversation:", createErr);
        const virtualId = `virtual-${targetUserId}`;
        const newVirtual = {
          id: virtualId,
          user_1_id: adminId,
          user_2_id: targetUserId,
          last_message: "Discussion initialisée",
          updated_at: new Date().toISOString(),
          isVirtual: true,
        };
        setConversations((prev) => [newVirtual, ...prev]);
        setActiveConvId(virtualId);
      } else if (newConv) {
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(newConv.id);
      }

      setIsDirectoryModalOpen(false);
      setDirectorySearch("");
    } catch (err) {
      console.error("Exception sélection utilisateur répertoire:", err);
    } finally {
      setStartingChat(false);
    }
  };

  // Filtrage des conversations dans la sidebar
  const filteredConversations = conversations.filter((conv) => {
    const otherUserId = conv.user_1_id === userSession?.user?.id ? conv.user_2_id : conv.user_1_id;
    const profile = profilesMap[otherUserId] || {};

    // Classification par badge plutôt que par l'ancien champ role (supprimé
    // de profiles par le chantier RBAC — voir 20260729232500). Un utilisateur
    // avec le badge verified_recruiter est classé "recruteur", tous les
    // autres sont "candidat" (libellé décoratif, pas un rôle technique).
    const effectiveRole = (profile.badges || []).includes("verified_recruiter") ? "recruteur" : "candidat";
    if (filterRole !== "all" && effectiveRole !== filterRole) return false;

    const query = searchQuery.toLowerCase();
    if (!query) return true;

    const nameMatch = (profile.full_name || "").toLowerCase().includes(query);
    const emailMatch = (profile.email || "").toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  // Filtrage du répertoire utilisateurs pour la modale
  const filteredDirectoryUsers = allProfiles.filter((p) => {
    if (p.id === userSession?.user?.id) return false;
    const q = directorySearch.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (p.full_name || "").toLowerCase().includes(q);
    const emailMatch = (p.email || "").toLowerCase().includes(q);
    const phoneMatch = (p.phone || "").toLowerCase().includes(q);
    return nameMatch || emailMatch || phoneMatch;
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
    // min-h-screen laissait toute la page grandir avec le contenu (une
    // longue conversation poussait le formulaire d'envoi hors de l'écran).
    // h-screen + overflow-hidden verrouille la hauteur au viewport ; chaque
    // conteneur flex imbriqué en dessous reçoit min-h-0 pour empêcher son
    // contenu de forcer une taille supérieure à l'espace qui lui est
    // réellement alloué (la taille minimale automatique d'un enfant flex
    // vaut son contenu par défaut, pas 0 — c'est ce qui contournait
    // overflow-hidden et repoussait tout vers le bas).
    <div className="h-screen overflow-hidden bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Toast */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {/* Modale Répertoire Utilisateurs (WhatsApp / Telegram Style) */}
      {isDirectoryModalOpen && (
        <div className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            {/* Header Modale */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                  <i className="fa-solid fa-address-book"></i>
                </div>
                <h3 className="text-base font-extrabold text-gray-900">Répertoire des Membres</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDirectoryModalOpen(false);
                  setDirectorySearch("");
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Barre de Recherche Répertoire */}
            <div className="p-4 border-b border-gray-150 bg-white">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Filtrer par nom, e-mail ou téléphone..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition"
                  autoFocus
                />
              </div>
            </div>

            {/* Liste scrollable des membres */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
              {filteredDirectoryUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">
                  Aucun membre trouvé pour cette recherche.
                </div>
              ) : (
                filteredDirectoryUsers.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => handleSelectUserFromDirectory(profile)}
                    className="p-3 rounded-2xl hover:bg-amber-50/60 transition cursor-pointer flex items-center space-x-3 group"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-11 h-11 rounded-full object-cover border border-gray-200 shadow-2xs group-hover:scale-105 transition"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-extrabold text-sm shadow-2xs group-hover:scale-105 transition">
                          <i className="fa-solid fa-user text-base"></i>
                        </div>
                      )}
                    </div>

                    {/* Informations du membre */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-extrabold text-gray-900 truncate">
                          {profile.full_name || profile.email || "Utilisateur"}
                        </span>
                        <RoleBadge role={profile.role || "candidat"} />
                      </div>
                      <div className="flex flex-col space-y-0.5 text-[11px] text-gray-500 font-medium">
                        {profile.phone && (
                          <span className="text-gray-900 font-bold flex items-center gap-1">
                            <i className="fa-solid fa-phone text-[9px] text-gray-400"></i>
                            {profile.phone}
                          </span>
                        )}
                        <span className="truncate">{profile.email}</span>
                      </div>
                    </div>

                    {/* Icône Action */}
                    <div className="text-gray-300 group-hover:text-amber-500 transition pl-1">
                      <i className="fa-solid fa-chevron-right text-xs"></i>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modale */}
            <div className="p-3 bg-gray-50 border-t border-gray-150 text-center text-[10px] text-gray-400 font-semibold">
              {filteredDirectoryUsers.length} membre{filteredDirectoryUsers.length !== 1 ? "s" : ""} trouvé{filteredDirectoryUsers.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Header Admin Nav */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs flex-none">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-6 flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {/* min-h-0 remplace min-h-[680px] : un plancher de hauteur minimale
            allait justement à l'encontre du confinement recherché. */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">

          {/* COLONNE GAUCHE (4/12) : Liste des conversations & filtres */}
          <div className="md:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50 min-h-0 overflow-hidden">
            {/* Entête colonne gauche */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <span>Discussions</span>
                </h1>
                <button
                  type="button"
                  onClick={() => setIsDirectoryModalOpen(true)}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-amber-500 hover:text-white text-gray-700 flex items-center justify-center transition shadow-2xs cursor-pointer border border-gray-200"
                  title="Nouvelle discussion"
                >
                  <i className="fa-solid fa-square-plus text-base"></i>
                </button>
              </div>

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
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs space-y-2">
                  <p>{conversations.length === 0 ? "Aucune discussion pour le moment." : "Aucune conversation ne correspond."}</p>
                  {conversations.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setIsDirectoryModalOpen(true)}
                      className="text-amber-600 font-bold not-italic cursor-pointer hover:underline"
                    >
                      Démarrer une nouvelle discussion
                    </button>
                  )}
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
          <div className="md:col-span-8 flex flex-col bg-white min-h-0 overflow-hidden">
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
                      <p className="text-[11px] text-gray-400 font-medium flex items-center gap-2">
                        <span>{activeProfile.email}</span>
                        {activeProfile.phone && <span>· {activeProfile.phone}</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Zone de Messages (Scrollable) */}
                <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-4 bg-gray-50/30">
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
                              m._status === "error"
                                ? "bg-red-50 text-red-800 border border-red-200"
                                : isAdminMsg
                                ? "bg-amber-500 text-white rounded-br-none"
                                : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                            } ${m._status === "sending" ? "opacity-60" : ""}`}
                          >
                            {/* Pièce jointe PDF / Document (Carte Bleue Ergonomique) */}
                            {m.attachment_url && m.attachment_type !== "audio" && (
                              <ChatAttachmentUrl path={m.attachment_url}>
                                {(resolvedUrl) => (
                                  <a
                                    href={resolvedUrl || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-3 bg-blue-600/90 hover:bg-blue-700 text-white p-3 rounded-2xl mb-2 border border-blue-400/30 text-left shadow-xs transition group/file"
                                  >
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                                      <i className={`fa-solid ${m.attachment_type === "pdf" ? "fa-file-pdf" : "fa-file-lines"} text-xl`}></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-extrabold block truncate max-w-[170px]">
                                        {m.file_name || "Document"}
                                      </span>
                                      <span className="text-[10px] opacity-80 block font-semibold">
                                        {m.file_size || "Fichier"}
                                      </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/20 group-hover/file:bg-white/30 flex items-center justify-center text-white transition">
                                      <i className="fa-solid fa-download text-xs"></i>
                                    </div>
                                  </a>
                                )}
                              </ChatAttachmentUrl>
                            )}

                            {/* Note Vocale (Lecteur Audio Ergonomique) */}
                            {m.attachment_type === "audio" && m.attachment_url && (
                              <div className="mb-2 bg-black/10 p-2 rounded-2xl border border-white/10">
                                <ChatAttachmentUrl path={m.attachment_url}>
                                  {(resolvedUrl) => (
                                    <audio controls src={resolvedUrl || undefined} className="w-full h-8 rounded-lg outline-none" />
                                  )}
                                </ChatAttachmentUrl>
                              </div>
                            )}

                            {m.content && <p className="font-medium whitespace-pre-wrap">{m.content}</p>}
                            <div
                              className={`text-[9px] mt-1.5 text-right font-semibold flex items-center justify-end gap-1 ${
                                m._status === "error" ? "text-red-500" : isAdminMsg ? "text-amber-100" : "text-gray-400"
                              }`}
                            >
                              {m._status === "sending" && <span>Envoi...</span>}
                              {m._status === "error" && <span>⚠️ Échec de l'envoi</span>}
                              {!m._status && (
                                <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Formulaire d'envoi de message avec Trombone (fichiers) & Microphone (notes vocales) */}
                <div className="p-4 border-t border-gray-200 bg-white">
                  <input
                    type="file"
                    ref={adminFileInputRef}
                    onChange={handleAdminFileSelect}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    className="hidden"
                  />

                  {isAdminRecording ? (
                    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
                      <div className="flex items-center space-x-3">
                        <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                        <span className="text-xs font-extrabold text-red-700">Enregistrement : {recordingTime}s</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={cancelAdminVoiceRecording}
                          className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white rounded-xl border border-gray-200 transition cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={stopAdminVoiceRecording}
                          className="px-4 py-1.5 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs cursor-pointer"
                        >
                          Envoyer la note vocale 🎙️
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2.5">
                      {/* Icône Trombone pour joindre un fichier/PDF */}
                      <button
                        type="button"
                        disabled={uploadingFile}
                        onClick={() => adminFileInputRef.current?.click()}
                        className="text-gray-400 hover:text-amber-600 hover:bg-amber-50 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition cursor-pointer disabled:opacity-50"
                        title="Joindre un fichier ou PDF"
                      >
                        <i className="fa-solid fa-paperclip text-base"></i>
                      </button>

                      {/* Icône Microphone pour enregistrer une note vocale */}
                      <button
                        type="button"
                        onClick={startAdminVoiceRecording}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition cursor-pointer"
                        title="Enregistrer un message vocal"
                      >
                        <i className="fa-solid fa-microphone text-base"></i>
                      </button>

                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Écrivez un message à l'utilisateur... (Entrée pour envoyer)"
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition"
                      />

                      <button
                        type="submit"
                        disabled={!inputText.trim() || sending}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>Envoyer</span>
                        <i className="fa-solid fa-paper-plane text-xs"></i>
                      </button>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
                Sélectionnez une conversation à gauche ou cliquez sur "+" pour démarrer un nouveau tchat.
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer Admin */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs font-medium text-gray-500 flex-none">
        © 2026 Facilite - Administration Support.
      </footer>
    </div>
  );
}
