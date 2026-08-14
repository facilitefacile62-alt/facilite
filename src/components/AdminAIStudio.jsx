"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Modèles IA supportés
const AI_MODELS = [
  { id: "deepseek-chat", name: "DeepSeek V3", tag: "Recommandé • Ultra-Rapide", cost: "⚡ Rapide", badge: "best" },
  { id: "gemini-flash-latest", name: "Gemini 2.5 Flash", tag: "Vision & Documents", cost: "⚡ Vision", badge: "vision" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", tag: "Raisonnement structuré", cost: "⚡ Précis", badge: "groq" },
];

// Styles de communication
const COMMUNICATION_STYLES = [
  {
    id: "normal",
    label: "Normal",
    desc: "Ton équilibré, bienveillant et naturel",
    modifier: "Adopte un ton naturel, chaleureux, bienveillant et professionnel.",
  },
  {
    id: "concis",
    label: "Concis",
    desc: "Réponses courtes, directes et percutantes",
    modifier: "Sois direct et ultra-synthétique. Limite tes réponses à 2-4 phrases ou points clés sans bavardage.",
  },
  {
    id: "explicatif",
    label: "Explicatif",
    desc: "Réponses détaillées, pédagogiques et structurées",
    modifier: "Donne des explications complètes et pédagogiques, étape par étape, avec des exemples concrets.",
  },
  {
    id: "commercial",
    label: "Commercial & Conversion",
    desc: "Persuasif, orienté vers la commande et l'action",
    modifier: "Mets en valeur la qualité des maquettes Canva de Facilité et invite poliment le client à valider sa commande de CV ou lettre.",
  },
];

// Catalogue des Produits & Services Facilité
const DEFAULT_PRODUCTS = [
  { id: "cv_pro", name: "Modèle CV Professionnel Standard", priceFCFA: 1000, priceEUR: 1.5, desc: "Format Sénégal/Afrique de l'Ouest, conforme ATS" },
  { id: "cv_en", name: "CV Version Anglaise (Resume)", priceFCFA: 2500, priceEUR: 3.8, desc: "Traduction & adaptation aux standards internationaux" },
  { id: "cv_ca", name: "CV Format Canadien", priceFCFA: 2500, priceEUR: 3.8, desc: "Normes strictes immigration & entreprises canadiennes" },
  { id: "lettre", name: "Lettre de Motivation Personnalisée", priceFCFA: 1500, priceEUR: 2.3, desc: "Accroche percutante et alignée au poste ciblé" },
  { id: "pack_vip", name: "Pack VIP (CV + Lettre + Coaching)", priceFCFA: 4500, priceEUR: 6.9, desc: "Accompagnement complet jusqu'à l'embauche" },
];

// Base de connaissances par défaut
const DEFAULT_KNOWLEDGE = `• Entreprise : Facilité (https://ffacilite.com/)
• Fondateur : Macoumba Samake
• Mission : Aider les candidats et professionnels au Sénégal et en Afrique à réussir leur insertion professionnelle grâce à des CVs ATS d'élite, du coaching et des opportunités d'emploi réelles.
• Moyens de Paiement supportés : Wave, Orange Money, Carte Bancaire, Kpay.
• Processus de commande : L'utilisateur fournit ses informations ➔ l'équipe prépare la maquette Canva ➔ validation par le client ➔ livraison finale en PDF haute définition en 15 min à 2h.
• Dépôts Physiques : Possibilité de déposer des dossiers dans les stations-services et entreprises partenaires répertoriées sur la plateforme.
• Contact Support WhatsApp : Disponible via la plateforme pour toute assistance personnalisée.`;

// Règles officielles de Diagnostic CV & ATS
const DEFAULT_DIAGNOSTIC_RULES = `• CRITÈRES D'ÉVALUATION D'UN BON CV (DIAGNOSTIC FACILITÉ) :

1. EN-TÊTE & COORDONNÉES PROFESSIONNELLES :
   - Présence obligatoire : Nom et Prénom, Numéro de téléphone fonctionnel (WhatsApp), Adresse email pro, Ville/Localité au Sénégal ou pays cible.
   - Titre de poste précis et percutant en tête de CV (ex: "Comptable Général Junior", "Développeur Fullstack React").
   - Accroche professionnelle percutante (3 à 4 lignes résumant la valeur ajoutée et les objectifs).

2. EXPÉRIENCES PROFESSIONNELLES (MÉTHODE STAR) :
   - Ordre chronologique inversé (du plus récent au plus ancien).
   - Chaque poste doit préciser : Entreprise, Période (Mois/Année), Missions avec verbes d'action.
   - Résultats chiffrés & indicateurs de performance (KPI) obligatoires (ex: "+20% de chiffre d'affaires", "Gestion d'une équipe de 5 personnes", "Réduction du temps de traitement de 30%").

3. COMPATIBILITÉ ATS (Applicant Tracking Systems) :
   - Structure claire en sections standards (Expériences, Formations, Compétences, Langues).
   - Mots-clés pertinents en lien avec le métier cible.
   - Éviter les tableaux complexes et graphiques illisibles par les robots recruteurs.

4. FORMATION, COMPÉTENCES & LANGUES :
   - Diplômes récents et vérifiables (CFEE, BFEM, BAC, Licence, Master, Certifications).
   - Séparation entre Compétences Techniques (Hard Skills) et Qualités Humaines (Soft Skills).
   - Niveau de langue clair (Français, Wolof, Anglais).

5. BARÈME DU SCORE ATS :
   - 85-100% : Excellent CV, directement exploitable pour postuler.
   - 65-84% : Bon CV avec quelques ajustements de formulation ou de mise en page requis.
   - 40-64% : CV Moyen, refonte fortement recommandée avec les modèles Facilité à 1000/2500 FCFA.
   - < 40% : CV Insuffisant, refonte intégrale et accompagnement prioritaires nécessaires.`;

const DIAGNOSTIC_PRESETS = [
  {
    name: "Standard Marché Sénégal & UEMOA",
    modifier: "Mets l'accent sur les réalités du marché local à Dakar et en Afrique de l'Ouest (diplômes reconnus, coordonnées directes, adaptabilité aux entreprises locales et multinationales).",
  },
  {
    name: "Exigence ATS International & Canada",
    modifier: "Applique une rigueur maximale sur la norme ATS nord-américaine (aucune photo, pas d'âge ni situation matrimoniale, verbes d'action stricts, résultats 100% mesurables).",
  },
  {
    name: "Profil Débutant, Stage & Reconversion",
    modifier: "Valorise les projets académiques, stages, compétences transférables, bénévolat et la motivation du candidat plutôt que l'ancienneté.",
  },
];

const DEFAULT_MAIN_PROMPT = `Tu es l'agent IA officiel de "Facilité" (https://ffacilite.com/), fondé par Macoumba Samake.
Ton rôle est d'accueillir les visiteurs, les guider dans la création de leur CV ou lettre de motivation, répondre à leurs questions d'emploi et collecter leurs informations.

Directives fondamentales :
1. Tu es trilingue : réponds en Français, en Wolof ou en Anglais selon la langue de l'utilisateur.
2. Pose des questions ciblées pour recueillir les données du candidat (nom complet, poste visé, niveau d'études, expériences clés).
3. Une fois toutes les informations nécessaires collectées, résume proprement les données du client.
4. Termine en informant le client que ses données sont transmises pour la préparation de sa maquette Canva et qu'un Responsable va prendre le relais pour la validation finale et le paiement.
5. Sois toujours courtois, encourageant et dynamique.`;

export default function AdminAIStudio() {
  // Navigation interne du studio (inspirée de la référence)
  const [activeSubTab, setActiveSubTab] = useState("prompt"); // "prompt" | "knowledge" | "products" | "connections" | "tools"
  
  // Paramètres de configuration
  const [selectedModel, setSelectedModel] = useState("deepseek-chat");
  const [commStyle, setCommStyle] = useState("normal");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [promptText, setPromptText] = useState(DEFAULT_MAIN_PROMPT);
  const [knowledgeText, setKnowledgeText] = useState(DEFAULT_KNOWLEDGE);
  const [diagnosticRulesText, setDiagnosticRulesText] = useState(DEFAULT_DIAGNOSTIC_RULES);
  const [productsList, setProductsList] = useState(DEFAULT_PRODUCTS);
  const [currency, setCurrency] = useState("FCFA"); // "FCFA" | "EUR"
  const [isDeployed, setIsDeployed] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  // État du Bac à sable (Playground)
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null); // { name, type, mimeType, size, data }
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastElapsedMs, setLastElapsedMs] = useState(null);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // État du Testeur de Diagnostic CV en direct
  const [diagTestFile, setDiagTestFile] = useState(null); // { name, type, mimeType, size, data }
  const [diagIsAnalyzing, setDiagIsAnalyzing] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [diagError, setDiagError] = useState(null);
  const diagFileInputRef = useRef(null);
  const diagPhotoInputRef = useRef(null);

  // Calcul du score de prompt en direct (sur 10)
  const promptScore = (() => {
    let score = 5.0;
    const lower = promptText.toLowerCase();
    if (lower.includes("facilité") || lower.includes("samake")) score += 1.0;
    if (lower.includes("wolof") || lower.includes("trilingue") || lower.includes("anglais")) score += 1.0;
    if (lower.includes("canva") || lower.includes("maquette") || lower.includes("cv")) score += 1.0;
    if (lower.includes("résume") || lower.includes("collecte") || lower.includes("information")) score += 1.0;
    if (promptText.length > 300) score += 0.8;
    if (promptText.length > 600) score += 0.2;
    return Math.min(10, score).toFixed(1);
  })();

  // Chargement des données persistées (Paramètres, Sous-onglet actif et Historique du Playground)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("FACILITE_AI_STUDIO_V2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.promptText) setPromptText(parsed.promptText);
        if (parsed.knowledgeText) setKnowledgeText(parsed.knowledgeText);
        if (parsed.diagnosticRulesText) setDiagnosticRulesText(parsed.diagnosticRulesText);
        if (parsed.commStyle) setCommStyle(parsed.commStyle);
        if (parsed.selectedModel) setSelectedModel(parsed.selectedModel);
        if (parsed.productsList) setProductsList(parsed.productsList);
      }

      const savedSubTab = localStorage.getItem("FACILITE_AI_STUDIO_ACTIVE_SUBTAB");
      if (savedSubTab) setActiveSubTab(savedSubTab);

      const savedHistory = localStorage.getItem("FACILITE_AI_STUDIO_CHAT_HISTORY");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setChatMessages(parsedHistory);
        }
      }
    } catch {}
  }, []);

  // Changement de sous-onglet avec persistance
  const handleSubTabChange = (subTabId) => {
    setActiveSubTab(subTabId);
    try {
      localStorage.setItem("FACILITE_AI_STUDIO_ACTIVE_SUBTAB", subTabId);
    } catch {}
  };

  // Persistance de l'historique des discussions du playground
  useEffect(() => {
    try {
      if (chatMessages && chatMessages.length > 0) {
        localStorage.setItem("FACILITE_AI_STUDIO_CHAT_HISTORY", JSON.stringify(chatMessages));
      }
    } catch {}
  }, [chatMessages]);

  // Défilement automatique dans le playground
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isGenerating]);

  // Sauvegarde des réglages
  const handleSaveConfig = () => {
    try {
      const config = {
        promptText,
        knowledgeText,
        diagnosticRulesText,
        commStyle,
        selectedModel,
        productsList,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("FACILITE_AI_STUDIO_V2", JSON.stringify(config));
      localStorage.setItem("FACILITE_DIAGNOSTIC_RULES", diagnosticRulesText);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (e) {
      console.error("Erreur sauvegarde studio IA:", e);
    }
  };

  // Gestion du fichier de test de diagnostic CV
  const handleDiagFileChange = (e, forcedType = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const isImage = file.type.startsWith("image/") || forcedType === "image";
      setDiagTestFile({
        name: file.name,
        type: isImage ? "image" : "document",
        mimeType: file.type || (isImage ? "image/jpeg" : "application/pdf"),
        size: file.size,
        data: dataUrl,
      });
      setDiagResult(null);
      setDiagError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Exécution du test de diagnostic avec les règles configurées
  const handleRunDiagnosticTest = async () => {
    if (!diagTestFile || diagIsAnalyzing) return;
    setDiagIsAnalyzing(true);
    setDiagError(null);
    setDiagResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/diagnostic-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData: diagTestFile.data,
          fileName: diagTestFile.name,
          mimeType: diagTestFile.mimeType,
          customRules: diagnosticRulesText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erreur lors du diagnostic (${res.status})`);
      }
      setDiagResult(data.result);
    } catch (err) {
      console.error("Erreur test diagnostic:", err);
      setDiagError(err.message || "Échec de l'analyse du CV.");
    } finally {
      setDiagIsAnalyzing(false);
    }
  };

  // Gestion de la sélection de fichier (document ou photo)
  const handleFileChange = (e, forcedType = null) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const isImage = file.type.startsWith("image/") || forcedType === "image";
      setSelectedAttachment({
        name: file.name,
        type: isImage ? "image" : "document",
        mimeType: file.type || (isImage ? "image/jpeg" : "application/pdf"),
        size: file.size,
        data: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Envoi d'un message de test dans le Playground
  const handleSendTestMessage = async (overrideText = null) => {
    const textToSend = overrideText || inputText.trim();
    if ((!textToSend && !selectedAttachment) || isGenerating) return;

    const currentAttachment = selectedAttachment;
    setSelectedAttachment(null);

    const userMsg = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend || (currentAttachment ? `[Fichier joint : ${currentAttachment.name}]` : ""),
      attachment: currentAttachment,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setInputText("");
    setIsGenerating(true);

    const startTime = Date.now();

    // Construction du System Prompt complet enrichi avec le style et la base de connaissances
    const activeStyleObj = COMMUNICATION_STYLES.find((s) => s.id === commStyle) || COMMUNICATION_STYLES[0];
    const productsContext = productsList
      .map((p) => `• ${p.name} : ${currency === "FCFA" ? `${p.priceFCFA} FCFA` : `${p.priceEUR} €`} (${p.desc})`)
      .join("\n");

    const fullSystemPrompt = `
${promptText.trim()}

[STYLE DE COMMUNICATION OBLIGATOIRE]
${activeStyleObj.modifier}

[BASE DE CONNAISSANCES OFFICIELLE & TARIFS EN VIGUEUR]
${knowledgeText.trim()}

[RÈGLES ET CRITÈRES OFFICIELS DU DIAGNOSTIC CV & SCORING ATS]
${diagnosticRulesText.trim()}

[CATALOGUE DES PRODUITS ET TARIFS (${currency})]
${productsContext}
`.trim();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          customSystemPrompt: fullSystemPrompt,
          temperature: commStyle === "concis" ? 0.3 : commStyle === "commercial" ? 0.8 : 0.7,
          attachments: currentAttachment
            ? [
                {
                  type: currentAttachment.type,
                  name: currentAttachment.name,
                  mimeType: currentAttachment.mimeType,
                  data: currentAttachment.data,
                },
              ]
            : undefined,
        }),
      });

      const data = await res.json();
      const elapsedMs = Date.now() - startTime;
      setLastElapsedMs(elapsedMs);

      if (!res.ok) {
        throw new Error(data.error || `Erreur serveur (${res.status})`);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: data.reply || data.content || "Je n'ai pas pu formuler de réponse.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          elapsedMs,
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Erreur d'exécution :** ${err.message || "Erreur de connexion avec l'IA."}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isError: true,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Réinitialisation de la conversation
  const handleResetChat = () => {
    setChatMessages([]);
    setInputText("");
    setSelectedAttachment(null);
    try {
      localStorage.removeItem("FACILITE_AI_STUDIO_CHAT_HISTORY");
    } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-in-up font-sans text-gray-100">
      
      {/* HEADER & SUB-NAV FIXES DE L'AGENT IA */}
      <div className="sticky top-[138px] sm:top-[128px] z-20 space-y-2.5 bg-[#FAF6F1]/95 backdrop-blur-md pt-1 pb-2.5">
        {/* 1. TOP BAR NOIRE DU STUDIO (Style Référence) */}
        <div className="bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          
          {/* Titre Agent + Bouton Déployer */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-[#10E688] text-gray-950 flex items-center justify-center font-black text-xl shadow-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">Agent IA Facilité</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isDeployed ? "En ligne" : "Brouillon"}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Studio d'entraînement & supervision de l'assistant</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsDeployed(!isDeployed);
                handleSaveConfig();
              }}
              className="ml-2 px-3.5 py-1.5 bg-[#10E688] hover:bg-[#10E688]/90 text-gray-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-rocket text-xs"></i>
              <span>{isDeployed ? "Déployé" : "Déployer"}</span>
            </button>
          </div>

          {/* Badge Milieu : Assistant IA Actif */}
          <div className="hidden md:flex items-center space-x-2 bg-[#222730] border border-[#333A48] px-3.5 py-1.5 rounded-full text-xs font-bold text-gray-200">
            <span>Assistant IA</span>
            <span className="bg-[#10E688] text-gray-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">v2</span>
            <span className="w-2 h-2 rounded-full bg-[#10E688] animate-ping"></span>
          </div>

          {/* Solde & Jetons (Top Right) */}
          <div className="flex items-center space-x-3">
            <div className="bg-[#222730] border border-[#333A48] px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-400">
              <i className="fa-solid fa-bolt text-amber-400"></i>
              <span>100% Opérationnel</span>
            </div>

            <button
              type="button"
              onClick={handleSaveConfig}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-md flex items-center gap-2 cursor-pointer ${
                savedToast
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
              }`}
            >
              <i className={`fa-solid ${savedToast ? "fa-circle-check" : "fa-floppy-disk"}`}></i>
              <span>{savedToast ? "Enregistré !" : "Enregistrer"}</span>
            </button>
          </div>
        </div>

        {/* 2. BARRE D'ONGLETS DU STUDIO (Sub-nav avec persistance) */}
        <div className="flex items-center space-x-2 bg-[#181B20] border border-[#2A2F3A] p-1.5 rounded-2xl overflow-x-auto scrollbar-none shadow-md">
          <button
            type="button"
            onClick={() => handleSubTabChange("prompt")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "prompt"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-sliders text-emerald-400"></i>
            <span>Prompt & Directives</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("knowledge")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "knowledge"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-book-bookmark text-blue-400"></i>
            <span>Base de connaissances</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("diagnostic")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "diagnostic"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-stethoscope text-emerald-400"></i>
            <span>Règles Diagnostic CV</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("products")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "products"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-boxes-stacked text-purple-400"></i>
            <span>Produits & Tarifs</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("connections")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "connections"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-brands fa-whatsapp text-green-400"></i>
            <span>Connexions (WhatsApp / Web)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("tools")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "tools"
                ? "bg-[#2A303C] text-white shadow-sm border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-screwdriver-wrench text-amber-400"></i>
            <span>Outils & Relais Humain</span>
          </button>
        </div>
      </div>

      {/* 3. GRILLE PRINCIPALE (CONFIGURATION À GAUCHE | PLAYGROUND À DROITE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ================= COLONNE GAUCHE (7/12) : FORMATION & CONFIGURATION ================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* ONGLET 1 : PROMPT & CONFIGURATION */}
          {activeSubTab === "prompt" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Configuration du prompt</h2>
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-gray-400 font-bold">Prompt score</span>
                  <span className="bg-[#222730] border border-amber-500/40 text-amber-400 font-black px-2 py-0.5 rounded-lg">
                    {promptScore} <span className="text-[10px] text-gray-400 font-normal">/ 10</span>
                  </span>
                </div>
              </div>

              {/* Sélecteur Modèle d'IA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Modèle d'IA :</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {AI_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#252B35] border-[#10E688] ring-1 ring-[#10E688]/30 shadow-md"
                            : "bg-[#1F232B] border-[#2E3542] hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">{model.name}</span>
                          <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded">
                            {model.cost}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{model.tag}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style de communication (Menu déroulant comme dans la capture) */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-gray-300">Style de communication :</label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
                    className="w-full p-3 bg-[#1F232B] border border-[#2E3542] hover:border-gray-500 rounded-2xl text-left flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-extrabold text-white">
                        {COMMUNICATION_STYLES.find((s) => s.id === commStyle)?.label}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {COMMUNICATION_STYLES.find((s) => s.id === commStyle)?.desc}
                      </div>
                    </div>
                    <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform ${styleDropdownOpen ? "rotate-180" : ""}`}></i>
                  </button>

                  {styleDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1F232B] border border-[#333A48] rounded-2xl shadow-2xl z-30 p-1.5 space-y-1">
                      {COMMUNICATION_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => {
                            setCommStyle(style.id);
                            setStyleDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left text-xs transition flex items-center justify-between cursor-pointer ${
                            commStyle === style.id ? "bg-[#2A303C] text-emerald-400 font-bold" : "hover:bg-[#252B35] text-gray-300"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{style.label}</div>
                            <div className="text-[10px] text-gray-400">{style.desc}</div>
                          </div>
                          {commStyle === style.id && <i className="fa-solid fa-check text-emerald-400"></i>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Zone d'écriture du Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-gray-300">Instructions du prompt système :</label>
                  <span className="text-[11px] text-gray-500 font-mono">{promptText.length} caractères</span>
                </div>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={10}
                  className="w-full p-4 bg-[#14161A] border border-[#2E3542] focus:border-[#10E688] focus:ring-1 focus:ring-[#10E688]/30 rounded-2xl text-xs font-mono text-gray-200 leading-relaxed transition resize-y focus:outline-none"
                  placeholder="Écrivez vos instructions personnalisées ici..."
                />
              </div>

              {/* Bouton Enregistrer au bas de la section */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 bg-[#10E688] hover:bg-[#10E688]/90 text-gray-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Enregistrer</span>
                  <i className="fa-solid fa-floppy-disk"></i>
                </button>
              </div>

            </div>
          )}

          {/* ONGLET 2 : BASE DE CONNAISSANCES */}
          {activeSubTab === "knowledge" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="border-b border-[#2A2F3A] pb-3">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Base de connaissances métier</h2>
                <p className="text-xs text-gray-400">Règles d'entreprise, FAQ, coordonnées et faits officiels</p>
              </div>

              <textarea
                value={knowledgeText}
                onChange={(e) => setKnowledgeText(e.target.value)}
                rows={12}
                className="w-full p-4 bg-[#14161A] border border-[#2E3542] focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 rounded-2xl text-xs font-mono text-gray-200 leading-relaxed transition resize-y focus:outline-none"
                placeholder="Renseignez ici toutes les connaissances métier de Facilité..."
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Sauvegarder les connaissances</span>
                  <i className="fa-solid fa-floppy-disk"></i>
                </button>
              </div>
            </div>
          )}

          {/* ONGLET NOUVEAU : RÈGLES DE DIAGNOSTIC CV */}
          {activeSubTab === "diagnostic" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Audit & Scoring ATS
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">Règles du Diagnostic CV</h2>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Définissez précisément les critères qui caractérisent un bon CV pour que l'IA évalue et note les CVs des candidats.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiagnosticRulesText(DEFAULT_DIAGNOSTIC_RULES)}
                  className="text-[11px] font-bold text-gray-400 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                  title="Rétablir les règles de diagnostic par défaut"
                >
                  <i className="fa-solid fa-rotate-left"></i>
                  <span>Défaut</span>
                </button>
              </div>

              {/* Presets rapides de barème */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-300 block">
                  Appliquer un barème spécial (Presets) :
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIAGNOSTIC_PRESETS.map((dp) => (
                    <button
                      key={dp.name}
                      type="button"
                      onClick={() => setDiagnosticRulesText((prev) => `${prev.trim()}\n\n[Barème Spécifique : ${dp.name}]\n${dp.modifier}`)}
                      className="text-[10px] font-bold bg-[#1F232B] hover:bg-emerald-950 hover:text-emerald-300 text-gray-300 px-3 py-1 rounded-xl border border-[#2E3542] hover:border-emerald-500/50 transition cursor-pointer"
                    >
                      + {dp.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone d'écriture des règles de diagnostic */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-gray-300">Critères & Instructions d'Audit CV :</label>
                  <span className="text-[11px] text-gray-500 font-mono">{diagnosticRulesText.length} caractères</span>
                </div>
                <textarea
                  value={diagnosticRulesText}
                  onChange={(e) => setDiagnosticRulesText(e.target.value)}
                  rows={13}
                  className="w-full p-4 bg-[#14161A] border border-[#2E3542] focus:border-[#10E688] focus:ring-1 focus:ring-[#10E688]/30 rounded-2xl text-xs font-mono text-gray-200 leading-relaxed transition resize-y focus:outline-none"
                  placeholder="Rédigez les critères de notation, rubriques obligatoires et conseils d'audit CV..."
                />
              </div>

              {/* Résumé des 4 piliers d'évaluation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 bg-[#1F232B] border border-[#2E3542] rounded-xl text-center">
                  <span className="text-base block mb-0.5">🎯</span>
                  <span className="text-[10px] font-black text-white block">Méthode STAR</span>
                  <span className="text-[9px] text-gray-400">Verbes & KPI</span>
                </div>
                <div className="p-2.5 bg-[#1F232B] border border-[#2E3542] rounded-xl text-center">
                  <span className="text-base block mb-0.5">🤖</span>
                  <span className="text-[10px] font-black text-white block">Score ATS</span>
                  <span className="text-[9px] text-gray-400">Mots-clés & Structure</span>
                </div>
                <div className="p-2.5 bg-[#1F232B] border border-[#2E3542] rounded-xl text-center">
                  <span className="text-base block mb-0.5">✨</span>
                  <span className="text-[10px] font-black text-white block">Design & Clarté</span>
                  <span className="text-[9px] text-gray-400">Aéré & Lisible</span>
                </div>
                <div className="p-2.5 bg-[#1F232B] border border-[#2E3542] rounded-xl text-center">
                  <span className="text-base block mb-0.5">💼</span>
                  <span className="text-[10px] font-black text-white block">Recommandations</span>
                  <span className="text-[9px] text-gray-400">Modèles Facilité</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 bg-[#10E688] hover:bg-[#10E688]/90 text-gray-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Enregistrer les règles de diagnostic</span>
                  <i className="fa-solid fa-floppy-disk"></i>
                </button>
              </div>
            </div>
          )}

          {/* ONGLET 3 : PRODUITS ET SERVICES */}
          {activeSubTab === "products" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-white">Produits & Tarification</h2>
                  <p className="text-xs text-gray-400">L'IA connaît exactement vos prix et les propose aux clients</p>
                </div>
                <div className="flex items-center space-x-1.5 bg-[#222730] p-1 rounded-xl border border-[#333A48]">
                  <button
                    type="button"
                    onClick={() => setCurrency("FCFA")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                      currency === "FCFA" ? "bg-[#10E688] text-gray-950" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    FCFA 🇸🇳
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("EUR")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                      currency === "EUR" ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    EUR 🇪🇺
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {productsList.map((prod, idx) => (
                  <div
                    key={prod.id}
                    className="p-3.5 bg-[#1F232B] border border-[#2E3542] rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-white truncate">{prod.name}</h4>
                      <p className="text-[11px] text-gray-400 truncate">{prod.desc}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                        {currency === "FCFA" ? `${prod.priceFCFA} FCFA` : `${prod.priceEUR} €`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ONGLET 4 : CONNEXIONS WHATSAPP / WEB */}
          {activeSubTab === "connections" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="border-b border-[#2A2F3A] pb-3">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Canaux de communication & Déploiement</h2>
                <p className="text-xs text-gray-400">Où cet assistant IA est-il actif en temps réel ?</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-[#1F232B] border border-emerald-500/40 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-lg border border-emerald-500/30">
                      <i className="fa-solid fa-globe"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Widget Web & Page Accueil</h4>
                      <p className="text-[10px] text-gray-400">Actif pour tous les visiteurs sur ffacilite.com</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/90 px-2.5 py-1 rounded-full border border-emerald-600">
                    Connecté 🟢
                  </span>
                </div>

                <div className="p-4 bg-[#1F232B] border border-[#2E3542] rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-lg border border-blue-500/30">
                      <i className="fa-solid fa-comments"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Messagerie Interne (/messagerie)</h4>
                      <p className="text-[10px] text-gray-400">Fil permanent "Assistance IA Facilité"</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-blue-400 bg-blue-950/90 px-2.5 py-1 rounded-full border border-blue-600">
                    Connecté 🟢
                  </span>
                </div>

                <div className="p-4 bg-[#1F232B] border border-green-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-green-600/20 text-green-400 flex items-center justify-center text-lg border border-green-500/30">
                      <i className="fa-brands fa-whatsapp"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Passerelle WhatsApp Business</h4>
                      <p className="text-[10px] text-gray-400">Prise de relais automatique vers le WhatsApp officiel</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-green-400 bg-green-950/90 px-2.5 py-1 rounded-full border border-green-600">
                    Configuré ✅
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 5 : OUTILS & RELAIS HUMAIN */}
          {activeSubTab === "tools" && (
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="border-b border-[#2A2F3A] pb-3">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Relais Humain & Outils Automatisés</h2>
                <p className="text-xs text-gray-400">Passage de relais à l'équipe humaine et règles de fin d'échange</p>
              </div>

              <div className="p-4 bg-[#1F232B] border border-amber-500/30 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                  <i className="fa-solid fa-user-tie"></i>
                  <span>Protocole de Relais Canva & Facturation :</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Lorsque l'IA a collecté le nom, le poste et les expériences du client, elle lui présente un récapitulatif clair et lui annonce que le **Responsable Canva** va prendre le relais en direct pour la maquette et la validation du paiement Wave/Orange Money.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* ================= COLONNE DROITE (5/12) : PLAYGROUND TEST OU LABO DE DIAGNOSTIC ================= */}
        <div className="lg:col-span-5">
          {activeSubTab === "diagnostic" ? (
            /* LABO DE TEST DU DIAGNOSTIC CV EN DIRECT */
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl shadow-2xl flex flex-col h-[720px] overflow-hidden">
              {/* Header du Labo */}
              <div className="p-4 border-b border-[#2A2F3A] bg-[#1F232B] flex items-center justify-between gap-2 flex-none">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-gray-950 font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                    <i className="fa-solid fa-stethoscope"></i>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-white truncate">Test Diagnostic CV & ATS</span>
                      <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        En direct
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">Vérification de vos règles sur un vrai CV</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDiagTestFile(null);
                    setDiagResult(null);
                    setDiagError(null);
                  }}
                  className="w-8 h-8 rounded-xl bg-[#14161A] hover:bg-red-950 text-gray-400 hover:text-red-400 border border-[#2E3542] flex items-center justify-center transition cursor-pointer"
                  title="Réinitialiser le test"
                >
                  <i className="fa-solid fa-rotate-right text-xs"></i>
                </button>
              </div>

              {/* Corps du Labo */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#131518]">
                {/* Inputs cachés */}
                <input
                  type="file"
                  ref={diagFileInputRef}
                  onChange={(e) => handleDiagFileChange(e, "document")}
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={diagPhotoInputRef}
                  onChange={(e) => handleDiagFileChange(e, "image")}
                  accept="image/*"
                  className="hidden"
                />

                {/* 1. Boutons d'insertion / Téléversement */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-300 block">
                    1. Choisissez un CV ou une photo pour tester :
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => diagFileInputRef.current?.click()}
                      disabled={diagIsAnalyzing}
                      className="p-3.5 bg-[#1F232B] hover:bg-[#282F3C] border border-[#2E3542] hover:border-[#10E688]/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-base group-hover:scale-110 transition">
                        <i className="fa-solid fa-file-arrow-up"></i>
                      </div>
                      <span className="text-xs font-black text-white">Importer Document</span>
                      <span className="text-[9px] text-gray-400 font-mono">PDF, DOCX, Word</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => diagPhotoInputRef.current?.click()}
                      disabled={diagIsAnalyzing}
                      className="p-3.5 bg-[#1F232B] hover:bg-[#282F3C] border border-[#2E3542] hover:border-[#10E688]/60 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base group-hover:scale-110 transition">
                        <i className="fa-solid fa-camera"></i>
                      </div>
                      <span className="text-xs font-black text-white">Téléverser Photo</span>
                      <span className="text-[9px] text-gray-400 font-mono">PNG, JPG, Scan</span>
                    </button>
                  </div>
                </div>

                {/* 2. Fichier sélectionné + Bouton d'action */}
                {diagTestFile && (
                  <div className="p-3.5 bg-[#1C2027] border border-[#2E3542] rounded-2xl space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {diagTestFile.type === "image" ? (
                          <img
                            src={diagTestFile.data}
                            alt="Aperçu CV"
                            className="w-10 h-10 rounded-lg object-cover border border-[#10E688]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center text-base">
                            <i className="fa-solid fa-file-pdf"></i>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{diagTestFile.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {(diagTestFile.size / 1024).toFixed(0)} Ko • {diagTestFile.type === "image" ? "Photo de CV" : "Document CV"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDiagTestFile(null);
                          setDiagResult(null);
                        }}
                        className="text-gray-400 hover:text-red-400 p-1.5 transition cursor-pointer"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunDiagnosticTest}
                      disabled={diagIsAnalyzing}
                      className="w-full py-3 bg-gradient-to-r from-[#10E688] to-teal-400 hover:opacity-95 text-gray-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {diagIsAnalyzing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></span>
                          <span>Analyse IA selon vos règles en cours...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-bolt text-sm"></i>
                          <span>Lancer le Diagnostic Immédiat</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 3. Message d'erreur si échec */}
                {diagError && (
                  <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>{diagError}</span>
                  </div>
                )}

                {/* 4. Résultats détaillés du Diagnostic */}
                {diagResult && (
                  <div className="space-y-3 animate-fade-in">
                    {/* Score & Compatibilité */}
                    <div className="p-4 bg-[#1F232B] border border-[#2E3542] rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                          Score Global ATS
                        </span>
                        <div className="flex items-baseline space-x-1.5 mt-0.5">
                          <span
                            className={`text-2xl font-black ${
                              diagResult.score_global >= 75
                                ? "text-emerald-400"
                                : diagResult.score_global >= 50
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            {diagResult.score_global}
                          </span>
                          <span className="text-xs text-gray-400 font-bold">/ 100</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                          Compatibilité ATS
                        </span>
                        <span className="inline-block mt-0.5 text-xs font-extrabold bg-[#131518] px-2.5 py-1 rounded-lg border border-[#2E3542] text-white">
                          {diagResult.compatibilite_ats || "Moyenne"}
                        </span>
                      </div>
                    </div>

                    {/* Points Forts */}
                    {diagResult.points_forts && diagResult.points_forts.length > 0 && (
                      <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-emerald-400 font-black text-xs">
                          <i className="fa-solid fa-circle-check"></i>
                          <span>Points Forts Validés :</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-xs text-gray-200">
                          {diagResult.points_forts.map((pt, idx) => (
                            <li key={idx} className="leading-snug">{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Axes d'Amélioration */}
                    {diagResult.axes_amelioration && diagResult.axes_amelioration.length > 0 && (
                      <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-amber-400 font-black text-xs">
                          <i className="fa-solid fa-circle-exclamation"></i>
                          <span>Axes d'Amélioration Relevés :</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-xs text-gray-200">
                          {diagResult.axes_amelioration.map((ax, idx) => (
                            <li key={idx} className="leading-snug">{ax}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Conseils Clés */}
                    {diagResult.conseils_cles && diagResult.conseils_cles.length > 0 && (
                      <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-2xl space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-blue-400 font-black text-xs">
                          <i className="fa-solid fa-lightbulb"></i>
                          <span>Recommandations & Conseils Clés :</span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-xs text-gray-200">
                          {diagResult.conseils_cles.map((cs, idx) => (
                            <li key={idx} className="leading-snug">{cs}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* PLAYGROUND DE TEST CONVERSATIONNEL STANDARD */
            <div className="bg-[#181B20] border border-[#2A2F3A] rounded-3xl shadow-2xl flex flex-col h-[720px] overflow-hidden">
              
              {/* Header du Playground */}
              <div className="p-4 border-b border-[#2A2F3A] bg-[#1F232B] flex items-center justify-between gap-2 flex-none">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-gray-950 font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                    N
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-white truncate">Agent Facilité</span>
                      <span className="text-[10px] text-emerald-400 font-bold">En ligne</span>
                    </div>
                    <span className="text-[10px] text-gray-400">Playground de test</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Toggle Devise Dynamique (Présent sur la capture) */}
                  <div className="flex items-center space-x-1.5 bg-[#14161A] px-2 py-1 rounded-xl border border-[#2E3542]">
                    <span className="text-[9px] font-extrabold text-gray-400">Devise :</span>
                    <button
                      type="button"
                      onClick={() => setCurrency(currency === "FCFA" ? "EUR" : "FCFA")}
                      className="text-[10px] font-black text-emerald-400 hover:underline cursor-pointer"
                    >
                      {currency}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetChat}
                    className="w-8 h-8 rounded-xl bg-[#14161A] hover:bg-red-950 text-gray-400 hover:text-red-400 border border-[#2E3542] flex items-center justify-center transition cursor-pointer"
                    title="Réinitialiser la conversation de test"
                  >
                    <i className="fa-solid fa-rotate-right text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Zone de conversation / Messages */}
              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#131518]"
              >
                {chatMessages.length === 0 ? (
                  // Écran de bienvenue (Exactement comme dans la capture)
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-[#10E688] text-gray-950 flex items-center justify-center text-2xl shadow-xl animate-pulse">
                      <i className="fa-solid fa-wave-square"></i>
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-base font-black text-white">Testez votre Agent ici</h3>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        Cet espace vous permet de vérifier l'efficacité de votre agent avant de le mettre en ligne. Envoyez un message pour commencer.
                      </p>
                    </div>
                    <div className="p-3 bg-[#1A1D24] border border-[#2E3542] rounded-xl text-[11px] text-gray-400 max-w-xs leading-normal">
                      Toutes les conversations ici sont en mode test et n'affecteront pas votre environnement de production.
                    </div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span>↓ Commencez par envoyer un message</span>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-2`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-gray-950 font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                          IA
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-1.5 shadow-md ${
                          msg.role === "user"
                            ? "bg-[#1E60E6] text-white rounded-tr-xs"
                            : msg.isError
                            ? "bg-red-950/80 text-red-200 border border-red-800 rounded-tl-xs"
                            : "bg-[#1F232B] text-gray-200 border border-[#2E3542] rounded-tl-xs"
                        }`}
                      >
                        {/* Affichage de la pièce jointe dans la bulle de chat */}
                        {msg.attachment && (
                          <div className="p-2.5 bg-black/30 rounded-xl border border-white/15 flex items-center space-x-2.5">
                            {msg.attachment.type === "image" ? (
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 flex-shrink-0 bg-black/40">
                                <img src={msg.attachment.data} alt="Aperçu CV" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-red-600/30 border border-red-500/40 text-red-400 flex items-center justify-center text-lg flex-shrink-0">
                                <i className={msg.attachment.name.endsWith(".pdf") ? "fa-solid fa-file-pdf" : "fa-solid fa-file-lines"}></i>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-white truncate">{msg.attachment.name}</div>
                              <div className="text-[9px] text-gray-300 font-mono">
                                {(msg.attachment.size / 1024).toFixed(0)} Ko • {msg.attachment.type === "image" ? "Photo CV / Lettre" : "Document CV"}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="whitespace-pre-wrap font-normal">{msg.content}</div>
                        <div className="flex items-center justify-between text-[9px] opacity-60 pt-1 font-mono">
                          <span>{msg.time}</span>
                          {msg.elapsedMs && <span>{(msg.elapsedMs / 1000).toFixed(2)}s</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isGenerating && (
                  <div className="flex justify-start items-center gap-2 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-gray-950 font-black text-[10px] flex items-center justify-center">
                      IA
                    </div>
                    <div className="bg-[#1F232B] border border-[#2E3542] rounded-2xl px-4 py-2 text-xs text-gray-400 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>L'IA analyse vos documents et formule sa réponse...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions rapides en 1 clic au-dessus de l'input */}
              <div className="px-3 py-2 bg-[#1A1D24] border-t border-[#2A2F3A] flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-none">
                <span className="text-[10px] font-black text-gray-400 uppercase flex-shrink-0">Tests :</span>
                <button
                  type="button"
                  onClick={() => handleSendTestMessage("Quels sont vos tarifs de CV ?")}
                  disabled={isGenerating}
                  className="text-[10px] font-bold bg-[#242A36] hover:bg-[#10E688] hover:text-gray-950 text-gray-300 px-2.5 py-1 rounded-full border border-[#353D4E] transition flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Prix CV
                </button>
                <button
                  type="button"
                  onClick={() => handleSendTestMessage("Je veux créer un CV pour un poste de Comptable à Dakar")}
                  disabled={isGenerating}
                  className="text-[10px] font-bold bg-[#242A36] hover:bg-[#10E688] hover:text-gray-950 text-gray-300 px-2.5 py-1 rounded-full border border-[#353D4E] transition flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Création CV
                </button>
                <button
                  type="button"
                  onClick={() => handleSendTestMessage("Naka liggéey bi ?")}
                  disabled={isGenerating}
                  className="text-[10px] font-bold bg-[#242A36] hover:bg-[#10E688] hover:text-gray-950 text-gray-300 px-2.5 py-1 rounded-full border border-[#353D4E] transition flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Test Wolof
                </button>
              </div>

              {/* Barre de prévisualisation du fichier sélectionné */}
              {selectedAttachment && (
                <div className="px-3.5 py-2 bg-[#1F232B] border-t border-[#2A2F3A] flex items-center justify-between gap-3 animate-fade-in flex-none">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {selectedAttachment.type === "image" ? (
                      <img src={selectedAttachment.data} alt="Preview" className="w-9 h-9 rounded-lg object-cover border border-[#10E688] flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center text-base flex-shrink-0">
                        <i className="fa-solid fa-file-pdf"></i>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{selectedAttachment.name}</div>
                      <div className="text-[10px] text-emerald-400 font-medium">Prêt pour l'analyse IA • {(selectedAttachment.size / 1024).toFixed(0)} Ko</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAttachment(null)}
                    className="text-gray-400 hover:text-red-400 p-1.5 transition cursor-pointer"
                    title="Retirer le fichier"
                  >
                    <i className="fa-solid fa-xmark text-sm"></i>
                  </button>
                </div>
              )}

              {/* Zone de saisie avec boutons Trombone (Document) et Photo (Image) */}
              <div className="p-3 bg-[#181B20] border-t border-[#2A2F3A] flex-none">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendTestMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  {/* Inputs de fichiers cachés */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e, "document")}
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={(e) => handleFileChange(e, "image")}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Bouton Trombone (Document PDF/Word) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="p-2.5 bg-[#1F232B] hover:bg-[#2A303C] text-gray-300 hover:text-[#10E688] border border-[#2E3542] rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
                    title="Insérer un document (CV PDF, Word, Lettre...)"
                  >
                    <i className="fa-solid fa-paperclip text-sm"></i>
                  </button>

                  {/* Bouton Appareil Photo / Image */}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isGenerating}
                    className="p-2.5 bg-[#1F232B] hover:bg-[#2A303C] text-gray-300 hover:text-[#10E688] border border-[#2E3542] rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
                    title="Insérer une photo (Photo de CV, capture d'écran...)"
                  >
                    <i className="fa-solid fa-camera text-sm"></i>
                  </button>

                  {/* Champ texte */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={selectedAttachment ? "Ajouter un message d'accompagnement..." : "Message ou insérer CV..."}
                      disabled={isGenerating}
                      className="w-full pl-4 pr-9 py-2.5 bg-[#131518] border border-[#2E3542] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10E688] transition font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendTestMessage("Bonjour, voici mon CV pour analyse")}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white transition cursor-pointer"
                      title="Suggestion automatique"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                    </button>
                  </div>

                  {/* Bouton Envoi */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedAttachment) || isGenerating}
                    className="px-4 py-2.5 bg-[#10E688] hover:bg-[#10E688]/90 disabled:bg-gray-700 text-gray-950 font-black rounded-xl text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
