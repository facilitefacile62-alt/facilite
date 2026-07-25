/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
    filterFavorites: "Favoris"
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
    downloadFile: "Download"
  }
};

const initialConversations = [
  {
    id: 1,
    name: "Fatimata Diop",
    title: "Directrice des Ressources Humaines",
    company: "Orange Sénégal",
    avatarColor: "bg-orange-500",
    avatarInitials: "FD",
    logo: "/logo.jpeg",
    lastMessage: "Bonjour faciliter, votre CV nous intéresse beaucoup. Êtes-vous disponible pour un appel ?",
    time: "14:32",
    unreadCount: 1,
    online: true,
    favorite: true,
    messages: [
      { id: 101, sender: "them", text: "Bonjour ! Nous avons vu votre profil sur Facilite.", time: "14:28", status: "read" },
      { id: 102, sender: "me", text: "Bonjour Mme Diop, ravi de vous lire. Quel aspect de mon profil a retenu votre attention ?", time: "14:30", status: "read" },
      { id: 103, sender: "them", text: "Bonjour faciliter, votre CV nous intéresse beaucoup. Êtes-vous disponible pour un appel ?", time: "14:32", status: "delivered" }
    ],
    responsesFR: [
      "Merci pour votre message ! Je vais examiner vos disponibilités et je reviens vers vous rapidement pour planifier notre échange téléphonique.",
      "Parfait, noté. Je vous envoie une invitation Google Meet pour notre échange.",
      "N'hésitez pas à préparer vos questions sur nos opportunités chez Orange Sénégal."
    ],
    responsesEN: [
      "Thank you for your reply! I will check your availability and get back to you shortly to schedule our call.",
      "Perfect, noted. I'll send you a Google Meet invitation for our discussion.",
      "Feel free to prepare any questions you have about opportunities at Orange Senegal."
    ]
  },
  {
    id: 2,
    name: "Moussa Ndiaye",
    title: "Lead Front-end Developer",
    company: "Wave Mobile Money",
    avatarColor: "bg-emerald-500",
    avatarInitials: "MN",
    lastMessage: "Salut ! J'ai bien aimé votre projet. Pourriez-vous m'envoyer votre dépôt GitHub ?",
    time: "Hier",
    unreadCount: 1,
    online: true,
    favorite: false,
    messages: [
      { id: 201, sender: "them", text: "Salut ! J'ai vu tes réalisations de maquettes 1:1 Pixel Perfect.", time: "Hier", status: "read" },
      { id: 202, sender: "them", text: "Salut ! J'ai bien aimé votre projet. Pourriez-vous m'envoyer votre dépôt GitHub ?", time: "Hier", status: "delivered" }
    ],
    responsesFR: [
      "Super, merci pour le lien. Je regarde votre code et j'en parle à l'équipe technique.",
      "Impressionnant ! Votre maîtrise de Next.js et de Tailwind CSS correspond exactement à ce que nous recherchons.",
      "Êtes-vous disponible pour faire une démonstration technique de votre projet dans la semaine ?"
    ],
    responsesEN: [
      "Great, thanks for the link. I'll check your code and discuss it with the engineering team.",
      "Impressive! Your mastery of Next.js and Tailwind CSS matches exactly what we're looking for.",
      "Are you available for a technical demo of your project sometime this week?"
    ]
  },
  {
    id: 3,
    name: "Amadou Sow",
    title: "Directeur Général RH",
    company: "Senelec",
    avatarColor: "bg-blue-600",
    avatarInitials: "AS",
    lastMessage: "Bonjour, nous recherchons un comptable stagiaire à Pikine. Seriez-vous intéressé ?",
    time: "24 Juil.",
    unreadCount: 0,
    online: false,
    favorite: false,
    messages: [
      { id: 301, sender: "them", text: "Bonjour, nous recherchons un comptable stagiaire à Pikine. Seriez-vous intéressé ?", time: "24 Juil.", status: "read" }
    ],
    responsesFR: [
      "Merci de votre intérêt. Pouvez-vous me préciser vos dates de disponibilité pour ce stage ?",
      "Bien reçu. Notre service recrutement va analyser votre dossier complet.",
      "Merci pour ces précisions. Je transmets vos coordonnées au responsable de service comptabilité."
    ],
    responsesEN: [
      "Thank you for your interest. Could you please specify your availability dates for this internship?",
      "Well received. Our recruitment department will analyze your complete file.",
      "Thank you for these details. I will forward your contact information to the accounting department manager."
    ]
  },
  {
    id: 4,
    name: "Sarah Taylor",
    title: "Community Coach",
    company: "Facilite Corporation",
    avatarColor: "bg-purple-500",
    avatarInitials: "ST",
    lastMessage: "Welcome to Facilite! How can I help you build your resume today?",
    time: "20 Juil.",
    unreadCount: 0,
    online: true,
    favorite: true,
    messages: [
      { id: 401, sender: "them", text: "Welcome to Facilite! How can I help you build your resume today?", time: "20 Juil.", status: "read" }
    ],
    responsesFR: [
      "Excellent ! N'hésite pas si tu as besoin de conseils sur la structure ou la mise en page de ton CV.",
      "Tu peux aussi jeter un coup d'œil à nos modèles Premium, ils sont optimisés pour passer les filtres ATS des recruteurs.",
      "Des questions sur l'intégration de tes expériences ? Je suis là pour t'aider."
    ],
    responsesEN: [
      "Excellent! Don't hesitate if you need advice on the structure or layout of your resume.",
      "You can also check out our Premium templates, they are optimized to pass recruiters' ATS filters.",
      "Any questions about adding your experiences? I'm here to help."
    ]
  }
];

