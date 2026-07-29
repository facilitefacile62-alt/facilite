/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import { fetchConversationMessages, toggleMessagePin, sendMessage, formatMessageRow } from "@/lib/messages";

// --- DICTIONNAIRE DE TRADUCTION COMPLET ---
const translations = {
  FR: {
    navHome: "Accueil",
    navService: "Service",
    navMessages: "Messagerie",
    navRecruitment: "Recrutement Spontané",
    navContact: "Contactez-nous",
    navLogin: "Se connecter",
    recruitmentModalTitle: "Recrutement Spontané",
    recruitmentModalSubtitle: "Envoyez-nous votre profil pour de futures opportunités.",
    recruitmentLabelCV: "Votre CV (PDF, DOCX)",
    recruitmentUploadPlaceholder: "Cliquez ou glissez-déposez votre CV ici",
    recruitmentLabelCoverLetter: "Message d'accompagnement",
    recruitmentPlaceholderCoverLetter: "Parlez-nous de vos motivations et de vos compétences...",
    recruitmentSuccessTitle: "Candidature reçue !",
    recruitmentSuccessDesc: "Nous avons bien reçu votre candidature spontanée. Notre équipe RH l'étudiera avec la plus grande attention.",
    recruitmentSubmit: "Soumettre ma candidature",
    recruitmentSending: "Envoi de la candidature...",
    searchPlaceholder: "Rechercher une discussion...",
    searchNoResults: "Aucune discussion trouvée.",
    modalTitle: "Contactez-nous",
    modalSubtitle: "Une question ou une suggestion ? Notre équipe vous répond sous 24h.",
    modalLabelName: "Nom complet",
    modalLabelEmail: "Adresse email",
    modalLabelSubject: "Objet du message",
    modalLabelMessage: "Votre message",
    modalPlaceholderName: "Ex. Mamadou Sarr",
    modalPlaceholderEmail: "Ex. mamadou@example.com",
    modalPlaceholderSubject: "Ex. Demande de renseignement",
    modalPlaceholderMessage: "Comment pouvons-nous vous aider ?",
    modalSending: "Envoi en cours...",
    modalSubmit: "Envoyer le message",
    modalSuccessTitle: "Message envoyé avec succès !",
    modalSuccessDesc: "Merci pour votre message. Notre équipe d'assistance vous contactera très rapidement.",
    modalClose: "Fermer",
    footerCopyright: "© 2026 Facilite. Tous droits réservés.",
    toastLangFR: "Langue modifiée en Français",
    toastLangGB: "Language changed to English",
    
    // Messaging Specific
    onlineStatus: "En ligne",
    offlineStatus: "Hors ligne",
    typingStatus: "écrit...",
    noChatSelectedTitle: "Vos Messages",
    noChatSelectedSubtitle: "Sélectionnez un recruteur ou un contact pour commencer à échanger.",
    inputPlaceholder: "Écrivez votre message...",
    attachmentTooltip: "Joindre un document (CV)",
    emojiTooltip: "Ajouter un emoji",
    sendButton: "Envoyer",
    recruiterTitle: "Recruteur",
    activeNow: "Actif à l'instant",
    fileSent: "Fichier envoyé : ",
    downloadFile: "Télécharger",
    filterAll: "Tous",
    filterUnread: "Non lues",
    filterFavorites: "Favoris",

    // Pinned message
    pinnedLabel: "Épinglé",
    pinAction: "Épingler ce message",
    unpinAction: "Désépingler",
    pinSuccess: "Message épinglé en haut de la discussion",
    unpinSuccess: "Message désépinglé",
    pinError: "Impossible d'épingler ce message",
    noPinnedMessage: "Aucun message épinglé dans cette discussion",
    jumpToPinned: "Aller au message épinglé"
  },
  GB: {
    navHome: "Home",
    navService: "Service",
    navMessages: "Messaging",
    navRecruitment: "Spontaneous Application",
    navContact: "Contact us",
    navLogin: "Sign in",
    recruitmentModalTitle: "Spontaneous Application",
    recruitmentModalSubtitle: "Send us your profile for future opportunities.",
    recruitmentLabelCV: "Your CV (PDF, DOCX)",
    recruitmentUploadPlaceholder: "Click or drag & drop your CV here",
    recruitmentLabelCoverLetter: "Cover Message",
    recruitmentPlaceholderCoverLetter: "Tell us about your motivations and skills...",
    recruitmentSuccessTitle: "Application Received!",
    recruitmentSuccessDesc: "We have received your spontaneous application. Our HR team will review it with the utmost care.",
    recruitmentSubmit: "Submit My Application",
    recruitmentSending: "Sending Application...",
    searchPlaceholder: "Search discussions...",
    searchNoResults: "No discussions found.",
    modalTitle: "Contact us",
    modalSubtitle: "A question or suggestion? Our team will reply within 24 hours.",
    modalLabelName: "Full name",
    modalLabelEmail: "Email address",
    modalLabelSubject: "Subject",
    modalLabelMessage: "Your message",
    modalPlaceholderName: "e.g., Mamadou Sarr",
    modalPlaceholderEmail: "e.g., mamadou@example.com",
    modalPlaceholderSubject: "e.g., Request for information",
    modalPlaceholderMessage: "How can we help you?",
    modalSending: "Sending...",
    modalSubmit: "Send message",
    modalSuccessTitle: "Message sent successfully!",
    modalSuccessDesc: "Thank you for your message. Our support team will get in touch with you very shortly.",
    modalClose: "Close",
    footerCopyright: "© 2026 Facilite. All rights reserved.",
    toastLangFR: "Language changed to French",
    toastLangGB: "Language changed to English",
    
    // Messaging Specific
    onlineStatus: "Online",
    offlineStatus: "Offline",
    typingStatus: "typing...",
    noChatSelectedTitle: "Your Messages",
    noChatSelectedSubtitle: "Select a recruiter or contact to start chatting.",
    inputPlaceholder: "Type your message...",
    attachmentTooltip: "Attach a document (Resume)",
    emojiTooltip: "Add emoji",
    sendButton: "Send",
    recruiterTitle: "Recruiter",
    activeNow: "Active now",
    fileSent: "File sent: ",
    downloadFile: "Download",
    filterAll: "All",
    filterUnread: "Unread",
    filterFavorites: "Favorites",

    // Pinned message
    pinnedLabel: "Pinned",
    pinAction: "Pin this message",
    unpinAction: "Unpin",
    pinSuccess: "Message pinned to the top of the chat",
    unpinSuccess: "Message unpinned",
    pinError: "Could not pin this message",
    noPinnedMessage: "No pinned message in this conversation",
    jumpToPinned: "Jump to pinned message"
  }
};

// 3 IA d'assistance spécialisées
const AI_ROLES = [
  {
    id: "cv",
    name: "Rédaction & Optimisation CV",
    badge: "📄 CV & Lettre",
    icon: "🤖",
    description: "Rédaction de CV, lettres de motivation, mise en valeur des compétences.",
    systemPrompt: "Tu es une IA experte en rédaction de CV et de lettres de motivation."
  },
  {
    id: "coach",
    name: "Coach Recrutement & Entretien",
    badge: "💼 Coach Entretien",
    icon: "💼",
    description: "Simulation d'entretiens d'embauche, conseils recruteurs et négociation.",
    systemPrompt: "Tu es un coach expert en entretien d'embauche et négociation salariale."
  },
  {
    id: "orientation",
    name: "Orientation & Assistance",
    badge: "🧭 Orientation",
    icon: "🧭",
    description: "Démarches administratives, orientation académique et reconversion pro.",
    systemPrompt: "Tu es un conseiller expert en orientation professionnelle et démarches."
  }
];

