"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";

export default function AIAssistantModal() {
  // Ne rend rien côté serveur : ce widget est monté globalement dans le layout
  // racine (donc présent sur 100% des pages) et purement décoratif tant qu'il
  // n'est pas ouvert. Le gater derrière un montage client élimine toute
  // divergence serveur/client pour ce sous-arbre — y compris celles causées
  // par des extensions navigateur (gestionnaires de mots de passe, Grammarly,
  // bloqueurs de pub…) qui injectent du DOM avant l'hydratation de React.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [input, setInput] = useState("");
  const [activeAiRole, setActiveAiRole] = useState("cv");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const welcomeMessage = useMemo(() => ({
    id: "welcome",
    role: "assistant",
    content: "Bonjour ! Je suis votre assistant Facilité. Comment puis-je vous aider aujourd'hui à concevoir votre CV, rédiger votre lettre de motivation ou optimiser votre profil professionnel ?",
    timestamp: "12:00"
  }), []);

  const [messages, setMessages] = useState([welcomeMessage]);

  // Défilement automatique vers le bas lors de la réception de messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Fermer le menu popover lors d'un clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      let fileToProcess = file;

      if (file.type.startsWith("image/")) {
        try {
          const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1200,
            useWebWorker: true
          };
          console.log(`[Assistant UI] Compressing image: ${file.name}`);
          fileToProcess = await imageCompression(file, options);
          console.log(`[Assistant UI] Compressed size: ${(fileToProcess.size / 1024).toFixed(2)} KB`);
        } catch (compErr) {
          console.error("[Assistant UI] Compression error:", compErr);
        }
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        const isImage = file.type.startsWith("image/");

        setAttachments((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: isImage ? "image" : "document",
            mimeType: file.type,
            data: base64Data
          }
        ]);
      };
      reader.readAsDataURL(fileToProcess);
    }

    e.target.value = "";
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!(input || "").trim() && attachments.length === 0) || isLoading) return;

    setErrorMsg("");
    const texte = input.trim() || "Analyse les documents ci-joints.";
    setInput("");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: texte,
      timestamp
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: texte,
          activeAiRole: activeAiRole,
          attachments: attachments
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur API (${response.status})`);
      }

      const resData = await response.json();
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: resData.reply || "Désolé, je n'ai pas pu générer de réponse.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, botMsg]);
      setAttachments([]);
    } catch (err) {
      console.error("Erreur AIAssistantModal POST /api/ai-chat:", err);
      setErrorMsg(err.message || "Une erreur est survenue lors de la communication avec l'assistant.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConversation = () => {
    if (window.confirm("Voulez-vous réinitialiser votre conversation avec l'assistant ?")) {
      setMessages([welcomeMessage]);
      setAttachments([]);
      setErrorMsg("");
      setInput("");
    }
  };

  if (!mounted) return null;

  return (
    <div suppressHydrationWarning>
      {/* 1. Bouton Flottant (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none"
        aria-label="Assistant IA"
      >
        {isOpen ? (
          <i className="fa-solid fa-xmark text-2xl transition-transform duration-300 rotate-90"></i>
        ) : (
          <div className="relative">
            <i className="fa-solid fa-comment-dots text-2xl transition-transform duration-300 group-hover:scale-110"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border border-white animate-pulse"></span>
          </div>
        )}
      </button>

      {/* 2. Chat Modal Window */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[550px] bg-white border border-neutral-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-75 opacity-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-[#FAF6F1] px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
              <i className="fa-solid fa-robot text-sm"></i>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse"></span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-800 text-sm">Assistant Facilité</h3>
              <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                <i className="fa-solid fa-circle text-[6px] text-emerald-400"></i> En ligne • IA active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetConversation}
              className="w-8 h-8 rounded-full hover:bg-neutral-200/50 flex items-center justify-center text-neutral-600 transition-colors focus:outline-none"
              title="Réinitialiser la conversation"
            >
              <i className="fa-solid fa-rotate-left text-xs"></i>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-neutral-200/50 flex items-center justify-center text-neutral-600 transition-colors focus:outline-none"
              title="Fermer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-50 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-[#FAF6F1] text-neutral-800 border border-neutral-100 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[9px] text-neutral-400 mt-1 px-1">
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex flex-col mr-auto items-start max-w-[80%]">
              <div className="px-4 py-2.5 bg-[#FAF6F1] text-neutral-800 border border-neutral-100 rounded-2xl rounded-bl-none text-sm shadow-sm flex items-center gap-2">
                <div className="flex gap-1.5 items-center justify-center h-4">
                  <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
                <span className="text-neutral-500 text-xs italic">L'assistant réfléchit...</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="mx-auto w-full max-w-[90%] px-4 py-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-100 flex flex-wrap gap-2 items-center">
            {attachments.map((att) => {
              let iconClass = "fa-file text-neutral-400";
              if (att.type === "image") iconClass = "fa-file-image text-emerald-500";
              else if (att.name.endsWith(".pdf")) iconClass = "fa-file-pdf text-rose-500";
              else if (att.name.endsWith(".doc") || att.name.endsWith(".docx")) iconClass = "fa-file-word text-blue-500";

              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 bg-white border border-neutral-200 px-3 py-1.5 rounded-xl shadow-sm text-xs text-neutral-700 font-medium"
                >
                  <i className={`fa-solid ${iconClass} text-sm`}></i>
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="w-4 h-4 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none ml-1"
                  >
                    <i className="fa-solid fa-xmark text-[10px]"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-neutral-100">
          <div className="flex items-center gap-2">
            {/* Menu Popover Container */}
            <div className="relative" ref={menuRef}>
              {showMenu && (
                <div
                  onClick={() => {
                    setShowMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="absolute bottom-full left-0 mb-3 z-50 bg-[#1E1E1E] hover:bg-neutral-800 text-white py-2.5 px-4 rounded-xl shadow-2xl flex items-center gap-2.5 cursor-pointer whitespace-nowrap text-xs transition-colors border border-neutral-800 animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <i className="fa-solid fa-paperclip text-sm text-neutral-400"></i>
                  <span className="font-medium">Importer des fichiers</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                disabled={isLoading}
                className="w-10 h-10 rounded-xl hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition-colors focus:outline-none disabled:opacity-50 border border-neutral-200"
                title="Ajouter un fichier"
              >
                <i className="fa-solid fa-plus text-base"></i>
              </button>
            </div>
            
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.webp"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question ou joignez un fichier..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-neutral-100 focus:bg-neutral-50 border border-transparent focus:border-blue-500 focus:outline-none rounded-xl text-sm transition-all placeholder-neutral-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || (!(input || "").trim() && attachments.length === 0)}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg transition-colors focus:outline-none disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed"
            >
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
          <p className="text-[9px] text-neutral-400 text-center mt-2">
            L'assistant IA peut faire des erreurs. Relisez vos informations.
          </p>
        </form>
      </div>
    </div>
  );
}
