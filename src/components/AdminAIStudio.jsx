"use client";

import { useState, useEffect, useRef } from "react";

// Profils prédéfinis d'assistants Facilité
const PRESET_ROLES = [
  {
    id: "general",
    apiRole: "custom",
    name: "Assistant Général Facilité",
    icon: "🤖",
    badge: "Principal",
    description: "Accompagnement général, navigation, services et orientation des utilisateurs.",
    defaultPrompt: `Tu es l'assistant IA officiel de la plateforme "Facilité" (https://ffacilite.com/), fondée par Macoumba Samake au Sénégal.
Facilité est un écosystème numérique tout-en-un d'insertion professionnelle, de rédaction de CVs ATS, de recrutement intelligent et d'accompagnement administratif.

Consignes obligatoires :
1. Tu es trilingue : réponds en Français, en Wolof ou en Anglais selon la langue de l'utilisateur.
2. Ton ton est chaleureux, très poli, bienveillant, professionnel et encourageant.
3. Tarifs Facilité : CV Professionnel Standard = 1 000 FCFA, CV Version Anglaise = 2 500 FCFA, CV Canadien = 2 500 FCFA, Lettre de motivation = 1 500 FCFA.
4. Si la question sort du cadre de l'emploi, du CV ou des services de Facilité, ramène poliment la discussion vers l'insertion professionnelle.`,
    defaultKnowledge: `Fondateur : Macoumba Samake
Site web officiel : https://ffacilite.com
Devise : FCFA (XOF)
Services : CV ATS, Lettres de motivation, Coaching entretien, Recrutement spontané dans 77 entreprises, Dépôts physiques en stations-services.
Délais de livraison des CVs personnalisés : 15 minutes à 2 heures.`,
    quickPrompts: [
      "Quels sont vos tarifs pour créer un CV ?",
      "Qui a fondé la plateforme Facilité ?",
      "Comment postuler aux offres de recrutement spontané ?",
      "Naka liggéey bi ? (Test Wolof)",
    ],
  },
  {
    id: "cv",
    apiRole: "cv",
    name: "Expert Rédaction CV & ATS",
    icon: "📄",
    badge: "CV & Lettre",
    description: "Optimisation de CV, respect des normes ATS, phrases d'accroche et élimination des erreurs.",
    defaultPrompt: `Tu es un expert senior en recrutement et en optimisation de CVs selon les standards ATS (Applicant Tracking Systems) internationaux et du marché sénégalais/ouest-africain.

Tes missions :
1. Structurer les expériences avec la méthode STAR (Situation, Tâche, Action, Résultat mesurable).
2. Utiliser des verbes d'action percutants et éliminer les formulations passives.
3. Adapter le CV aux mots-clés de l'offre d'emploi visée.
4. Corriger impitoyablement toute faute d'orthographe ou de syntaxe.
5. Proposer des phrases d'accroche captivantes et des compétences clés adaptées au poste.`,
    defaultKnowledge: `Standards ATS : Typographie claire sans tableaux complexes, titres de sections standards (Expériences, Formations, Compétences), format PDF texte sélectionnable.
Formats supportés sur Facilité : Standard Sénégalais (1000 FCFA), Canadien (2500 FCFA), Anglais / International (2500 FCFA).`,
    quickPrompts: [
      "Rédige une accroche percutante pour un CV de Comptable à Dakar",
      "Comment transformer mon expérience en points d'impact chiffrés ?",
      "Quelles sont les compétences indispensables pour un Développeur Web ?",
      "Donne-moi un modèle de lettre de motivation courte",
    ],
  },
  {
    id: "coach",
    apiRole: "coach",
    name: "Coach Entretien d'Embauche",
    icon: "💼",
    badge: "Entretien RH",
    description: "Simulation d'entretiens, réponses aux questions pièges et négociation de salaire.",
    defaultPrompt: `Tu es un Coach RH expert en préparation aux entretiens d'embauche au Sénégal et à l'international.

Consignes pédagogiques :
1. Entraîne le candidat avec des simulations interactives (pose-lui une question, écoute sa réponse et donne un feedback constructif).
2. Aide à répondre aux questions classiques et pièges : 'Parlez-moi de vous', 'Vos qualités et défauts', 'Pourquoi vous et pas un autre ?'.
3. Donne des conseils précis sur la négociation du salaire en FCFA ou devises locales.
4. Encourage et renforce la confiance du candidat.`,
    defaultKnowledge: `Marché du travail : Salaire net vs brut, grille indiciaire, prétentions salariales réalistes à Dakar et en Afrique de l'Ouest.
Attitude en entretien : Posture, écoute active, questions pertinentes à poser au recruteur en fin d'entretien.`,
    quickPrompts: [
      "Faisons une simulation : pose-moi la première question d'un entretien RH",
      "Comment répondre à la question : 'Quel est votre principal défaut ?'",
      "Comment négocier mon salaire lors d'une embauche à Dakar ?",
      "Quelles questions poser au recruteur à la fin de l'entretien ?",
    ],
  },
  {
    id: "orientation",
    apiRole: "orientation",
    name: "Conseiller Orientation & Carrière",
    icon: "🧭",
    badge: "Orientation",
    description: "Démarches administratives, reconversion professionnelle et formations.",
    defaultPrompt: `Tu es un Conseiller d'orientation professionnelle et administrative spécialisé sur l'écosystème sénégalais et africain.

Tes missions :
1. Guider les jeunes diplômés et professionnels dans leur choix de carrière et reconversion.
2. Expliquer simplement les démarches administratives numériques au Sénégal.
3. Conseiller sur les formations e-learning et les compétences numériques en forte demande (Tech, Digital, Gestion).`,
    defaultKnowledge: `Démarches au Sénégal : CNI biométrique CEDEAO, casier judiciaire en ligne, légalisation de diplômes, inscription aux concours publics.`,
    quickPrompts: [
      "Quels sont les métiers qui recrutent le plus actuellement au Sénégal ?",
      "Comment entamer une reconversion dans le numérique sans diplôme en informatique ?",
      "Quelles démarches pour faire légaliser mes diplômes ?",
      "Quelles compétences apprendre en priorité en 2026 ?",
    ],
  },
];