export default function MessageriePage() {
  const [selectedLang, setSelectedLang] = useState("FR");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
  const [activeConvId, setActiveConvId] = useState(1);
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

  // Esc closes modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (contactModalOpen) handleCloseContactModal();
        if (recruitmentModalOpen) handleCloseRecruitmentModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contactModalOpen, recruitmentModalOpen]);

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

  // Send Message Logic
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageText = messageText;
    
    // 1. Add user message to state
    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        const newMsg = {
          id: Date.now(),
          sender: "me",
          text: userMessageText,
          time: timestamp,
          status: "sent"
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
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const botTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        setConversations(prev => prev.map(c => {
          if (c.id === convId) {
            const newBotMsg = {
              id: Date.now() + 1,
              sender: "them",
              text: randomResponse,
              time: botTimestamp,
              status: "read"
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
          id: Date.now(),
          sender: "me",
          text: `${t.fileSent}${file.name}`,
          time: timestamp,
          file: {
            name: file.name,
            size: formattedSize,
            type: file.type
          },
          status: "sent"
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
              id: Date.now() + 2,
              sender: "them",
              text: fileResponse,
              time: botTimestamp,
              status: "read"
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
          
          {/* Groupe Gauche : Logo */}
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="flex items-center space-x-2.5 cursor-pointer hover:opacity-85 transition"
            >
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
            </Link>
          </div>

          {/* Groupe Centre : Liens principaux */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
            {/* Accueil */}
            <Link
              href="/"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-house text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navHome}</span>
            </Link>
            
            {/* Service */}
            <Link
              href="/service"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-briefcase text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navService}</span>
            </Link>

            {/* Messagerie - ACTIF */}
            <Link
              href="/messagerie"
              className="flex flex-col items-center justify-center text-center text-[#10E688] transition space-y-1 cursor-pointer w-16 relative"
            >
              <i className="fa-regular fa-comments text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">{t.navMessages}</span>
            </Link>

            {/* Recrutement Spontané */}
            <a
              href="#"
              onClick={handleOpenRecruitmentModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-solid fa-user-tie text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Recrutement</span>
            </a>

            {/* Contactez-nous */}
            <a
              href="#"
              onClick={handleOpenContactModal}
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-comment-dots text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight">Contact</span>
            </a>
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

            <Link
              href="/profil"
              className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 transition space-y-1 cursor-pointer w-16"
            >
              <i className="fa-regular fa-user text-xl"></i>
              <span className="text-[11px] font-bold tracking-tight truncate max-w-[76px]">Profil</span>
            </Link>
          </div>

          {/* Mobile Right Controls: Search & Hamburger (LinkedIn style icons in circles) */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => {
                triggerToast(selectedLang === "FR" ? "Recherche..." : "Search...", "fa-magnifying-glass");
              }}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Search"
            >
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-blue-600 shadow-xs focus:outline-none transition cursor-pointer"
              aria-label="Toggle Navigation"
            >
              <i className={`fa-solid ${mobileMenuOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
            </button>
          </div>
        </div>

        {/* Horizontal Tab Bar on Mobile (LinkedIn-style tabs right under the top header) */}
        <div className="flex md:hidden items-center justify-around w-full border-t border-gray-200/60 pt-2 mt-2 bg-[#FAF6F1]">
          {/* Accueil */}
          <a
            href="/"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navHome}</span>
          </a>

          {/* Service */}
          <Link
            href="/service"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-briefcase text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navService}</span>
          </Link>

          {/* Messagerie - ACTIF */}
          <Link
            href="/messagerie"
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-14 text-[#10E688] relative"
          >
            <i className="fa-regular fa-comments text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navMessages}</span>
          </Link>

          {/* Recrutement */}
          <a
            href="#"
            onClick={handleOpenRecruitmentModal}
            className="flex flex-col items-center justify-center text-center space-y-0.5 cursor-pointer w-16 text-gray-500 hover:text-gray-800"
          >
            <i className="fa-solid fa-user-tie text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight truncate max-w-[64px]">Recrutement</span>
          </a>

          {/* Contact */}
          <a
            href="#"
            onClick={handleOpenContactModal}
            className="flex flex-col items-center justify-center text-center text-gray-500 hover:text-gray-800 space-y-0.5 cursor-pointer w-14"
          >
            <i className="fa-regular fa-comment-dots text-lg"></i>
            <span className="text-[9px] font-bold tracking-tight">{t.navContact}</span>
          </a>
        </div>

        {/* Menu Déroulant Mobile */}
        <div
          className={`absolute top-full left-0 w-full bg-[#FAF6F1] shadow-xl flex-col py-4 px-4 space-y-3 md:hidden border-t border-gray-200/80 transition-all ${
            mobileMenuOpen ? "flex" : "hidden"
          }`}
        >
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <img src="/accueil.png" alt="Accueil" className="w-6 h-6 object-contain" />
            <span>{t.navHome}</span>
          </Link>

          <Link
            href="/service"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-briefcase text-lg w-6 text-gray-500"></i>
            <span>{t.navService}</span>
          </Link>

          <Link
            href="/messagerie"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-[#10E688] font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-regular fa-comments text-lg w-6 text-[#10E688]"></i>
            <span>{t.navMessages}</span>
          </Link>

          <a
            href="#"
            onClick={handleOpenRecruitmentModal}
            className="flex items-center space-x-3 text-gray-800 hover:text-purple-600 transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-user-tie text-lg w-6 text-gray-500"></i>
            <span>{t.navRecruitment}</span>
          </a>

          <a
            href="#"
            onClick={handleOpenContactModal}
            className="flex items-center space-x-3 text-gray-800 hover:text-blue-600 transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-regular fa-comment-dots text-lg w-6 text-gray-500"></i>
            <span>{t.navContact}</span>
          </a>

          <Link
            href="/profil"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 text-gray-800 hover:text-[#10E688] transition font-bold p-2.5 rounded-xl hover:bg-white/60"
          >
            <i className="fa-solid fa-circle-user text-lg w-6 text-gray-500"></i>
            <span>Profil</span>
          </Link>

          {/* Sélecteur de Langue Mobile */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200/80 px-2 mt-1">
            <span className="text-xs font-bold text-gray-600 flex items-center space-x-1.5">
              <i className="fa-solid fa-globe text-gray-400"></i>
              <span>Langue</span>
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleLangChange("FR")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                  selectedLang === "FR" ? "bg-[#10E688] text-gray-900 shadow-xs" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                <img src="/francais.avif" alt="FR" className="w-4 h-4 rounded-full object-cover" />
                <span>FR</span>
              </button>
              <button
                onClick={() => handleLangChange("GB")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                  selectedLang === "GB" ? "bg-[#E4B8F9] text-purple-950 shadow-xs" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                <img src="/anglais.jpeg" alt="GB" className="w-4 h-4 rounded-full object-cover" />
                <span>EN</span>
              </button>
            </div>
          </div>
        </div>
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
              {filteredConversations.length > 0 ? (
                filteredConversations.map(conv => (
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
                <div className="p-8 text-center text-sm text-gray-500 font-medium">
                  {t.searchNoResults}
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
                <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-xs">
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
                        <span className="hidden sm:inline-block text-[10px] font-extrabold text-white bg-gray-900 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          {t.recruiterTitle}
                        </span>
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
                    <button
                      onClick={() => triggerToast(`Appel simulé vers ${activeConversation.name}...`, "fa-phone")}
                      className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                    >
                      <i className="fa-solid fa-phone"></i>
                    </button>
                    <button
                      onClick={() => triggerToast("Discussion épinglée", "fa-thumbtack")}
                      className="text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer"
                    >
                      <i className="fa-solid fa-thumbtack"></i>
                    </button>
                  </div>
                </div>

                {/* Messages scrollarea */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {activeConversation.messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"} items-end space-x-1.5`}
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
                        }`}
                      >
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

                  {isTyping && (
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
    </>
  );
}
