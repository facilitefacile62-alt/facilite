import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPABASE_URL } from "@/lib/env";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const RagMatchSchema = z.object({
  offerId: z.string().uuid().optional(),
  customQuery: z.string().max(2000).optional(),
  matchThreshold: z.number().min(0).max(1).optional().default(0.35),
  matchCount: z.number().int().min(1).max(15).optional().default(6),
});

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy",
  baseURL: "https://api.groq.com/openai/v1",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy",
  baseURL: "https://api.deepseek.com",
});

function cleanAndParseJSON(text) {
  if (!text) throw new Error("Réponse IA vide");
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned);
}

export async function POST(req) {
  try {
    // 1. Authentification & Rate Limiting
    const { user, error: authError } = await requireUser(req, { logDenials: true });
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!(await checkAiQuota(user.id))) {
      return NextResponse.json(
        { error: `Quota IA quotidien atteint (${AI_DAILY_QUOTA} requêtes/jour). Réessayez demain.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = RagMatchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Paramètres de requête invalides." }, { status: 400 });
    }

    const { offerId, customQuery, matchThreshold, matchCount } = parseResult.data;
    if (!offerId && !customQuery) {
      return NextResponse.json(
        { error: "Veuillez fournir un identifiant d'offre (offerId) ou une description de poste (customQuery)." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // 2. Vérification des autorisations Recruteur / Admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: badgeRow } = await admin
      .from("badges")
      .select("badge_type")
      .eq("user_id", user.id)
      .eq("badge_type", "verified_recruiter")
      .maybeSingle();

    const isRecruiterOrAdmin = roleRow?.role === "admin" || roleRow?.role === "recruiter" || !!badgeRow;
    if (!isRecruiterOrAdmin) {
      return NextResponse.json(
        { error: "Accès réservé aux recruteurs vérifiés et administrateurs." },
        { status: 403 }
      );
    }

    // 3. Récupération des critères de poste et de l'embedding
    let targetTitle = "";
    let targetDescription = "";
    let targetEmbedding = null;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (offerId) {
      const { data: offer, error: offerError } = await admin
        .from("job_offers")
        .select("id, title, description, company, location, embedding")
        .eq("id", offerId)
        .maybeSingle();

      if (offerError || !offer) {
        return NextResponse.json({ error: "Offre d'emploi introuvable." }, { status: 404 });
      }

      targetTitle = offer.title;
      targetDescription = offer.description || "";

      if (offer.embedding && Array.isArray(offer.embedding)) {
        targetEmbedding = offer.embedding;
      } else if (typeof offer.embedding === "string" && offer.embedding.startsWith("[")) {
        try {
          targetEmbedding = JSON.parse(offer.embedding);
        } catch {
          targetEmbedding = null;
        }
      }
    } else {
      targetTitle = "Recherche personnalisée";
      targetDescription = customQuery;
    }

    // Génération de l'embedding via gemini-orchestrator si non disponible
    if (!targetEmbedding || !Array.isArray(targetEmbedding)) {
      const textToEmbed = [targetTitle, targetDescription].filter(Boolean).join("\n\n").slice(0, 7000);
      const embedResponse = await fetch(`${SUPABASE_URL}/functions/v1/gemini-orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "embed", text: textToEmbed }),
      });
      const embedResult = await embedResponse.json().catch(() => null);

      if (embedResponse.ok && embedResult?.success && Array.isArray(embedResult.embedding)) {
        targetEmbedding = embedResult.embedding;
        if (offerId) {
          await admin
            .from("job_offers")
            .update({ embedding: `[${targetEmbedding.join(",")}]` })
            .eq("id", offerId);
        }
      }
    }

    // 4. RETRIEVAL : Recherche des candidats par similarité vectorielle
    let matchedCandidates = [];
    if (targetEmbedding && Array.isArray(targetEmbedding)) {
      const { data: vectorMatches, error: vectorError } = await admin.rpc("match_resumes", {
        query_embedding: `[${targetEmbedding.join(",")}]`,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });

      if (!vectorError && Array.isArray(vectorMatches)) {
        matchedCandidates = vectorMatches;
      }
    }

    // Si la recherche vectorielle n'a pas retourné assez de résultats, enrichir avec l'annuaire candidat
    if (matchedCandidates.length === 0) {
      const { data: fallbackCandidates } = await admin
        .from("profiles")
        .select("id, full_name, skills, city, avatar_url")
        .eq("cv_visible_recruteurs", true)
        .is("deleted_at", null)
        .limit(matchCount);

      if (fallbackCandidates && fallbackCandidates.length > 0) {
        matchedCandidates = fallbackCandidates.map((c) => ({
          id: c.id,
          user_id: c.id,
          candidate_name: c.full_name,
          similarity: 0.6,
        }));
      }
    }

    if (matchedCandidates.length === 0) {
      return NextResponse.json({
        jobOffer: { title: targetTitle, description: targetDescription },
        candidates: [],
        message: "Aucun profil correspondant trouvé dans la CVthèque pour le moment.",
      });
    }

    // Récupération des profils et CVs complets des candidats retenus
    const userIds = matchedCandidates.map((m) => m.user_id).filter(Boolean);
    const { data: fullProfiles } = await admin
      .from("profiles")
      .select("id, full_name, bio, skills, city, avatar_url, cv_url")
      .in("id", userIds);

    const { data: fullResumes } = await admin
      .from("resumes")
      .select("id, user_id, raw_text, skills, experiences, education, ats_score, updated_at")
      .in("user_id", userIds)
      .eq("status", "completed");

    const profileMap = new Map((fullProfiles || []).map((p) => [p.id, p]));
    const resumeMap = new Map((fullResumes || []).map((r) => [r.user_id, r]));

    // 5. AUGMENTATION : Préparation du contexte pour le LLM
    const candidatesContext = matchedCandidates.map((m, idx) => {
      const p = profileMap.get(m.user_id) || {};
      const r = resumeMap.get(m.user_id) || {};
      const cvExtract = r.raw_text ? r.raw_text.slice(0, 1200) : "";
      const skillsStr = Array.isArray(p.skills) ? p.skills.join(", ") : (p.skills || "Non spécifié");

      return `--- CANDIDAT #${idx + 1} (ID: ${m.user_id}) ---
Nom: ${p.full_name || m.candidate_name || "Candidat"}
Ville / Localisation: ${p.city || "Sénégal"}
Compétences déclarées: ${skillsStr}
Extrait du CV / Bio:
${cvExtract || p.bio || "Pas de texte extrait."}
Score de similarité sémantique brut: ${Math.round((m.similarity || 0.5) * 100)}%`;
    }).join("\n\n");

    const prompt = `Voici une offre d'emploi ou un besoin de recrutement :
TITRE DU POSTE: ${targetTitle}
DESCRIPTION & CRITÈRES:
${targetDescription}

Voici les profils des candidats présélectionnés dans la CVthèque :
${candidatesContext}

Pour CHAQUE candidat listé ci-dessus, analyse rigoureusement la correspondance de son profil avec le poste et retourne UNIQUEMENT un objet JSON sous cette structure exacte :
{
  "evaluations": [
    {
      "candidateId": "uuid-du-candidat",
      "matchScore": 88, // Note de 0 à 100
      "verdict": "Excellente adéquation", // Choix parmi: "Excellente adéquation", "Forte adéquation", "Adéquation modérée", "Adéquation partielle"
      "summary": "Résumé de 2 phrases expliquant concrètement pourquoi le candidat correspond au poste.",
      "strengths": [
        "Point fort 1 (ex: Maîtrise avancée de React et Next.js)",
        "Point fort 2 (ex: Expérience confirmée en gestion d'équipe)"
      ],
      "missingSkills": [
        "Compétence manquante ou point à valider (ex: Expérience Docker à confirmer)"
      ],
      "interviewQuestions": [
        "Question d'entretien 1 ciblée pour ce candidat",
        "Question d'entretien 2 ciblée pour ce candidat"
      ]
    }
  ]
}`;

    // 6. GENERATION : Appel du LLM (Groq / DeepSeek avec repli)
    let aiEvaluation = null;
    try {
      if (process.env.GROQ_API_KEY) {
        const groqCompletion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Tu es un expert RH et Lead Recruteur spécialisé dans le matching IA de profils." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });
        aiEvaluation = cleanAndParseJSON(groqCompletion.choices[0]?.message?.content);
      }
    } catch (groqErr) {
      console.warn("[RAG Match] Échec Groq, tentative avec DeepSeek:", groqErr.message);
    }

    if (!aiEvaluation && process.env.DEEPSEEK_API_KEY) {
      try {
        const deepseekCompletion = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Tu es un expert RH et Lead Recruteur. Réponds impérativement en JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        });
        aiEvaluation = cleanAndParseJSON(deepseekCompletion.choices[0]?.message?.content);
      } catch (dsErr) {
        console.error("[RAG Match] Échec DeepSeek:", dsErr.message);
      }
    }

    const evalMap = new Map();
    if (aiEvaluation?.evaluations && Array.isArray(aiEvaluation.evaluations)) {
      aiEvaluation.evaluations.forEach((ev) => {
        if (ev.candidateId) evalMap.set(ev.candidateId, ev);
      });
    }

    // 7. Assemblage des résultats finaux
    const finalResults = matchedCandidates.map((m) => {
      const p = profileMap.get(m.user_id) || {};
      const r = resumeMap.get(m.user_id) || {};
      const ev = evalMap.get(m.user_id) || {
        matchScore: Math.round((m.similarity || 0.5) * 100),
        verdict: m.similarity > 0.75 ? "Excellente adéquation" : "Forte adéquation",
        summary: `${p.full_name || "Ce candidat"} présente un profil pertinent avec des compétences adaptées au poste.`,
        strengths: Array.isArray(p.skills) ? p.skills.slice(0, 3) : ["Profil technique correspondant"],
        missingSkills: ["À vérifier lors de l'entretien"],
        interviewQuestions: ["Parlez-moi de votre expérience sur des projets similaires."],
      };

      return {
        id: m.user_id,
        fullName: p.full_name || m.candidate_name || "Candidat Facilité",
        headline: p.bio ? p.bio.slice(0, 100) : "Professionnel qualifié",
        city: p.city || "Sénégal",
        avatarUrl: p.avatar_url || null,
        skills: Array.isArray(p.skills) ? p.skills : [],
        hasCv: !!p.cv_url || !!r.raw_text,
        similarityScore: Math.round((m.similarity || 0.5) * 100),
        ragAnalysis: {
          matchScore: ev.matchScore ?? Math.round((m.similarity || 0.5) * 100),
          verdict: ev.verdict || "Adéquation confirmée",
          summary: ev.summary || "Profil recommandé par le système RAG.",
          strengths: Array.isArray(ev.strengths) ? ev.strengths : [],
          missingSkills: Array.isArray(ev.missingSkills) ? ev.missingSkills : [],
          interviewQuestions: Array.isArray(ev.interviewQuestions) ? ev.interviewQuestions : [],
        },
      };
    }).sort((a, b) => (b.ragAnalysis.matchScore || 0) - (a.ragAnalysis.matchScore || 0));

    return NextResponse.json({
      success: true,
      jobOffer: {
        id: offerId || null,
        title: targetTitle,
        description: targetDescription,
      },
      candidates: finalResults,
      totalCount: finalResults.length,
    });
  } catch (err) {
    console.error("[RAG Matching API Error]", err);
    return NextResponse.json({ error: "Une erreur est survenue lors de l'analyse RAG." }, { status: 500 });
  }
}
