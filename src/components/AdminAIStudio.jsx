"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Modèle IA unique de l'assistant plateforme (point 1, 2026-08-22) :
// DeepSeek/Groq retirés de ce panneau, /api/ai-chat n'appelle plus que
// Gemini pour cette route — un seul choix affiché, non modifiable.
const AI_MODELS = [
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", tag: "Modèle unique de l'assistant plateforme", cost: "⚡ Vision", badge: "vision" },
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
  const [selectedModel, setSelectedModel] = useState("gemini-3.6-flash");
  const [commStyle, setCommStyle] = useState("normal");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [promptText, setPromptText] = useState(DEFAULT_MAIN_PROMPT);
  const [knowledgeText, setKnowledgeText] = useState(DEFAULT_KNOWLEDGE);
  const [diagnosticRulesText, setDiagnosticRulesText] = useState(DEFAULT_DIAGNOSTIC_RULES);
  const [productsList, setProductsList] = useState(DEFAULT_PRODUCTS);
  const [currency, setCurrency] = useState("FCFA"); // "FCFA" | "EUR"
  const [isDeployed, setIsDeployed] = useState(true);
  const [savedToast, setSavedToast] = useState(false);
  // true seulement si aucune configuration n'existe encore côté serveur ET
  // qu'une sauvegarde locale (ancien système, propre à ce navigateur) a été
  // trouvée — propose un import explicite plutôt que de l'appliquer
  // silencieusement (voir handleImportLocalConfig).
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [importingLocal, setImportingLocal] = useState(false);

  // État du Bac à sable (Playground)
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState(null); // { name, type, mimeType, size, data }
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastElapsedMs, setLastElapsedMs] = useState(null);
  const [showQuickPresets, setShowQuickPresets] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const textareaRef = useRef(null);

  const startVoiceInput = () => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "fr-FR";
        recognition.interimResults = false;
        recognition.onstart = () => setIsListeningVoice(true);
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInputText((prev) => (prev ? prev + " " + transcript : transcript));
          setIsListeningVoice(false);
        };
        recognition.onerror = () => setIsListeningVoice(false);
        recognition.onend = () => setIsListeningVoice(false);
        recognition.start();
        return;
      } catch {}
    }
    setIsListeningVoice(true);
    setTimeout(() => setIsListeningVoice(false), 2500);
  };

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

  // Chargement Supabase-first (voir /api/admin/ai-studio) : une config
  // enregistrée côté serveur prime toujours sur les valeurs par défaut. Si
  // le serveur n'a encore rien (personne n'a sauvegardé depuis la bascule),
  // repli sur les valeurs par défaut codées en dur (déjà les valeurs
  // initiales des useState ci-dessus, donc rien à faire) — et si une
  // sauvegarde locale (ancien système) existe dans CE navigateur, propose
  // un import explicite plutôt que de l'appliquer automatiquement comme
  // avant (voir handleImportLocalConfig).
  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch("/api/admin/ai-studio", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setPromptText(data.config.promptText || DEFAULT_MAIN_PROMPT);
            setKnowledgeText(data.config.knowledgeText || DEFAULT_KNOWLEDGE);
            setDiagnosticRulesText(data.config.diagnosticRulesText || DEFAULT_DIAGNOSTIC_RULES);
            setCommStyle(data.config.commStyle || "normal");
            setSelectedModel(data.config.selectedModel || "gemini-3.6-flash");
            setCurrency(data.config.currency || "FCFA");
            if (data.productsList?.length) setProductsList(data.productsList);
          } else if (localStorage.getItem("FACILITE_AI_STUDIO_V2")) {
            setHasLocalBackup(true);
          }
        }
      } catch (err) {
        console.error("Erreur chargement config IA Studio (Supabase) :", err);
      }
    })();

    // État d'UI pur (onglet actif, historique du playground) — jamais migré
    // en base, reste local à chaque navigateur comme avant.
    try {
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

  // Import explicite unique de l'ancienne sauvegarde locale vers Supabase —
  // n'apparaît que si le serveur n'a encore aucune configuration (voir
  // hasLocalBackup ci-dessus), pour ne jamais écraser un réglage déjà
  // partagé par une copie locale périmée d'un autre poste.
  const handleImportLocalConfig = async () => {
    setImportingLocal(true);
    try {
      const saved = localStorage.getItem("FACILITE_AI_STUDIO_V2");
      if (!saved) return;
      const parsed = JSON.parse(saved);

      const next = {
        promptText: parsed.promptText || DEFAULT_MAIN_PROMPT,
        knowledgeText: parsed.knowledgeText || DEFAULT_KNOWLEDGE,
        diagnosticRulesText: parsed.diagnosticRulesText || DEFAULT_DIAGNOSTIC_RULES,
        commStyle: parsed.commStyle || "normal",
        selectedModel: parsed.selectedModel || "gemini-3.6-flash",
        // Absent des sauvegardes faites avant ce correctif (bug de
        // persistance) — repli sur l'état "currency" actuel du composant.
        currency: parsed.currency || currency,
        productsList: parsed.productsList || DEFAULT_PRODUCTS,
      };

      setPromptText(next.promptText);
      setKnowledgeText(next.knowledgeText);
      setDiagnosticRulesText(next.diagnosticRulesText);
      setCommStyle(next.commStyle);
      setSelectedModel(next.selectedModel);
      setCurrency(next.currency);
      setProductsList(next.productsList);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch("/api/admin/ai-studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(next),
      });

      setHasLocalBackup(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (err) {
      console.error("Erreur import de la config locale :", err);
    } finally {
      setImportingLocal(false);
    }
  };

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

  // Sauvegarde des réglages — écrit toujours localStorage (inchangé, conservé
  // en secours pour l'instant, voir plan de retrait en 2e étape) ET
  // désormais aussi Supabase (source de vérité partagée entre postes admin).
  const handleSaveConfig = async () => {
    const config = {
      promptText,
      knowledgeText,
      diagnosticRulesText,
      commStyle,
      selectedModel,
      currency, // bug de persistance corrigé : absent de l'objet sauvegardé jusqu'ici
      productsList,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("FACILITE_AI_STUDIO_V2", JSON.stringify(config));
      localStorage.setItem("FACILITE_DIAGNOSTIC_RULES", diagnosticRulesText);
    } catch (e) {
      console.error("Erreur sauvegarde locale studio IA:", e);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/admin/ai-studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHasLocalBackup(false);
    } catch (e) {
      console.error("Erreur sauvegarde Supabase studio IA:", e);
    }

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  // Vider complètement la page de formation (Page blanche / Saisie libre) —
  // efface aussi la config Supabase : sans ça, un rechargement de page
  // réappliquerait l'ancienne config serveur et le "vidage" paraîtrait
  // n'avoir jamais eu lieu.
  const handleClearAllTraining = async () => {
    const confirmClear = window.confirm(
      "Voulez-vous vider complètement la page de formation pour partir d'une page blanche ?"
    );
    if (!confirmClear) return;

    setPromptText("");
    setKnowledgeText("");
    setDiagnosticRulesText("");
    setProductsList([]);
    setChatMessages([]);
    setInputText("");
    setSelectedAttachment(null);
    setDiagResult(null);
    setDiagTestFile(null);

    try {
      localStorage.setItem(
        "FACILITE_AI_STUDIO_V2",
        JSON.stringify({
          promptText: "",
          knowledgeText: "",
          diagnosticRulesText: "",
          commStyle: "normal",
          selectedModel: "gemini-3.6-flash",
          currency,
          productsList: [],
          updatedAt: new Date().toISOString(),
        })
      );
      localStorage.removeItem("FACILITE_DIAGNOSTIC_RULES");
      localStorage.removeItem("FACILITE_AI_STUDIO_CHAT_HISTORY");
    } catch {}

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch("/api/admin/ai-studio", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error("Erreur suppression config Supabase studio IA:", err);
    }

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  // Restaurer les valeurs par défaut de formation de Facilité
  const handleResetDefaultTraining = () => {
    const confirmReset = window.confirm("Restaurer les directives d'entraînement par défaut de Facilité ?");
    if (!confirmReset) return;

    setPromptText(DEFAULT_MAIN_PROMPT);
    setKnowledgeText(DEFAULT_KNOWLEDGE);
    setDiagnosticRulesText(DEFAULT_DIAGNOSTIC_RULES);
    setProductsList(DEFAULT_PRODUCTS);
    setCommStyle("normal");
    handleSaveConfig();
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
    <div className="h-full flex flex-col min-h-0 space-y-2 font-sans text-gray-100">
      
      {/* HEADER & SUB-NAV FIXES DE L'AGENT IA */}
      <div className="flex-none space-y-1.5 pb-0.5">
        {/* 1. TOP BAR NOIRE DU STUDIO (Style Référence) */}
        <div className="bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
          
          {/* Titre Agent + Bouton Déployer */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-[#10E688] text-gray-950 flex items-center justify-center font-black text-base shadow-md">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-xs sm:text-sm font-black text-white tracking-tight">Agent IA Facilité</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {isDeployed ? "En ligne" : "Brouillon"}
                </span>
              </div>
              <p className="text-[9px] text-gray-400 font-medium">Studio d'entraînement & supervision de l'assistant</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsDeployed(!isDeployed);
                handleSaveConfig();
              }}
              className="ml-1.5 px-2.5 py-1 bg-[#10E688] hover:bg-[#10E688]/90 text-gray-950 font-black text-[11px] rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer"
            >
              <i className="fa-solid fa-rocket text-[10px]"></i>
              <span>{isDeployed ? "Déployé" : "Déployer"}</span>
            </button>
          </div>

          {/* Badge Milieu : Assistant IA Actif */}
          <div className="hidden md:flex items-center space-x-1.5 bg-[#222730] border border-[#333A48] px-2.5 py-1 rounded-full text-xs font-bold text-gray-200">
            <span className="text-[11px]">Assistant IA</span>
            <span className="bg-[#10E688] text-gray-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">v2</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#10E688] animate-ping"></span>
          </div>

          {/* Solde & Jetons & Actions (Top Right) */}
          <div className="flex items-center space-x-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleClearAllTraining}
              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shadow-xs"
              title="Vider tous les textes de formation pour partir d'une page blanche"
            >
              <i className="fa-solid fa-eraser text-[10px]"></i>
              <span>Vider la page</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaultTraining}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shadow-xs"
              title="Rétablir les textes de formation par défaut de Facilité"
            >
              <i className="fa-solid fa-rotate-left text-[10px]"></i>
              <span className="hidden sm:inline">Modèle par défaut</span>
            </button>

            <button
              type="button"
              onClick={handleSaveConfig}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition shadow-md flex items-center gap-1 cursor-pointer ${
                savedToast
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
              }`}
            >
              <i className={`fa-solid ${savedToast ? "fa-circle-check" : "fa-floppy-disk"} text-xs`}></i>
              <span>{savedToast ? "Enregistré !" : "Enregistrer"}</span>
            </button>
          </div>
        </div>

        {/* Import ponctuel de l'ancienne sauvegarde locale (localStorage) —
            n'apparaît que si Supabase n'a encore aucune config enregistrée
            ET qu'une sauvegarde locale existe dans ce navigateur. */}
        {hasLocalBackup && (
          <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-amber-200 text-[11px] font-semibold">
              <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
              <span>
                Une configuration enregistrée localement sur ce poste a été trouvée, mais rien n'existe encore côté
                serveur.
              </span>
            </div>
            <button
              type="button"
              onClick={handleImportLocalConfig}
              disabled={importingLocal}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg text-[11px] font-extrabold transition cursor-pointer disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
            >
              <i className={`fa-solid ${importingLocal ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"} text-[10px]`}></i>
              <span>{importingLocal ? "Import..." : "Importer cette configuration"}</span>
            </button>
          </div>
        )}

        {/* 2. BARRE D'ONGLETS DU STUDIO (Sub-nav avec persistance) */}
        <div className="flex items-center space-x-1 bg-[#181B20] border border-[#2A2F3A] p-1 rounded-xl overflow-x-auto scrollbar-none shadow-sm">
          <button
            type="button"
            onClick={() => handleSubTabChange("prompt")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "prompt"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-sliders text-emerald-400 text-xs"></i>
            <span>Prompt & Directives</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("knowledge")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "knowledge"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-book-bookmark text-blue-400 text-xs"></i>
            <span>Base de connaissances</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("diagnostic")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "diagnostic"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-stethoscope text-emerald-400 text-xs"></i>
            <span>Règles Diagnostic CV</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("products")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "products"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-boxes-stacked text-purple-400 text-xs"></i>
            <span>Produits & Tarifs</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("connections")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "connections"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-brands fa-whatsapp text-green-400 text-xs"></i>
            <span>Connexions (WhatsApp / Web)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("tools")}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer flex-shrink-0 ${
              activeSubTab === "tools"
                ? "bg-[#2A303C] text-white shadow-xs border border-[#3E4758]"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#222730]"
            }`}
          >
            <i className="fa-solid fa-screwdriver-wrench text-amber-400 text-xs"></i>
            <span>Outils & Relais Humain</span>
          </button>
        </div>
      </div>

      {/* 3. GRILLE PRINCIPALE (CONFIGURATION À GAUCHE | PLAYGROUND À DROITE) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        
        {/* ================= COLONNE GAUCHE (7/12) : FORMATION & CONFIGURATION ================= */}
        <div className="lg:col-span-7 h-full flex flex-col min-h-0">
          
          {/* ONGLET 1 : PROMPT & CONFIGURATION */}
          {activeSubTab === "prompt" && (
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3 flex-none">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Configuration du prompt</h2>
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-gray-400 font-bold">Prompt score</span>
                  <span className="bg-[#222730] border border-amber-500/40 text-amber-400 font-black px-2 py-0.5 rounded-lg">
                    {promptScore} <span className="text-[10px] text-gray-400 font-normal">/ 10</span>
                  </span>
                </div>
              </div>

              {/* Contenu avec défilement interne exclusif */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-3 pr-1.5 scrollbar-thin">
                {/* Sélecteur Modèle d'IA — verrouillé sur Gemini (point 1,
                    2026-08-22) : plus de choix possible, un seul modèle
                    affiché à titre informatif, non cliquable. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">Modèle d'IA :</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {AI_MODELS.map((model) => {
                      return (
                        <div
                          key={model.id}
                          className="p-3 rounded-2xl border text-left flex flex-col justify-between bg-[#252B35] border-[#10E688] ring-1 ring-[#10E688]/30 shadow-md cursor-default"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{model.name}</span>
                            <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <i className="fa-solid fa-lock text-[8px]"></i>
                              {model.cost}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1 truncate">{model.tag}</p>
                        </div>
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
                    rows={12}
                    className="w-full p-4 bg-[#14161A] border border-[#2E3542] focus:border-[#10E688] focus:ring-1 focus:ring-[#10E688]/30 rounded-2xl text-xs font-mono text-gray-200 leading-relaxed transition resize-y focus:outline-none"
                    placeholder="Écrivez vos instructions personnalisées ici..."
                  />
                </div>
              </div>

              {/* Bouton Enregistrer fixé au bas */}
              <div className="flex justify-end pt-3 border-t border-[#2A2F3A] flex-none">
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
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              <div className="border-b border-[#2A2F3A] pb-3 flex-none">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Base de connaissances métier</h2>
                <p className="text-xs text-gray-400">Règles d'entreprise, FAQ, coordonnées et faits officiels</p>
              </div>

              <div className="flex-1 min-h-0 py-3">
                <textarea
                  value={knowledgeText}
                  onChange={(e) => setKnowledgeText(e.target.value)}
                  className="w-full h-full p-4 bg-[#14161A] border border-[#2E3542] focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 rounded-2xl text-xs font-mono text-gray-200 leading-relaxed transition resize-none focus:outline-none"
                  placeholder="Renseignez ici toutes les connaissances métier de Facilité..."
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-[#2A2F3A] flex-none">
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
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3 flex-none">
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

              {/* Contenu défilable */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-3 pr-1.5 scrollbar-thin">
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
                    rows={12}
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
              </div>

              <div className="flex justify-end pt-3 border-t border-[#2A2F3A] flex-none">
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
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#2A2F3A] pb-3 flex-none">
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

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-3 pr-1.5 scrollbar-thin">
                {productsList.map((prod) => (
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

              <div className="flex justify-end pt-3 border-t border-[#2A2F3A] flex-none">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 bg-[#10E688] hover:bg-[#10E688]/90 text-gray-950 font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Enregistrer les tarifs</span>
                  <i className="fa-solid fa-floppy-disk"></i>
                </button>
              </div>
            </div>
          )}

          {/* ONGLET 4 : CONNEXIONS WHATSAPP / WEB */}
          {activeSubTab === "connections" && (
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              <div className="border-b border-[#2A2F3A] pb-3 flex-none">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Canaux de communication & Déploiement</h2>
                <p className="text-xs text-gray-400">Où cet assistant IA est-il actif en temps réel ?</p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-1.5 scrollbar-thin">
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
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl p-3.5 sm:p-4 shadow-xl overflow-hidden">
              <div className="border-b border-[#2A2F3A] pb-3 flex-none">
                <h2 className="text-sm sm:text-base font-extrabold text-white">Relais Humain & Outils Automatisés</h2>
                <p className="text-xs text-gray-400">Passage de relais à l'équipe humaine et règles de fin d'échange</p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-1.5 scrollbar-thin">
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
            </div>
          )}

        </div>

        {/* ================= COLONNE DROITE (5/12) : PLAYGROUND TEST OU LABO DE DIAGNOSTIC ================= */}
        <div className="lg:col-span-5 h-full flex flex-col min-h-0">
          {activeSubTab === "diagnostic" ? (
            /* LABO DE TEST DU DIAGNOSTIC CV EN DIRECT */
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl shadow-xl overflow-hidden">
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
            <div className="h-full flex flex-col min-h-0 bg-[#181B20] border border-[#2A2F3A] rounded-2xl shadow-xl overflow-hidden">
              
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

              {/* Zone de saisie prompt box moderne (Style référence / Lovable / Claude) */}
              <div className="p-3 bg-[#131518] border-t border-[#2A2F3A] flex-none">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendTestMessage();
                  }}
                  className="relative"
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

                  {/* Popover Menu "+" pour actions rapides */}
                  {showQuickPresets && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1C1F26] border border-[#2E3545] rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-2.5 py-1">
                        Actions rapides IA
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleSendTestMessage("Quels sont les tarifs officiels pour refaire mon CV et ma lettre de motivation ?");
                          setShowQuickPresets(false);
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 rounded-xl transition flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-tag text-emerald-400 text-xs"></i>
                        <span>Demander les tarifs & offres</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSendTestMessage("Je souhaite optimiser mon CV pour le marché de l'emploi au Sénégal");
                          setShowQuickPresets(false);
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 rounded-xl transition flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-briefcase text-blue-400 text-xs"></i>
                        <span>Conseil CV Marché Sénégal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSendTestMessage("Peux-tu m'expliquer la norme ATS et comment passer les filtres recruteurs ?");
                          setShowQuickPresets(false);
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 rounded-xl transition flex items-center gap-2 cursor-pointer"
                      >
                        <i className="fa-solid fa-robot text-purple-400 text-xs"></i>
                        <span>Explication norme ATS</span>
                      </button>
                    </div>
                  )}

                  {/* Popover Menu "Attach" */}
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-10 mb-2 w-56 bg-[#1C1F26] border border-[#2E3545] rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-file-pdf text-red-400 text-sm"></i>
                        <div>
                          <div className="font-bold text-white">Document CV</div>
                          <div className="text-[10px] text-gray-400">PDF, Word, TXT</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          imageInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/10 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-camera text-emerald-400 text-sm"></i>
                        <div>
                          <div className="font-bold text-white">Photo / Image</div>
                          <div className="text-[10px] text-gray-400">Capture d'écran, JPG, PNG</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Boîte de prompt sombre arrondie (1:1 style capture) */}
                  <div className="bg-[#0b0c0f] border border-[#222630] hover:border-[#323846] focus-within:border-gray-500 rounded-[24px] p-3 sm:p-3.5 shadow-xl transition-all">
                    
                    {/* Zone de texte multi-lignes */}
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendTestMessage();
                        }
                      }}
                      rows={2}
                      placeholder={
                        selectedAttachment
                          ? "Ajouter un message d'accompagnement ou appuyez sur Entrée..."
                          : "Posez une question, demandez une analyse de CV ou décrivez un besoin..."
                      }
                      disabled={isGenerating}
                      className="w-full bg-transparent text-white placeholder-gray-500 text-xs sm:text-sm leading-relaxed resize-none focus:outline-none custom-scrollbar"
                      style={{ maxHeight: "120px" }}
                    />

                    {/* Barre d'outils inférieure intégrée */}
                    <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-white/5">
                      {/* Côté Gauche : Boutons Pills (+, Attach, Public) */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Bouton (+) */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickPresets(!showQuickPresets);
                            setShowAttachMenu(false);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition cursor-pointer ${
                            showQuickPresets
                              ? "bg-white text-black"
                              : "bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
                          }`}
                          title="Actions & Suggestions rapides"
                        >
                          <i className="fa-solid fa-plus"></i>
                        </button>

                        {/* Bouton Attach */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(!showAttachMenu);
                            setShowQuickPresets(false);
                          }}
                          className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                          title="Joindre un fichier ou une photo"
                        >
                          <i className="fa-solid fa-paperclip text-[10px]"></i>
                          <span>Attach</span>
                        </button>

                        {/* Badge Public / Modèle */}
                        <div
                          className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-[11px] font-medium flex items-center gap-1.5 select-none"
                          title={`Modèle IA actif : ${AI_MODELS.find((m) => m.id === selectedModel)?.name || selectedModel}`}
                        >
                          <i className="fa-solid fa-globe text-[10px] text-gray-400"></i>
                          <span>Public</span>
                        </div>
                      </div>

                      {/* Côté Droit : Forme d'onde Vocale + Bouton Flèche Haut */}
                      <div className="flex items-center gap-2">
                        {/* Forme d'onde Vocale (Voice Waveform) */}
                        <button
                          type="button"
                          onClick={startVoiceInput}
                          className={`px-2 py-1 text-xs rounded-full transition flex items-center justify-center cursor-pointer ${
                            isListeningVoice
                              ? "text-emerald-400 bg-emerald-950/60 border border-emerald-500/50 animate-pulse"
                              : "text-gray-400 hover:text-white"
                          }`}
                          title={isListeningVoice ? "Écoute en cours..." : "Saisie vocale"}
                        >
                          <i className="fa-solid fa-microphone text-sm"></i>
                        </button>

                        {/* Bouton Rond Blanc avec Flèche Noire vers le Haut */}
                        <button
                          type="submit"
                          disabled={(!inputText.trim() && !selectedAttachment) || isGenerating}
                          className="w-8 h-8 rounded-full bg-white text-black hover:bg-gray-200 disabled:opacity-25 disabled:hover:bg-white transition-all flex items-center justify-center font-black text-sm shadow-md cursor-pointer disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                          title="Envoyer le message (Entrée)"
                        >
                          <i className="fa-solid fa-arrow-up text-xs font-black"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
