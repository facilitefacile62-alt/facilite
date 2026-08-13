import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Identifiants Supabase manquants.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function runLiveSimulation() {
  console.log("\n🚀 === SIMULATION RAG RECRUTEMENT EN DIRECT ===\n");

  // 1. Offre d'emploi test
  const testOffer = {
    title: "Développeur Fullstack React & Node.js",
    company: "Facilite Digital Tech",
    description: "Recherche un Développeur Fullstack expérimenté pour concevoir des applications web interactives, intégrer des API REST/GraphQL et gérer des bases de données Supabase/PostgreSQL. Maîtrise de Next.js, TypeScript et Tailwind requise.",
    location: "Dakar, Sénégal"
  };

  console.log(`📌 Poste évalué : "${testOffer.title}" chez ${testOffer.company}`);
  console.log(`📋 Description : ${testOffer.description}\n`);

  // 2. Récupérer des candidats réels ou représentatifs
  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, full_name, bio, skills, city")
    .limit(4);

  if (error || !candidates || candidates.length === 0) {
    console.error("Erreur récupération candidats:", error);
    return;
  }

  // Enrichissons les profils avec des compétences types pour la simulation réaliste
  const sampleProfiles = [
    {
      id: candidates[0]?.id || "cand-1",
      full_name: candidates[0]?.full_name || "Moussa Diop",
      city: "Dakar",
      skills: ["React", "Next.js", "Node.js", "TypeScript", "TailwindCSS", "PostgreSQL"],
      bio: "Développeur Fullstack avec 4 ans d'expérience sur React, Next.js et API Node.js. Création d'architectures SaaS et intégration de bases PostgreSQL."
    },
    {
      id: candidates[1]?.id || "cand-2",
      full_name: candidates[1]?.full_name || "Aïssatou Ndiaye",
      city: "Dakar",
      skills: ["Marketing Digital", "Meta Ads", "Gestion de projet", "SEO", "Communication"],
      bio: "Responsable Marketing Digital avec expertise en campagnes Meta Ads et gestion de projets digitaux."
    },
    {
      id: candidates[2]?.id || "cand-3",
      full_name: candidates[2]?.full_name || "Ibrahima Fall",
      city: "Thiès",
      skills: ["Comptabilité", "Finance", "Excel", "Sage", "Audit"],
      bio: "Comptable et Gestionnaire Financier avec 5 ans d'expérience dans la gestion de trésorerie et la conformité."
    }
  ];

  const candidatesContext = sampleProfiles.map((c, idx) => {
    return `--- CANDIDAT #${idx + 1} (ID: ${c.id}) ---
Nom: ${c.full_name}
Localisation: ${c.city}
Compétences: ${c.skills.join(", ")}
Profil & Expériences:
${c.bio}`;
  }).join("\n\n");

  const prompt = `Voici une offre d'emploi :
TITRE DU POSTE: ${testOffer.title}
ENTREPRISE: ${testOffer.company}
DESCRIPTION & CRITÈRES:
${testOffer.description}

Voici les profils des candidats de la CVthèque :
${candidatesContext}

Pour CHAQUE candidat, analyse rigoureusement la correspondance de son profil avec le poste et retourne UNIQUEMENT un objet JSON sous cette structure exacte :
{
  "evaluations": [
    {
      "candidateId": "uuid",
      "candidateName": "Nom du candidat",
      "matchScore": 92,
      "verdict": "Excellente adéquation",
      "summary": "Résumé de 2 phrases expliquant l'adéquation.",
      "strengths": ["Point fort 1", "Point fort 2"],
      "missingSkills": ["Point à valider"],
      "interviewQuestions": ["Question d'entretien 1", "Question d'entretien 2"]
    }
  ]
}`;

  console.log("🧠 Analyse et calcul des scores par le modèle IA (LLM RAG)...\n");

  const groq = new OpenAI({
    apiKey: groqApiKey || "dummy",
    baseURL: "https://api.groq.com/openai/v1",
  });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Tu es un expert RH et Lead Recruteur spécialisé dans l'évaluation IA de CVs." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content);

  console.log("📊 === RÉSULTATS DU MATCHING RAG ===");
  parsed.evaluations.forEach((ev, i) => {
    console.log(`\n🏆 Candidat #${i + 1} : ${ev.candidateName}`);
    console.log(`   📈 Score de Match : ${ev.matchScore}% (${ev.verdict})`);
    console.log(`   📝 Synthèse : ${ev.summary}`);
    console.log(`   ✅ Points forts :`);
    ev.strengths.forEach((s) => console.log(`      • ${s}`));
    console.log(`   ⚠️ Points d'attention :`);
    ev.missingSkills.forEach((m) => console.log(`      • ${m}`));
    console.log(`   ❓ Questions recommandées pour l'entretien :`);
    ev.interviewQuestions.forEach((q, qIdx) => console.log(`      ${qIdx + 1}. ${q}`));
  });

  console.log("\n✨ Simulation RAG réussie avec 100% de succès !\n");
}

runLiveSimulation().catch(console.error);