const DEFAULT_AI_WELCOME = {
  id: 'welcome-msg',
  sender: 'bot',
  text: "Bonjour ! 👋 Bienvenue sur l'Assistance IA Facilite.\n\nQuelle assistance souhaitez-vous aujourd'hui ?\n1️⃣ Rédaction & Correction de CV\n2️⃣ Coaching Entretien d'embauche\n3️⃣ Orientation & Démarches",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  status: "read",
  isPinned: false,
  persisted: false
};

const AI_WELCOME_MESSAGE = {
  id: "ai-welcome",
  role: "assistant",
  content: DEFAULT_AI_WELCOME.text
};

// Discussion IA épinglée permanente
const AI_PINNED_CHAT = {
  id: 'ai-assistant',
  name: 'Assistance IA Facilite',
  title: 'IA & Orientation Pro',
  company: 'Facilite Bot',
  avatar: '🤖',
  avatarInitials: '🤖',
  avatarColor: 'bg-emerald-600',
  lastMessage: 'Disponible 24/7 pour vos CV et démarches',
  time: "Disponible",
  unreadCount: 0,
  isPinned: true,
  isAI: true,
  online: true,
  favorite: true,
  messages: [DEFAULT_AI_WELCOME]
};

// Initialisation avec la discussion IA épinglée permanente
const initialConversations = [AI_PINNED_CHAT];