const TEMPLATES_PRESETS = [
  {
    name: "Standard Bienveillant & Marché Sénégalais",
    promptModifier: "Adopte un ton très bienveillant, chaleureux, structuré avec des exemples ancrés dans les réalités professionnelles du Sénégal et de l'Afrique de l'Ouest. Sois trilingue Français/Wolof/Anglais.",
  },
  {
    name: "Recruteur Exigeant & Strict ATS",
    promptModifier: "Agis comme un recruteur de cabinet international très rigoureux. Chaque conseil doit être direct, sans complaisance, axé sur les résultats chiffrés et la conformité ATS absolue.",
  },
  {
    name: "Coach Motivation & Concision",
    promptModifier: "Réponds toujours de manière ultra synthétique (maximum 3 à 5 points clés à puces). Utilise des émojis professionnels et termine toujours par une phrase motivante d'encouragement.",
  },
];

export default function AdminAIStudio() {
  const [selectedRole, setSelectedRole] = useState(PRESET_ROLES[0]);
  const [systemPrompt, setSystemPrompt] = useState(PRESET_ROLES[0].defaultPrompt);
  const [knowledgeBase, setKnowledgeBase] = useState(PRESET_ROLES[0].defaultKnowledge);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(800);
  const [preferredLang, setPreferredLang] = useState("auto");

  // État du Bac à Sable (Playground Test)
  const [chatMessages, setChatMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: `👋 Bonjour ! Je suis prêt pour vos tests d'entraînement.\n\nTapez un message ou cliquez sur un des scénarios rapides ci-dessous pour tester mes réponses avec vos consignes actuelles.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResponseTimeMs, setLastResponseTimeMs] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const chatScrollRef = useRef(null);

  // Charger la configuration sauvegardée pour ce rôle si existante
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(`FACILITE_AI_TRAINING_${selectedRole.id}`);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.systemPrompt) setSystemPrompt(parsed.systemPrompt);
        if (parsed.knowledgeBase) setKnowledgeBase(parsed.knowledgeBase);
        if (typeof parsed.temperature === "number") setTemperature(parsed.temperature);
        if (parsed.maxTokens) setMaxTokens(parsed.maxTokens);
        if (parsed.preferredLang) setPreferredLang(parsed.preferredLang);
      } else {
        setSystemPrompt(selectedRole.defaultPrompt);
        setKnowledgeBase(selectedRole.defaultKnowledge);
      }
    } catch {
      setSystemPrompt(selectedRole.defaultPrompt);
      setKnowledgeBase(selectedRole.defaultKnowledge);
    }
  }, [selectedRole]);

  // Scroll en bas du chat de test lors de nouveaux messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isGenerating]);

  // Changement de rôle
  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setChatMessages([
      {
        id: `switch_${role.id}_${Date.now()}`,
        role: "assistant",
        content: `🎯 **Mode actif : ${role.name}**\n\nPrêt pour vos tests avec les directives de ce profil. Posez-moi vos questions d'évaluation !`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  // Sauvegarder les instructions
  const handleSaveInstructions = () => {
    try {
      const config = {
        roleId: selectedRole.id,
        systemPrompt,
        knowledgeBase,
        temperature,
        maxTokens,
        preferredLang,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`FACILITE_AI_TRAINING_${selectedRole.id}`, JSON.stringify(config));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error("Erreur sauvegarde config IA:", e);
    }
  };

  // Réinitialiser les instructions par défaut
  const handleResetDefaults = () => {
    if (confirm("Réinitialiser les directives de ce rôle aux valeurs recommandées par défaut ?")) {
      setSystemPrompt(selectedRole.defaultPrompt);
      setKnowledgeBase(selectedRole.defaultKnowledge);
      setTemperature(0.7);
      localStorage.removeItem(`FACILITE_AI_TRAINING_${selectedRole.id}`);
    }
  };

  // Appliquer un template de prompt rapide
  const handleApplyTemplate = (tmpl) => {
    setSystemPrompt((prev) => `${prev.trim()}\n\n[Directive complémentaire : ${tmpl.name}]\n${tmpl.promptModifier}`);
  };

  // Envoi d'un message dans le Bac à Sable
  const handleSendMessage = async (customQuery = null) => {
    const textToSend = customQuery || inputText.trim();
    if (!textToSend || isGenerating) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setInputText("");
    setIsGenerating(true);

    const startTime = Date.now();

    // Assemblage du prompt complet avec base de connaissances
    const fullSystemPrompt = `
${systemPrompt.trim()}

--- BASE DE CONNAISSANCES OFFICIELLE & FAITS MÉTIER FACILITÉ ---
${knowledgeBase.trim()}

--- CONSIGNES DE LANGUE & FORMAT ---
Langue demandée : ${preferredLang === "auto" ? "Selon la langue de l'utilisateur (Français, Wolof ou Anglais)" : preferredLang}
Longueur maximale estimée : ${maxTokens} jetons.
`.trim();

    try {
      // Préparation de l'historique filtré (uniquement user/assistant)
      const apiMessages = newHistory
        .filter((m) => m.id !== "welcome" && !m.id.startsWith("switch_"))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          activeAiRole: selectedRole.apiRole,
          customSystemPrompt: fullSystemPrompt,
          temperature: temperature,
        }),
      });

      const data = await res.json();
      const elapsedMs = Date.now() - startTime;
      setLastResponseTimeMs(elapsedMs);

      if (!res.ok) {
        throw new Error(data.error || `Erreur serveur ${res.status}`);
      }

      const aiReplyText = data.reply || data.content || "Je n'ai pas pu générer de réponse avec ces paramètres.";
      
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: "assistant",
          content: aiReplyText,
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
          content: `⚠️ **Erreur d'entraînement :** ${err.message || "Impossible de joindre l'API d'entraînement."}\n\n*Vérifiez la clé API ou réduisez la longueur du prompt.*`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isError: true,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearTestChat = () => {
    setChatMessages([
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        content: `🧹 **Session de test réinitialisée.**\n\nPrêt pour de nouveaux scénarios avec vos directives actuelles.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. EN-TÊTE DU STUDIO AVEC STATUS & ACTIONS RAPIDES */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2.5">
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Studio IA & Prompt Engineering
            </span>
            <span className="bg-indigo-500/20 text-indigo-300 text-xs font-black px-3 py-1 rounded-full border border-indigo-500/30">
              DeepSeek / Gemini Vision / Groq
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>🧠 Formation & Test de l'Assistant IA</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
            Configurez les directives, enrichissez la base de connaissances et testez en direct le comportement de vos modèles IA avant déploiement aux utilisateurs.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveInstructions}
            className={`px-5 py-3 rounded-2xl font-extrabold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              savedSuccess
                ? "bg-emerald-500 text-white scale-105"
                : "bg-gradient-to-r from-[#10E688] to-emerald-500 hover:from-[#10E688]/90 hover:to-emerald-600 text-gray-950 font-black"
            }`}
          >
            <i className={`fa-solid ${savedSuccess ? "fa-circle-check" : "fa-floppy-disk"}`}></i>
            <span>{savedSuccess ? "Directives Déployées !" : "Sauvegarder & Déployer"}</span>
          </button>
        </div>
      </div>

      {/* 2. SÉLECTEUR DE RÔLE / PROFIL D'IA À FORMER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PRESET_ROLES.map((role) => {
          const isSelected = selectedRole.id === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => handleSelectRole(role)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                isSelected
                  ? "bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-md transform -translate-y-0.5"
                  : "bg-white/80 hover:bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{role.icon}</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {role.badge}
                </span>
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 leading-snug">{role.name}</h3>
                <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{role.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. GRILLE PRINCIPALE : CONFIGURATION (GAUCHE) & BAC À SABLE / PLAYGROUND (DROITE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLONNE GAUCHE (5/12) : ÉDITEUR D'INSTRUCTIONS & PARAMÈTRES */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Section 1 : Directives Système (System Prompt) */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <i className="fa-solid fa-code text-indigo-600"></i>
                  <span>Directives & Prompt Système</span>
                </h2>
                <p className="text-[11px] text-gray-500 font-medium">Définissez la personnalité et les règles de l'IA</p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] font-bold text-gray-400 hover:text-red-600 transition cursor-pointer"
                title="Rétablir les consignes par défaut"
              >
                <i className="fa-solid fa-rotate-left mr-1"></i>
                Défaut
              </button>
            </div>

            {/* Presets rapides de style */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-600 block">
                Ajouter une consigne rapide (Templates) :
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES_PRESETS.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="text-[10px] font-bold bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 transition cursor-pointer"
                  >
                    + {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone de saisie du System Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-gray-800">
                  Instructions détaillées :
                </label>
                <span className="text-[10px] font-bold text-gray-400">
                  {systemPrompt.length} caractères
                </span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={9}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono text-gray-900 leading-relaxed focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-y"
                placeholder="Écrivez vos instructions système ici..."
              />
            </div>
          </div>

          {/* Section 2 : Base de Connaissances Spécifique (Knowledge Base) */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <i className="fa-solid fa-book-bookmark text-emerald-600"></i>
                <span>Base de Connaissances & Faits Métier</span>
              </h2>
              <p className="text-[11px] text-gray-500 font-medium">Informations officielles, prix et services à respecter</p>
            </div>

            <textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              rows={5}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono text-gray-900 leading-relaxed focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-y"
              placeholder="Tarifs, contacts, délais, règles indispensables..."
            />
          </div>

          {/* Section 3 : Hyperparamètres (Température, Langue, Longueur) */}
          <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <i className="fa-solid fa-sliders text-amber-500"></i>
              <span>Paramètres de Génération</span>
            </h2>

            {/* Slider Température */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-gray-800">
                  Créativité / Température : <strong className="text-indigo-600">{temperature}</strong>
                </span>
                <span className="text-[10px] text-gray-500 font-medium">
                  {temperature <= 0.3 ? "🎯 Très factuel / Précis" : temperature <= 0.7 ? "⚖️ Équilibré" : "🎨 Créatif & Éloquent"}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Sélecteur de Langue */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Langue par défaut :
                </label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="auto">🌐 Automatique (FR/Wolof/EN)</option>
                  <option value="Français">🇫🇷 Français obligatoire</option>
                  <option value="Wolof">🇸🇳 Wolof prioritaire</option>
                  <option value="Anglais">🇬🇧 Anglais</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Longueur max :
                </label>
                <select
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value={400}>Court & Synthétique (400)</option>
                  <option value={800}>Standard Équilibré (800)</option>
                  <option value={1500}>Détaillé & Approfondi (1500)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE (7/12) : BAC À SABLE / PLAYGROUND TEST EN DIRECT */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-md flex flex-col h-[760px] overflow-hidden">
            
            {/* Header du Chat Playground */}
            <div className="p-4 sm:p-5 border-b border-gray-150 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between gap-3 flex-none">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  {selectedRole.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-gray-900 truncate">
                      Playground : {selectedRole.name}
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      Directives actives
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    Température : {temperature} • Modèle : DeepSeek Chat
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearTestChat}
                className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Effacer l'historique du test"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
                <span className="hidden sm:inline">Effacer</span>
              </button>
            </div>

            {/* Scénarios de test rapide (1-Click Prompts) */}
            <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-indigo-100/60 flex items-center gap-2 overflow-x-auto flex-none scrollbar-none">
              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
                <i className="fa-solid fa-bolt text-amber-500"></i>
                Tests rapides :
              </span>
              {selectedRole.quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  disabled={isGenerating}
                  className="text-[11px] font-bold bg-white hover:bg-indigo-600 hover:text-white text-gray-800 px-3 py-1 rounded-full border border-indigo-200 transition-all flex-shrink-0 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Zone de Messages (Scrollable) */}
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FAF9F6]"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-start gap-2.5`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 shadow-xs mt-0.5">
                      {selectedRole.icon}
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 space-y-1.5 shadow-xs ${
                      msg.role === "user"
                        ? "bg-[#2563EB] text-white rounded-tr-xs"
                        : msg.isError
                        ? "bg-red-50 text-red-900 border border-red-200 rounded-tl-xs"
                        : "bg-white text-gray-900 border border-gray-200/80 rounded-tl-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] opacity-70 font-semibold mb-1">
                      <span>{msg.role === "user" ? "Administrateur (Testeur)" : selectedRole.name}</span>
                      <span>{msg.time}</span>
                    </div>

                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.content}
                    </div>

                    {msg.elapsedMs && (
                      <div className="pt-1.5 text-[9px] text-gray-400 font-mono flex items-center gap-1 border-t border-gray-100">
                        <i className="fa-solid fa-stopwatch text-indigo-500"></i>
                        <span>Généré en {(msg.elapsedMs / 1000).toFixed(2)}s • Directives appliquées</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex justify-start items-center gap-2.5 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
                    {selectedRole.icon}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-600 font-bold flex items-center space-x-2 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                    <span>L'IA analyse vos instructions et génère sa réponse...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Zone de saisie du message */}
            <div className="p-3 sm:p-4 bg-white border-t border-gray-200 flex-none">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Tester une consigne avec ${selectedRole.name}...`}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition disabled:opacity-50 font-medium"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isGenerating}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span className="hidden sm:inline">Tester</span>
                </button>
              </form>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
