"use client";

import React, { useState, useEffect, useRef } from "react";

export default function AIAssistantModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialisation de la conversation avec un message de bienvenue
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Bonjour ! Je suis votre assistant Facilité. Comment puis-je vous aider aujourd'hui à concevoir votre CV, rédiger votre lettre de motivation ou optimiser votre profil professionnel ?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [messages.length]);

  // Défilement automatique vers le bas lors de la réception de messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach((file) => {
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
      reader.readAsDataURL(file);
    });

    // Réinitialiser le champ input
    e.target.value = "";
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    const userMessageText = inputValue.trim();
    const currentAttachments = [...attachments];
    
    // Réinitialiser les champs de saisie immédiatement pour la réactivité
    setInputValue("");
    setAttachments([]);
    setErrorMsg("");

    // Construire le contenu du message à afficher dans l'interface
    let displayContent = userMessageText;
    if (currentAttachments.length > 0) {
      const fileNames = currentAttachments.map(f => f.name).join(", ");
      displayContent = userMessageText 
        ? `${userMessageText} (Fichiers joints : ${fileNames})`
        : `[Fichiers joints : ${fileNames}]`;
    }

    // 1. Ajouter le message utilisateur à l'interface
    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: displayContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Préparer l'historique épuré pour l'API backend (on envoie le texte réel saisi par l'utilisateur)
      const apiMessages = updatedMessages.map((msg, idx) => {
        // Pour le dernier message utilisateur, on renvoie uniquement son contenu textuel brut
        // Le serveur recevra les attachements séparément pour les traiter
        if (idx === updatedMessages.length - 1) {
          return {
            role: "user",
            content: userMessageText || "Analyse les documents ci-joints."
          };
        }
        return {
          role: msg.role,
          content: msg.content
        };
      });

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          messages: apiMessages, 
          attachments: currentAttachments 
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la récupération de la réponse.");
      }

      // 2. Ajouter la réponse de l'assistant
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Erreur assistant IA :", err);
      setErrorMsg("Une erreur est survenue lors de l'analyse ou de l'envoi.");
      
      // Restaurer les fichiers en cas d'erreur
      setAttachments(currentAttachments);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConversation = () => {
    if (window.confirm("Voulez-vous réinitialiser votre conversation avec l'assistant ?")) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "Bonjour ! Je suis votre assistant Facilité. Comment puis-je vous aider aujourd'hui à concevoir votre CV, rédiger votre lettre de motivation ou optimiser votre profil professionnel ?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setAttachments([]);
      setErrorMsg("");
    }
  };

  return (
    <>
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
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group flex items-center bg-white border border-neutral-200 p-1 rounded-xl shadow-sm"
              >
                {att.type === "image" ? (
                  <img
                    src={att.data}
                    alt={att.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-600 font-medium">
                    <i className={`fa-solid ${att.name.endsWith('.pdf') ? 'fa-file-pdf text-red-500' : 'fa-file-word text-blue-500'} text-sm`}></i>
                    <span className="max-w-[100px] truncate">{att.name}</span>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-rose-600 transition-colors focus:outline-none"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-10 h-10 rounded-xl hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition-colors focus:outline-none disabled:opacity-50 border border-neutral-200"
              title="Ajouter un fichier (Image, PDF, Word)"
            >
              <i className="fa-solid fa-plus text-base"></i>
            </button>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Posez votre question ou joignez un fichier..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-neutral-100 focus:bg-neutral-50 border border-transparent focus:border-blue-500 focus:outline-none rounded-xl text-sm transition-all placeholder-neutral-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}
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
    </>
  );
}