export default function MessageriePage() {
  const pathname = usePathname();
  const [selectedLang, setSelectedLang] = useState("FR");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Rôle IA actif (par défaut : Rédaction & Optimisation CV)
  const [activeAiRole, setActiveAiRole] = useState("cv");
  
  // Layout & Dropdown States
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const plusDropdownRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Notifications System (LinkedIn Style)
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState("all");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState([]);

  // Contact Modal States
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  
  // Recruitment Modal States
  const [recruitmentModalOpen, setRecruitmentModalOpen] = useState(false);
  const [isRecruitmentSubmitting, setIsRecruitmentSubmitting] = useState(false);
  const [recruitmentFormSubmitted, setRecruitmentFormSubmitted] = useState(false);
  const [recruitmentData, setRecruitmentData] = useState({ coverLetter: "" });
  const [recruitmentCV, setRecruitmentCV] = useState(null);

  // Messaging States
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConvId, setActiveConvId] = useState("ai-assistant");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false); // toggle list/chat on mobile
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'unread' | 'favorites'
  
  // File upload ref
  const fileInputRef = useRef(null);
  // Chat scroll anchor ref
  const chatBottomRef = useRef(null);
  // Registre des noeuds DOM par id de message (scroll vers le message épinglé)
  const messageNodesRef = useRef({});
  // Compteur d'ids temporaires pour les messages en cours d'envoi
  const tempIdCounterRef = useRef(0);

  // Toast System
  const [toast, setToast] = useState({ show: false, message: "", icon: "" });

  const triggerToast = (msg, icon = "fa-check") => {
    setToast({ show: true, message: msg, icon });
    setTimeout(() => setToast({ show: false, message: "", icon: "" }), 3000);
  };

  const t = translations[selectedLang] || translations.FR;

  // Language management
  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang) {
      setSelectedLang(savedLang);
    }
  }, []);

  const handleLangChange = (lang) => {
    setSelectedLang(lang);
    localStorage.setItem("lang", lang);
    triggerToast(lang === "FR" ? translations.FR.toastLangFR : translations.GB.toastLangGB, "fa-globe");
  };

  // Protection stricte et isolation des messages par l'ID d'utilisateur Supabase
  const [userSession, setUserSession] = useState(null);

  // Discussion IA épinglée : appel direct à /api/ai-chat (DeepSeek, spécialisé
  // par rôle) avec persistance Supabase dans la table `messages`.
  const [assistantMessages, setAssistantMessages] = useState([AI_WELCOME_MESSAGE]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const assistantIdRef = useRef(0);

  // ID réservé pour identifier l'expéditeur / destinataire Bot IA
  const AI_BOT_ID = "ai-assistant";

  // Charge l'historique des messages IA enregistrés dans Supabase pour l'utilisateur
  const loadAiMessagesFromSupabase = async (userId) => {
    if (!userId) return;
    try {
      // Filtrer les messages où l'utilisateur et le Bot sont interlocuteurs (sender/receiver)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${AI_BOT_ID}),and(sender_id.eq.${AI_BOT_ID},receiver_id.eq.${userId})`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erreur de chargement des messages IA Supabase:", error.message);
        return;
      }

      if (data && data.length > 0) {
        const loadedMsgs = data.map((row) => ({
          id: row.id,
          role: row.sender_id === userId ? "user" : "assistant",
          content: row.content,
          createdAt: row.created_at
        }));
        setAssistantMessages(loadedMsgs);
      } else {
        setAssistantMessages([AI_WELCOME_MESSAGE]);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de l'historique IA:", err);
    }
  };

  const appendAssistantMessage = async ({ content }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || userSession?.user?.id;

    const userMsg = {
      id: `ai-u-${(assistantIdRef.current += 1)}`,
      role: "user",
      content
    };

    // 1. Mise à jour locale de l'historique
    const historique = [...assistantMessages, userMsg];
    setAssistantMessages(historique);
    setAssistantLoading(true);

    // 2. Sauvegarde du message utilisateur dans Supabase (sender: userId, receiver: AI_BOT_ID)
    if (userId) {
      supabase.from("messages").insert({
        sender_id: userId,
        receiver_id: AI_BOT_ID,
        content: content,
        created_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.error("Erreur d'insertion du message utilisateur IA:", error.message);
      });
    }

    try {
      const token = session?.access_token || userSession?.access_token;

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: historique
            .filter(m => m.id !== AI_WELCOME_MESSAGE.id)
            .map(m => ({ role: m.role, content: m.content })),
          activeAiRole
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const botReplyText = data.reply || "Désolé, je n'ai pas pu générer de réponse.";

      setAssistantMessages(prev => [
        ...prev,
        {
          id: `ai-a-${(assistantIdRef.current += 1)}`,
          role: "assistant",
          content: botReplyText
        }
      ]);

      // 3. Sauvegarde de la réponse de l'IA (sender: AI_BOT_ID, receiver: userId)
      if (userId) {
        supabase.from("messages").insert({
          sender_id: AI_BOT_ID,
          receiver_id: userId,
          content: botReplyText,
          created_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) console.error("Erreur d'insertion de la réponse IA:", error.message);
        });
      }
    } catch (err) {
      console.error("Messagerie AI Error:", err);
      triggerToast(
        selectedLang === "FR" ? "Erreur de l'assistant IA" : "AI assistant error",
        "fa-triangle-exclamation"
      );
    } finally {
      setAssistantLoading(false);
    }
  };

  // Synchronise le fil useChat vers l'entrée ai-assistant de `conversations`
  useEffect(() => {
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    setConversations(prev => prev.map(c => {
      if (c.id !== AI_PINNED_CHAT.id) return c;
      return {
        ...c,
        lastMessage: lastMsg ? lastMsg.content : c.lastMessage,
        messages: assistantMessages.map(m => ({
          id: m.id,
          sender: m.role === "user" ? "me" : "them",
          text: m.content,
          time: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "read",
          isPinned: false,
          persisted: true
        }))
      };
    }));
  }, [assistantMessages]);

  useEffect(() => {
    async function loadUserSessionAndMessages() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setUserSession(session);
      loadAiMessagesFromSupabase(session.user.id);

      // Écouter également les changements de session en temps réel
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (!currentSession) {
          window.location.replace("/login");
        } else {
          setUserSession(currentSession);
        }
      });

      // Charger uniquement les messages appartenant à cet utilisateur authentifié
      // (envoyés ou reçus — la RLS garantit déjà l'isolation côté base).
      try {
        const { messages: formattedMsgs, error: messagesError } = await fetchConversationMessages(session.user.id);

        if (messagesError) {
          triggerToast("Erreur de chargement de la discussion", "fa-triangle-exclamation");
        }

        if (formattedMsgs.length > 0) {
          const userConv = {
            id: 1,
            name: "Support RH Facilité",
            title: "Assistance & Recrutement",
            company: "Facilite Corporation",
            avatarColor: "bg-[#10E688]",
            avatarInitials: "FC",
            logo: "/logo.jpeg",
            lastMessage: formattedMsgs[formattedMsgs.length - 1].text,
            time: formattedMsgs[formattedMsgs.length - 1].time,
            unreadCount: 0,
            online: true,
            favorite: true,
            messages: formattedMsgs
          };

          // Fusion avec l'état déjà en place plutôt qu'un remplacement brut : le fil
          // IA (useChat) peut déjà avoir synchronisé son message d'accueil ou les
          // premiers échanges avant que cette promesse ne se résolve. Utiliser la
          // constante statique AI_PINNED_CHAT ici écraserait ce contenu (course
          // entre cet effet asynchrone et l'effet de synchronisation useChat).
          setConversations(prev => {
            const aiConv = prev.find(c => c.id === AI_PINNED_CHAT.id) || AI_PINNED_CHAT;
            return [aiConv, userConv];
          });
          setActiveConvId("ai-assistant");
        } else {
          setConversations(prev => {
            const aiConv = prev.find(c => c.id === AI_PINNED_CHAT.id) || AI_PINNED_CHAT;
            return [aiConv];
          });
          setActiveConvId("ai-assistant");
        }
      } catch (err) {
        console.error("Erreur de chargement des messages utilisateur:", err);
        setConversations(prev => {
          const aiConv = prev.find(c => c.id === AI_PINNED_CHAT.id) || AI_PINNED_CHAT;
          return [aiConv];
        });
        setActiveConvId("ai-assistant");
      }

      return () => subscription.unsubscribe();
    }

    loadUserSessionAndMessages();
  }, []);

  // Scroll to bottom of chat whenever active conversation or messages or typing state changes
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConvId, conversations, isTyping]);

  // Handle active message read status
  useEffect(() => {
    if (activeConvId) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId && c.unreadCount > 0) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      }));
    }
  }, [activeConvId]);

  // Modals management
  const handleOpenContactModal = (e) => {
    if (e) e.preventDefault();
    setContactModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
    setTimeout(() => {
      setFormSubmitted(false);
      setIsSubmitting(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 300);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      triggerToast(t.modalSuccessTitle, "fa-paper-plane");
    }, 1200);
  };

  const handleOpenRecruitmentModal = (e) => {
    if (e) e.preventDefault();
    setRecruitmentModalOpen(true);
    setMobileMenuOpen(false);
  };

  const handleCloseRecruitmentModal = () => {
    setRecruitmentModalOpen(false);
    setTimeout(() => {
      setRecruitmentFormSubmitted(false);
      setIsRecruitmentSubmitting(false);
      setRecruitmentData({ coverLetter: "" });
      setRecruitmentCV(null);
    }, 300);
  };

  const handleRecruitmentSubmit = (e) => {
    e.preventDefault();
    setIsRecruitmentSubmitting(true);
    setTimeout(() => {
      setIsRecruitmentSubmitting(false);
      setRecruitmentFormSubmitted(true);
      triggerToast(t.recruitmentSuccessTitle, "fa-paper-plane");
    }, 1200);
  };

  // Filtered Notifications helper
  const filteredNotifications = notificationsList.filter(n => {
    if (activeNotifFilter === "jobs") return n.type === "jobs";
    if (activeNotifFilter === "posts") return n.type === "posts";
    if (activeNotifFilter === "mentions") return n.type === "mentions";
    return true;
  });

  // Esc closes modals & dropdowns
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseContactModal();
        if (recruitmentModalOpen) handleCloseRecruitmentModal();
        if (plusDropdownOpen) setPlusDropdownOpen(false);
        if (notificationsModalOpen) setNotificationsModalOpen(false);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (plusDropdownRef.current && !plusDropdownRef.current.contains(e.target)) {
        setPlusDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contactModalOpen, recruitmentModalOpen, plusDropdownOpen, notificationsModalOpen, userMenuOpen]);

  const toggleFavorite = (id) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        const nextFav = !c.favorite;
        triggerToast(
          nextFav 
            ? (selectedLang === "FR" ? "Ajouté aux favoris !" : "Added to favorites!") 
            : (selectedLang === "FR" ? "Retiré des favoris" : "Removed from favorites"),
          "fa-heart"
        );
        return { ...c, favorite: nextFav };
      }
      return c;
    }));
  };

  // --- ÉPINGLAGE D'UN MESSAGE ------------------------------------------------
  // Mise à jour optimiste : l'UI bascule immédiatement, puis on confirme en base.
  // En cas d'échec (droits, réseau), l'état précédent est restauré intégralement.
  const handleTogglePin = async (msg) => {
    if (!msg?.persisted) {
      triggerToast(t.pinError, "fa-triangle-exclamation");
      return;
    }

    const nextPinned = !msg.isPinned;
    // On mémorise uniquement l'état d'épinglage, pas tout le fil : un message
    // peut arriver pendant l'aller-retour réseau et ne doit pas être écrasé.
    const previousPinStates = new Map(
      (conversations.find(c => c.id === activeConvId)?.messages || []).map(m => [m.id, m.isPinned])
    );

    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvId) return c;
      return {
        ...c,
        messages: c.messages.map(m => ({
          ...m,
          // Un seul message épinglé à la fois : les autres sont décochés,
          // ce qui reflète exactement ce que fait la RPC côté base.
          isPinned: m.id === msg.id ? nextPinned : (nextPinned ? false : m.isPinned)
        }))
      };
    }));

    const { error } = await toggleMessagePin(msg.id, nextPinned);

    if (error) {
      setConversations(prev => prev.map(c => {
        if (c.id !== activeConvId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            previousPinStates.has(m.id) ? { ...m, isPinned: previousPinStates.get(m.id) } : m
          )
        };
      }));
      triggerToast(t.pinError, "fa-triangle-exclamation");
      return;
    }

    triggerToast(nextPinned ? t.pinSuccess : t.unpinSuccess, "fa-thumbtack");
  };

  // Défilement vers le message épinglé depuis la bannière
  const scrollToPinnedMessage = (messageId) => {
    const node = messageNodesRef.current[messageId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("ring-2", "ring-amber-400");
    setTimeout(() => node.classList.remove("ring-2", "ring-amber-400"), 1600);
  };

  // Send Message Logic
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    // Discussion IA : streaming réel via useChat, jamais persisté dans Supabase.
    if (activeConvId === AI_PINNED_CHAT.id) {
      const userMessageText = messageText;
      setMessageText("");
      setShowEmojiPicker(false);

      // Le jeton Bearer est relu directement dans appendAssistantMessage.
      appendAssistantMessage({ role: "user", content: userMessageText });
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageText = messageText;
    // Id temporaire : remplacé par l'UUID renvoyé par la base dès l'insertion
    // réussie, sans quoi le message ne serait pas épinglable avant rechargement.
    const tempId = `temp-${(tempIdCounterRef.current += 1)}`;

    // 1. Add user message to state
    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        const newMsg = {
          id: tempId,
          sender: "me",
          text: userMessageText,
          time: timestamp,
          status: "sent",
          isPinned: false,
          persisted: false
        };
        return {
          ...c,
          lastMessage: userMessageText,
          time: "À l'instant",
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    setMessageText("");
    setShowEmojiPicker(false);

    // Synchronisation avec la table Supabase messages
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: savedRow, error: sendError } = await sendMessage({
          senderId: session.user.id,
          content: userMessageText
        });

        if (sendError) {
          triggerToast("Message non enregistré", "fa-triangle-exclamation");
        } else if (savedRow) {
          // Réconciliation id temporaire → UUID réel
          setConversations(prev => prev.map(c => {
            if (c.id !== activeConvId) return c;
            return {
              ...c,
              messages: c.messages.map(m =>
                m.id === tempId ? { ...formatMessageRow(savedRow, session.user.id), status: m.status } : m
              )
            };
          }));
        }
      }
    } catch (err) {
      console.error("Erreur d'envoi du message sur Supabase:", err);
      triggerToast("Message non enregistré", "fa-triangle-exclamation");
    }

    // Update status to delivered quickly
    setTimeout(() => {
      setConversations(prev => prev.map(c => {
        if (c.id === activeConvId) {
          return {
            ...c,
            messages: c.messages.map(m => m.text === userMessageText ? { ...m, status: "delivered" } : m)
          };
        }
        return c;
      }));
    }, 500);

    // 2. Trigger Bot Simulation
    triggerBotResponse(activeConvId, userMessageText);
  };

  // Bot response simulator
  const triggerBotResponse = (convId, userMsg) => {
    const activeConv = conversations.find(c => c.id === convId);
    if (!activeConv) return;

    // Simulate typing after 1 second
    setTimeout(() => {
      // Check if user is still on this conversation
      if (activeConvId === convId) {
        setIsTyping(true);
      }

      // Add response after another 1.5 seconds
      setTimeout(() => {
        setIsTyping(false);
        
        const responses = selectedLang === "FR" ? activeConv.responsesFR : activeConv.responsesEN;
        if (!responses?.length) return;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const botTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setConversations(prev => prev.map(c => {
          if (c.id === convId) {
            const newBotMsg = {
              id: `local-${Date.now() + 1}`,
              sender: "them",
              text: randomResponse,
              time: botTimestamp,
              status: "read",
              isPinned: false,
              persisted: false
            };
            return {
              ...c,
              lastMessage: randomResponse,
              time: botTimestamp,
              // Make sure our sent messages in this conversation are now marked 'read'
              messages: [...c.messages.map(m => m.sender === 'me' ? { ...m, status: 'read' } : m), newBotMsg]
            };
          }
          return c;
        }));

        // Notification toast if active channel changed
        if (activeConvId !== convId) {
          setConversations(prev => prev.map(c => {
            if (c.id === convId) {
              return { ...c, unreadCount: c.unreadCount + 1 };
            }
            return c;
          }));
          triggerToast(`Nouveau message de ${activeConv.name}`, "fa-comment");
        }
      }, 1500);

    }, 800);
  };

  // Trigger file attachment select
  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle uploaded file sending simulation
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedSize = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + " MB" 
      : (file.size / 1024).toFixed(0) + " KB";

    // Add user file message to conversation
    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        const newMsg = {
          id: `local-${Date.now()}`,
          sender: "me",
          text: `${t.fileSent}${file.name}`,
          time: timestamp,
          file: {
            name: file.name,
            size: formattedSize,
            type: file.type
          },
          status: "sent",
          isPinned: false,
          persisted: false
        };
        return {
          ...c,
          lastMessage: `📎 ${file.name}`,
          time: "À l'instant",
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    triggerToast("Fichier partagé dans la discussion !", "fa-paperclip");

    // Trigger responder response specifically for file
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const botTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const fileResponse = selectedLang === "FR" 
          ? "Bien reçu ! Merci pour le document, je l'examine tout de suite et je vous redis." 
          : "Well received! Thanks for the document, I will review it right away and let you know.";

        setConversations(prev => prev.map(c => {
          if (c.id === activeConvId) {
            const newBotMsg = {
              id: `local-${Date.now() + 2}`,
              sender: "them",
              text: fileResponse,
              time: botTimestamp,
              status: "read",
              isPinned: false,
              persisted: false
            };
            return {
              ...c,
              lastMessage: fileResponse,
              time: botTimestamp,
              messages: [...c.messages.map(m => m.sender === 'me' ? { ...m, status: 'read' } : m), newBotMsg]
            };
          }
          return c;
        }));
      }, 1500);
    }, 1000);

    // Clear input
    e.target.value = "";
  };

  // Emojis list helper
  const emojis = ["👋", "👍", "😊", "🔥", "💼", "🚀", "💯", "🙏", "❤️", "💡", "🤔", "👏"];

  const handleAddEmoji = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Filter conversations based on tab and query
  const filteredConversations = conversations.filter(c => {
    if (filterTab === "unread" && c.unreadCount === 0) return false;
    if (filterTab === "favorites" && !c.favorite) return false;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           c.company.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeConversation = conversations.find(c => c.id === activeConvId) || conversations[0];

  // Message épinglé de la discussion active (au plus un, garanti par la RPC)
  const pinnedMessage = activeConversation?.messages?.find(m => m.isPinned) || null;

  return (
    <>
      {/* Toast Notification Top Floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <i className={`fa-solid ${toast.icon} text-[#10E688] text-xl`}></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) */}
      <nav className="bg-[#FAF6F1] px-4 md:px-6 py-2.5 shadow-sm fixed top-0 left-0 w-full z-50">
        <div className="max-w-[1180px] mx-auto w-full flex items-center justify-between">
          
          {/* Groupe Gauche : Logo + Barre de Recherche */}
          <div className="flex items-center space-x-3">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>

            {/* Barre de recherche */}
            <div className="hidden sm:block relative w-48 md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </span>
              <input
                type="text"
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#E5E7EB] rounded-full text-xs text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all font-medium"
                placeholder={t.searchPlaceholder || "Rechercher une offre d'emploi..."}
              />
            </div>
          </div>

          {/* Groupe Centre : Liens principaux (Accueil, Messagerie, Notifications, Recrutement, Plus) */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {/* Accueil */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 ${
                pathname === "/" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navHome}</span>
            </Link>
            
            {/* Messagerie (Actif sur la page de messagerie) */}
            {userSession && (
              <Link
                href="/messagerie"
                className={`flex flex-col items-center justify-center text-center transition space-y-1 cursor-pointer w-16 relative ${
                  pathname === "/messagerie" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-regular fa-comments text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight">{t.navMessages}</span>
                <span className="absolute top-0.5 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </Link>
            )}

            {/* Notifications */}
            {userSession && (
              <button
                type="button"
                onClick={() => setNotificationsModalOpen(true)}
                className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 relative transition ${
                  notificationsModalOpen ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-regular fa-bell text-xl"></i>
                <span className="text-[11px] font-bold tracking-tight">Notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 right-2 bg-red-600 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center shadow-xs border border-white animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            )}

            {/* Recrutement Spontané */}
            <a
              href="#"
              onClick={handleOpenRecruitmentModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-user-tie text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Recrutement</span>
            </a>

            {/* Plus Dropdown Menu (Contient Service & Contact) */}
            <div className="relative" ref={plusDropdownRef}>
              <button
                type="button"
                onClick={() => setPlusDropdownOpen(!plusDropdownOpen)}
                className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                  plusDropdownOpen || pathname === "/service" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className="fa-solid fa-bars text-xl"></i>
                <div className="flex items-center space-x-1 text-[11px] font-bold tracking-tight">
                  <span>Plus</span>
                  <i className={`fa-solid fa-caret-down text-[9px] transition-transform duration-200 ${plusDropdownOpen ? "rotate-180" : ""}`}></i>
                </div>
              </button>

              {/* Menu Déroulant "Plus" Overlay */}
              {plusDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-gray-200 shadow-2xl py-1.5 z-[600] animate-fade-in-up">
                  <Link
                    href="/service"
                    onClick={() => setPlusDropdownOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition"
                  >
                    <i className="fa-solid fa-briefcase text-lg text-gray-600 w-5 text-center"></i>
                    <span>Service</span>
                  </Link>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPlusDropdownOpen(false);
                      handleOpenContactModal();
                    }}
                    className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition border-t border-gray-100"
                  >
                    <i className="fa-regular fa-comment-dots text-lg text-gray-600 w-5 text-center"></i>
                    <span>Contact</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Groupe Droit : Langue & Profil */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Sélecteur de langue */}
            <div className="flex bg-gray-100 rounded-full p-1 border border-gray-200">
              <button
                onClick={() => handleLangChange("FR")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedLang === "FR" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <img src="/francais.avif" alt="FR" className="w-3.5 h-3.5 rounded-full object-cover" />
                <span>FR</span>
              </button>
              <button
                onClick={() => handleLangChange("GB")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedLang === "GB" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <img src="/anglais.jpeg" alt="GB" className="w-3.5 h-3.5 rounded-full object-cover" />
                <span>EN</span>
              </button>
            </div>

            {userSession ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex flex-col items-center justify-center text-center space-y-1 cursor-pointer w-16 transition ${
                    pathname === "/profil" ? "text-[#10E688] font-bold" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <i className="fa-solid fa-circle-user text-xl"></i>
                  <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Mon Profil</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-2xl py-1.5 z-[600] animate-fade-in-up">
                    <Link
                      href="/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-blue-600 transition"
                    >
                      <i className="fa-regular fa-user text-lg text-gray-600 w-5 text-center"></i>
                      <span>Voir mon profil & CV</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        triggerToast("Déconnexion en cours...", "fa-right-from-bracket");
                        setTimeout(() => {
                          handleGlobalSignOut();
                        }, 400);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-red-50 hover:text-red-600 transition border-t border-gray-100 cursor-pointer text-left"
                    >
                      <i className="fa-solid fa-right-from-bracket text-red-500 text-sm w-5 text-center"></i>
                      <span>Déconnexion</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-xs font-extrabold text-gray-800 hover:text-gray-900 bg-white border border-gray-200 px-3.5 py-2 rounded-full shadow-xs hover:border-gray-300 transition cursor-pointer"
                >
                  Connexion
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Controls: Bell & Messagerie */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              type="button"
              onClick={() => setNotificationsModalOpen(true)}
              className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs relative cursor-pointer"
              aria-label="Notifications"
            >
              <i className="fa-regular fa-bell text-sm"></i>
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <Link
              href="/messagerie"
              className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs relative cursor-pointer"
              aria-label="Messagerie"
            >
              <i className="fa-regular fa-comments text-sm"></i>
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-blue-600 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
            </button>
          </div>
        </div>

        {/* Fixed Bottom Mobile Navigation Bar (LinkedIn Mobile Style) */}
        <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-[500] bg-[#FAF6F1] border-t border-gray-200 shadow-xl py-2 px-3 items-center justify-around">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 ${
              pathname === "/" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navHome}</span>
          </Link>

          <Link
            href="/service"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 ${
              pathname === "/service" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <i className="fa-solid fa-briefcase text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navService}</span>
          </Link>

          <Link
            href="/messagerie"
            className={`flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 relative ${
              pathname === "/messagerie" ? "text-[#10E688] font-extrabold" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <i className="fa-regular fa-comments text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navMessages}</span>
            <span className="absolute top-0.5 right-2 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setNotificationsModalOpen(true)}
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800 relative"
          >
            <i className="fa-regular fa-bell text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Notifs</span>
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 right-1.5 bg-red-600 text-white text-[8px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center border border-white">
                {unreadNotifCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-bars text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">Plus</span>
          </button>
        </div>

        {/* Menu Déroulant Mobile Plein Écran */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[600] bg-[#F4F2EE] flex flex-col md:hidden animate-fade-in-up">
            {/* Entête du Menu */}
            <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-700 hover:text-gray-900 focus:outline-none cursor-pointer flex items-center"
                >
                  <i className="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">Menu</h1>
              </div>
              
              <div className="flex items-center space-x-4 text-blue-600">
                <button
                  onClick={() => triggerToast("Tri...", "fa-arrow-up-down")}
                  className="hover:opacity-85 focus:outline-none cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-up-down text-lg"></i>
                </button>
                <button
                  onClick={() => triggerToast("Recherche...", "fa-magnifying-glass")}
                  className="hover:opacity-85 focus:outline-none cursor-pointer"
                >
                  <i className="fa-solid fa-magnifying-glass text-lg"></i>
                </button>
              </div>
            </div>

            {/* Corps du Menu */}
            <div className="flex-grow p-4 space-y-3 overflow-y-auto">
              {/* Card 1 : Profil */}
              <Link
                href="/profil"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-200 shadow-xs active:bg-gray-50 transition"
              >
                {/* Cercle Avatar Violet */}
                <div className="w-12 h-12 rounded-full bg-[#D946EF] flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg">
                  M
                </div>
                <div className="flex-grow text-left">
                  <h3 className="text-sm font-extrabold text-gray-900">Macoumba Samak</h3>
                  <span className="text-xs text-gray-500 font-medium">Voir votre profil</span>
                </div>
              </Link>

              {/* Card 2 : Inviter des amis */}
              <button
                type="button"
                onClick={() => {
                  triggerToast("Lien d'invitation copié !", "fa-heart");
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.origin);
                  }
                }}
                className="w-full bg-white rounded-xl p-4 flex items-center space-x-4 border border-gray-205 shadow-xs active:bg-gray-50 transition text-left cursor-pointer"
              >
                <span className="text-2xl flex-shrink-0">❤️</span>
                <span className="text-sm font-extrabold text-gray-955">Inviter des ami(e)s</span>
              </button>
            </div>

            {/* Bas du Menu (Options fixes au bas) */}
            <div className="bg-white border-t border-gray-200 divide-y divide-gray-150 mt-auto">
              {/* Option 1: Paramètres */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => triggerToast("Paramètres", "fa-gear")}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <i className="fa-solid fa-gear text-gray-400 text-lg"></i>
                    <span>Paramètres et confidentialité</span>
                  </div>
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </button>
              </div>

              {/* Option 2: Aide */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => triggerToast("Aide & Assistance", "fa-circle-question")}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center space-x-3.5">
                    <i className="fa-regular fa-circle-question text-gray-400 text-lg"></i>
                    <span>Aide et assistance</span>
                  </div>
                  <i className="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                </button>
              </div>

              {/* Option 3: Ajouter un compte */}
              <button
                type="button"
                onClick={() => triggerToast("Ajouter un compte...", "fa-user-plus")}
                className="w-full px-5 py-4 flex items-center space-x-3.5 text-left text-sm font-bold text-gray-700 active:bg-gray-50 cursor-pointer"
              >
                <i className="fa-solid fa-user-plus text-gray-400 text-lg"></i>
                <span>Ajouter un compte</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Interface de Messagerie */}
      <main className="min-h-screen bg-[#F4F2EE] pt-[124px] md:pt-[76px] pb-10 px-4 md:px-6">
        <div className="max-w-[1180px] mx-auto bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden h-[calc(100vh-168px)] md:h-[calc(100vh-120px)] flex relative">
          
          {/* COLONNE GAUCHE : LISTE DES DISCUSSIONS */}
          <aside className={`w-full md:w-[350px] border-r border-gray-200 flex flex-col bg-white h-full ${
            mobileChatView ? "hidden md:flex" : "flex"
          }`}>
            {/* Header Recherche */}
            <div className="p-4 border-b border-gray-150 flex flex-col space-y-3">
              <h2 className="text-lg font-extrabold text-gray-900">Messages</h2>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <i className="fa-solid fa-magnifying-glass text-[#9CA3AF] text-sm"></i>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-900 placeholder-[#9CA3AF] focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Filtres de messages */}
            <div className="px-4 pb-3 border-b border-gray-150 flex items-center space-x-2 text-xs font-bold text-gray-500 bg-white">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  filterTab === "all" ? "bg-gray-100 text-gray-900" : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                }`}
              >
                <span>{t.filterAll}</span>
              </button>
              
              <button
                type="button"
                onClick={() => setFilterTab("unread")}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer relative ${
                  filterTab === "unread" ? "bg-gray-100 text-gray-900" : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                }`}
              >
                <span className="relative flex items-center">
                  <i className="fa-regular fa-comment-dots text-sm"></i>
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-gray-900"></span>
                </span>
                <span>{t.filterUnread}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("favorites")}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  filterTab === "favorites" ? "bg-gray-100 text-gray-900" : "hover:bg-gray-50 text-gray-500 hover:text-gray-900"
                }`}
              >
                <i className="fa-regular fa-heart text-sm"></i>
                <span>{t.filterFavorites}</span>
              </button>
            </div>

            {/* Liste des conversations */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {/* 🤖 Carte de discussion IA Épinglée toujours visible en haut */}
              <div
                key={AI_PINNED_CHAT.id}
                onClick={() => {
                  setActiveConvId(AI_PINNED_CHAT.id);
                  setMobileChatView(true);
                  if (userSession?.user?.id) {
                    loadAiMessagesFromSupabase(userSession.user.id);
                  }
                }}
                className={`flex items-start space-x-3 p-4 cursor-pointer transition-all relative border-b border-emerald-200/80 ${
                  activeConvId === AI_PINNED_CHAT.id
                    ? "bg-emerald-100/70 border-l-4 border-[#10E688]"
                    : "bg-emerald-50/60 hover:bg-emerald-100/40"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-600 text-white text-xl shadow-sm">
                    🤖
                  </div>
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                      <h3 className="text-sm font-extrabold text-gray-900 truncate">
                        {AI_PINNED_CHAT.name}
                      </h3>
                      <span className="bg-emerald-200 text-emerald-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        📌 Épinglé
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700">{AI_PINNED_CHAT.time}</span>
                  </div>
                  <div className="flex items-center space-x-1 mb-0.5">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md truncate max-w-[150px]">
                      {AI_PINNED_CHAT.company}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500 truncate">{AI_PINNED_CHAT.title}</span>
                  </div>
                  <p className="text-xs truncate font-medium text-gray-700">
                    {AI_PINNED_CHAT.lastMessage}
                  </p>
                </div>
              </div>

              {/* Autres discussions */}
              {filteredConversations.filter(c => c.id !== AI_PINNED_CHAT.id).length > 0 ? (
                filteredConversations.filter(c => c.id !== AI_PINNED_CHAT.id).map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setMobileChatView(true);
                    }}
                    className={`flex items-start space-x-3 p-4 cursor-pointer hover:bg-gray-50 transition-all relative ${
                      activeConvId === conv.id ? "bg-[#2563EB]/5 border-l-4 border-[#2563EB]" : ""
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-inner ${conv.avatarColor}`}>
                        {conv.avatarInitials}
                      </div>
                      {conv.online && (
                        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                          <h3 className="text-sm font-extrabold text-gray-900 truncate">{conv.name}</h3>
                          {conv.favorite && (
                            <i className="fa-solid fa-heart text-red-500 text-[10px]" title="Favori"></i>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-gray-400">{conv.time}</span>
                      </div>
                      <div className="flex items-center space-x-1 mb-0.5">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md truncate max-w-[150px]">
                          {conv.company}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 truncate">{conv.title}</span>
                      </div>
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? "font-bold text-gray-900" : "text-gray-500"}`}>
                        {conv.lastMessage}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="absolute right-4 bottom-4 bg-red-500 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs animate-bounce">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-gray-400 font-semibold italic">
                  Aucune autre discussion.
                </div>
              )}
            </div>
          </aside>

          {/* COLONNE DROITE : CHAT ACTIF */}
          <section className={`flex-1 flex flex-col bg-[#FAF9F6] h-full relative ${
            !mobileChatView ? "hidden md:flex" : "flex"
          }`}>
            {activeConversation ? (
              <>
                <div className="bg-white p-4 border-b border-gray-200 flex flex-col space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <button
                        onClick={() => setMobileChatView(false)}
                        className="md:hidden text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer mr-1"
                      >
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                      </button>

                      <div className="relative">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-inner ${activeConversation.avatarColor}`}>
                          {activeConversation.avatarInitials}
                        </div>
                        {activeConversation.online && (
                          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white"></span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h2 className="text-sm font-extrabold text-gray-900 truncate leading-snug">{activeConversation.name}</h2>
                          {activeConversation.isAI ? (
                            <span className="hidden sm:inline-block text-[10px] font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              ⚡ IA 24/7
                            </span>
                          ) : (
                            <span className="hidden sm:inline-block text-[10px] font-extrabold text-white bg-gray-900 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              {t.recruiterTitle}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium truncate">
                          {activeConversation.title} — <span className="font-bold text-gray-800">{activeConversation.company}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleFavorite(activeConversation.id)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition ${
                          activeConversation.favorite
                            ? "text-red-500 bg-red-50 hover:bg-red-100"
                            : "text-gray-500 hover:text-red-500 hover:bg-red-50"
                        }`}
                        title={activeConversation.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <i className={`${activeConversation.favorite ? "fa-solid fa-heart" : "fa-regular fa-heart"}`}></i>
                      </button>
                      {!activeConversation.isAI && (
                        <button
                          onClick={() => triggerToast(`Appel simulé vers ${activeConversation.name}...`, "fa-phone")}
                          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                        >
                          <i className="fa-solid fa-phone"></i>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (pinnedMessage) scrollToPinnedMessage(pinnedMessage.id);
                          else triggerToast(t.noPinnedMessage, "fa-thumbtack");
                        }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition ${
                          pinnedMessage
                            ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                            : "text-gray-500 hover:text-amber-600 hover:bg-amber-50"
                        }`}
                        title={pinnedMessage ? t.jumpToPinned : t.noPinnedMessage}
                      >
                        <i className="fa-solid fa-thumbtack"></i>
                      </button>
                    </div>
                  </div>

                  {/* Sélecteur de 3 IA d'assistance (Pills) si le canal actif est la discussion IA */}
                  {activeConversation.isAI && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-gray-100">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex-shrink-0">
                        Choisir une IA :
                      </span>
                      {AI_ROLES.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setActiveAiRole(role.id);
                            triggerToast(`IA sélectionnée : ${role.name}`, "fa-robot");
                          }}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                            activeAiRole === role.id
                              ? "bg-emerald-500 text-white shadow-sm scale-[1.02]"
                              : "bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
                          }`}
                          title={role.description}
                        >
                          <span>{role.badge}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* BANNIÈRE MESSAGE ÉPINGLÉ (toujours visible en haut du fil) */}
                {pinnedMessage && (
                  <div className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-sm px-4 pt-3 pb-2 border-b border-amber-200/70 shadow-xs animate-fade-in-up">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-xl p-3 shadow-xs">
                      <span className="text-base leading-none mt-0.5 flex-shrink-0" aria-hidden="true">📌</span>

                      <button
                        type="button"
                        onClick={() => scrollToPinnedMessage(pinnedMessage.id)}
                        className="flex-1 min-w-0 text-left cursor-pointer group"
                        title={t.jumpToPinned}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
                            {t.pinnedLabel}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600/80">
                            {pinnedMessage.sender === "me" ? "Vous" : activeConversation.name} · {pinnedMessage.time}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-amber-950 leading-relaxed line-clamp-2 group-hover:underline decoration-amber-400 underline-offset-2">
                          {pinnedMessage.text}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePin(pinnedMessage)}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                        title={t.unpinAction}
                        aria-label={t.unpinAction}
                      >
                        <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* Messages scrollarea */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Séparateur visuel entre la zone épinglée et le fil chronologique */}
                  {pinnedMessage && (
                    <div className="flex items-center gap-3 pb-1">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {selectedLang === "FR" ? "Discussion" : "Conversation"}
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                  )}

                  {activeConversation.messages.map(msg => (
                    <div
                      key={msg.id}
                      ref={(node) => {
                        if (node) messageNodesRef.current[msg.id] = node;
                        else delete messageNodesRef.current[msg.id];
                      }}
                      className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"} items-end space-x-1.5 rounded-2xl transition-all duration-500`}
                    >
                      {msg.sender === "them" && (
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-extrabold text-[10px] shadow-inner ${activeConversation.avatarColor}`}>
                          {activeConversation.avatarInitials}
                        </div>
                      )}

                      <div
                        className={`max-w-[75%] rounded-2xl p-3.5 shadow-xs border relative group transition-all hover:shadow-md ${
                          msg.sender === "me"
                            ? "bg-[#2563EB] text-white border-blue-600 rounded-br-xs"
                            : "bg-white text-gray-800 border-gray-200 rounded-bl-xs"
                        } ${msg.isPinned ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#FAF9F6]" : ""}`}
                      >
                        {/* Action d'épinglage — visible au survol / focus clavier.
                            Réservée aux messages réellement enregistrés en base. */}
                        {msg.persisted && (
                          <button
                            type="button"
                            onClick={() => handleTogglePin(msg)}
                            className={`absolute -top-2.5 ${msg.sender === "me" ? "-left-2.5" : "-right-2.5"} w-7 h-7 rounded-full bg-white border shadow-md flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                              msg.isPinned
                                ? "border-amber-400 text-amber-600 opacity-100"
                                : "border-gray-200 text-gray-400 hover:text-amber-600 hover:border-amber-300"
                            }`}
                            title={msg.isPinned ? t.unpinAction : t.pinAction}
                            aria-label={msg.isPinned ? t.unpinAction : t.pinAction}
                            aria-pressed={msg.isPinned}
                          >
                            <i className={`fa-solid fa-thumbtack text-[10px] ${msg.isPinned ? "" : "rotate-45"}`}></i>
                          </button>
                        )}

                        {msg.isPinned && (
                          <div className={`flex items-center gap-1 mb-1.5 text-[9px] font-extrabold uppercase tracking-wider ${
                            msg.sender === "me" ? "text-amber-200" : "text-amber-600"
                          }`}>
                            <span aria-hidden="true">📌</span>
                            <span>{t.pinnedLabel}</span>
                          </div>
                        )}

                        {msg.file && (
                          <div className="flex items-center space-x-3 bg-black/10 p-2.5 rounded-xl mb-1 border border-white/10 text-left">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white">
                              <i className="fa-regular fa-file-pdf text-xl"></i>
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate max-w-[160px]">{msg.file.name}</span>
                              <span className="text-[10px] opacity-75 block">{msg.file.size}</span>
                            </div>
                            <button
                              onClick={() => triggerToast(`Téléchargement de ${msg.file.name}...`, "fa-download")}
                              className="text-white hover:text-green-300 transition cursor-pointer"
                            >
                              <i className="fa-solid fa-arrow-down-long text-sm bg-white/20 w-7 h-7 rounded-full flex items-center justify-center"></i>
                            </button>
                          </div>
                        )}

                        <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        
                        <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] opacity-75 font-bold">
                          <span>{msg.time}</span>
                          {msg.sender === "me" && (
                            <span>
                              {msg.status === "sent" && <i className="fa-solid fa-check"></i>}
                              {msg.status === "delivered" && <i className="fa-solid fa-check-double text-gray-300"></i>}
                              {msg.status === "read" && <i className="fa-solid fa-check-double text-[#10E688]"></i>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {(isTyping || (activeConvId === AI_PINNED_CHAT.id && assistantLoading)) && (
                    <div className="flex justify-start items-end space-x-2 animate-pulse">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-extrabold text-[10px] shadow-inner ${activeConversation.avatarColor}`}>
                        {activeConversation.avatarInitials}
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-xs px-4 py-2.5 shadow-xs flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 border-t border-gray-200 relative">
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-4 bg-white border border-gray-200 p-2.5 rounded-2xl shadow-xl flex gap-1.5 z-40 mb-2 max-w-xs flex-wrap animate-fade-in-up">
                      {emojis.map(e => (
                        <button
                          key={e}
                          onClick={() => handleAddEmoji(e)}
                          className="hover:scale-125 transition text-base p-1 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center space-x-2.5">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={handleAttachmentClick}
                      className="text-gray-400 hover:text-blue-600 transition hover:bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
                      title={t.attachmentTooltip}
                    >
                      <i className="fa-solid fa-paperclip text-lg"></i>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-gray-400 hover:text-amber-500 transition hover:bg-amber-50 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer"
                      title={t.emojiTooltip}
                    >
                      <i className="fa-regular fa-smile text-lg"></i>
                    </button>

                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t.inputPlaceholder}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all placeholder-[#9CA3AF]"
                    />

                    <button
                      type="submit"
                      disabled={!messageText.trim()}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        messageText.trim()
                          ? "bg-[#2563EB] text-white hover:bg-blue-700 shadow-md hover:scale-105 active:scale-95"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <i className="fa-solid fa-paper-plane text-sm"></i>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                <div className="w-20 h-20 bg-blue-50 border border-blue-100 text-blue-500 rounded-[2rem] flex items-center justify-center shadow-xs mb-6">
                  <i className="fa-regular fa-comments text-4xl"></i>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900 mb-2">{t.noChatSelectedTitle}</h3>
                <p className="text-xs text-gray-500 max-w-sm font-semibold leading-relaxed">
                  {t.noChatSelectedSubtitle}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-950 text-gray-400 py-6 border-t border-gray-900 mt-auto">
        <div className="max-w-[1180px] mx-auto px-4 text-center text-xs font-semibold text-gray-500">
          <p>{t.footerCopyright}</p>
        </div>
      </footer>

      {/* MODAL CONTACT */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in-up"
          onClick={(e) => {
            if (e.target.id === "contact-modal-wrapper") handleCloseContactModal();
          }}
          id="contact-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100">
            <button
              onClick={handleCloseContactModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            {!formSubmitted ? (
              <>
                <div className="mb-6">
                  <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.modalTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium mb-4">
                    {t.modalSubtitle}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 border border-gray-150 rounded-2xl">
                    <a
                      href="https://wa.me/message/KQERLEMIO7LKL1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center space-x-2.5 bg-white border border-gray-200 hover:border-green-500 hover:shadow-xs p-2.5 rounded-xl transition cursor-pointer"
                    >
                      <img src="/whtsapp.jpeg" alt="WhatsApp" className="w-6 h-6 object-cover rounded-md" />
                      <span className="text-xs font-bold text-gray-700">WhatsApp</span>
                    </a>
                    <a
                      href="mailto:facilitefacile@gmail.com"
                      className="flex-1 flex items-center justify-center space-x-2.5 bg-white border border-gray-200 hover:border-blue-500 hover:shadow-xs p-2.5 rounded-xl transition cursor-pointer"
                    >
                      <img src="/email.png" alt="Email" className="w-6 h-6 object-contain" />
                      <span className="text-xs font-bold text-gray-700">Email</span>
                    </a>
                  </div>
                </div>

                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.modalLabelName}</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t.modalPlaceholderName}
                      className="w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-4 py-3 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all placeholder-[#9CA3AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.modalLabelEmail}</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t.modalPlaceholderEmail}
                      className="w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-4 py-3 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all placeholder-[#9CA3AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.modalLabelSubject}</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder={t.modalPlaceholderSubject}
                      className="w-full bg-gray-50 border border-[#E5E7EB] rounded-xl px-4 py-3 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all placeholder-[#9CA3AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.modalLabelMessage}</label>
                    <textarea
                      required
                      rows="4"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder={t.modalPlaceholderMessage}
                      className="w-full bg-gray-50 border border-[#E5E7EB] rounded-2xl px-4 py-3 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition-all placeholder-[#9CA3AF]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(16,230,136,0.3)] cursor-pointer"
                  >
                    {isSubmitting ? t.modalSending : t.modalSubmit}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-8 space-y-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 shadow-xs mx-auto">
                  <i className="fa-solid fa-circle-check text-3xl animate-bounce"></i>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-gray-900">{t.modalSuccessTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">{t.modalSuccessDesc}</p>
                </div>
                <button
                  onClick={handleCloseContactModal}
                  className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-extrabold py-3 px-6 rounded-xl text-sm transition cursor-pointer"
                >
                  {t.modalClose}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL RECRUTEMENT */}
      {recruitmentModalOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-fade-in-up"
          onClick={(e) => {
            if (e.target.id === "recruitment-modal-wrapper") handleCloseRecruitmentModal();
          }}
          id="recruitment-modal-wrapper"
        >
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-6 md:p-8 relative shadow-2xl transition-all duration-300 flex flex-col border border-gray-100">
            <button
              onClick={handleCloseRecruitmentModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            {!recruitmentFormSubmitted ? (
              <>
                <div className="mb-6">
                  <h3 className="text-2xl font-extrabold text-gray-900 mb-1">{t.recruitmentModalTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {t.recruitmentModalSubtitle}
                  </p>
                </div>

                <form onSubmit={handleRecruitmentSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.recruitmentLabelCV}</label>
                    <div 
                      onClick={() => triggerToast("CV Sélectionné !", "fa-file-pdf")}
                      className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-purple-400 transition cursor-pointer bg-gray-50"
                    >
                      <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
                      <p className="text-xs font-bold text-gray-700">{t.recruitmentUploadPlaceholder}</p>
                      <p className="text-[10px] text-gray-400 mt-1">PDF, DOCX jusqu'à 5 Mo</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">{t.recruitmentLabelCoverLetter}</label>
                    <textarea
                      rows="4"
                      value={recruitmentData.coverLetter}
                      onChange={(e) => setRecruitmentData({ ...recruitmentData, coverLetter: e.target.value })}
                      placeholder={t.recruitmentPlaceholderCoverLetter}
                      className="w-full bg-gray-50 border border-[#E5E7EB] rounded-2xl px-4 py-3 text-xs font-semibold text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all placeholder-[#9CA3AF]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isRecruitmentSubmitting}
                    className="w-full bg-[#E4B8F9] hover:bg-[#d8a4f0] text-purple-950 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(228,184,249,0.3)] cursor-pointer"
                  >
                    {isRecruitmentSubmitting ? t.recruitmentSending : t.recruitmentSubmit}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-8 space-y-6">
                <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center border border-purple-100 shadow-xs mx-auto">
                  <i className="fa-solid fa-circle-check text-3xl animate-bounce"></i>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-purple-900">{t.recruitmentSuccessTitle}</h3>
                  <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">{t.recruitmentSuccessDesc}</p>
                </div>
                <button
                  onClick={handleCloseRecruitmentModal}
                  className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-extrabold py-3 px-6 rounded-xl text-sm transition cursor-pointer"
                >
                  {t.modalClose}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal/Drawer de Notifications (LinkedIn Style) */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-[750] bg-black/50 backdrop-blur-xs flex justify-center md:items-start md:pt-16 p-2 sm:p-4 animate-fade-in-up">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
            {/* Header Modal Notifications */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-[#FAF6F1]">
              <div className="flex items-center space-x-3">
                <i className="fa-solid fa-bell text-xl text-[#10E688]"></i>
                <h3 className="text-lg font-extrabold text-gray-900">Notifications</h3>
                {unreadNotifCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {unreadNotifCount} nouvelle{unreadNotifCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadNotifCount > 0 && (
                  <button
                    onClick={() => {
                      setNotificationsList(prev => prev.map(n => ({ ...n, unread: false })));
                      setUnreadNotifCount(0);
                      triggerToast("Toutes les notifications sont marquées comme lues", "fa-check-double");
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition mr-2 cursor-pointer"
                  >
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => setNotificationsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            {/* Filter Pills Bar (LinkedIn Mobile Style as in Image 3) */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center space-x-2 overflow-x-auto bg-gray-50/70 scrollbar-none">
              <button
                onClick={() => setActiveNotifFilter("all")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "all" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setActiveNotifFilter("jobs")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "jobs" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Offres d'emploi
              </button>
              <button
                onClick={() => setActiveNotifFilter("posts")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "posts" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Mes posts
              </button>
              <button
                onClick={() => setActiveNotifFilter("mentions")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeNotifFilter === "mentions" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                Mentions
              </button>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium text-sm">
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (notif.unread) {
                        setNotificationsList(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                        setUnreadNotifCount(prev => Math.max(0, prev - 1));
                      }
                    }}
                    className={`p-4 flex items-start space-x-3.5 hover:bg-blue-50/50 transition cursor-pointer ${
                      notif.unread ? "bg-blue-50/30" : "bg-white"
                    }`}
                  >
                    {/* Blue Unread Indicator Dot (Image 3 Style) */}
                    <div className="pt-1.5 w-2 flex-shrink-0">
                      {notif.unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block"></span>
                      )}
                    </div>

                    {/* Sender Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-sm border border-gray-200 shadow-xs overflow-hidden">
                        {notif.avatar ? (
                          <img src={notif.avatar} alt={notif.author} className="w-full h-full object-cover" />
                        ) : (
                          notif.author.slice(0, 2).toUpperCase()
                        )}
                      </div>
                    </div>

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 font-normal leading-relaxed">
                        <span className="font-bold text-gray-900">{notif.author} </span>
                        {notif.text}
                      </p>
                      <span className="text-[10px] text-gray-400 font-medium mt-1 block">{notif.time}</span>
                    </div>

                    {/* Action Menu */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerToast("Options de notification", "fa-ellipsis");
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-ellipsis text-sm"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
