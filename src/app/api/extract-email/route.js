import { NextResponse } from "next/server";
import { extractJobAnnouncementWithGemini, extractJobAnnouncementFromTextWithGemini } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { checkAiQuota, AI_DAILY_QUOTA } from "@/lib/aiQuota";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    if (!(await checkAiQuota(user.id))) {
      return NextResponse.json(
        { error: `Quota IA quotidien atteint (${AI_DAILY_QUOTA} requêtes/jour). Réessayez demain.` },
        { status: 429 }
      );
    }

    // Vérification explicite de la clé d'API Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Clé API Gemini introuvable. Veuillez configurer GEMINI_API_KEY dans Vercel/env.",
        },
        { status: 400 }
      );
    }

    let analysis = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const jsonBody = await req.json().catch(() => ({}));
      const rawText = jsonBody.text || jsonBody.rawText || "";
      if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
        return NextResponse.json({ error: "Veuillez fournir le texte de l'annonce à examiner." }, { status: 400 });
      }
      analysis = await extractJobAnnouncementFromTextWithGemini(rawText);
    } else {
      const formData = await req.formData();
      const rawText = formData.get("text");
      const file = formData.get("file");

      if (rawText && typeof rawText === "string" && rawText.trim().length > 0) {
        analysis = await extractJobAnnouncementFromTextWithGemini(rawText);
      } else if (file && typeof file !== "string") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const check = validateUploadedFile(buffer, file.type, file.size);
        if (!check.valid) {
          return NextResponse.json({ error: check.error }, { status: check.status });
        }
        if (!file.type?.startsWith("image/")) {
          return NextResponse.json({ error: "L'Extracteur ne lit que des images (photo de l'annonce) ou du texte brut." }, { status: 415 });
        }
        analysis = await extractJobAnnouncementWithGemini(buffer, file.type);
      } else {
        return NextResponse.json({ error: "Aucun fichier image ni texte d'annonce fourni." }, { status: 400 });
      }
    }

    if (analysis?.errorKeyMissing) {
      return NextResponse.json(
        {
          success: false,
          error: analysis.error,
        },
        { status: 400 }
      );
    }

    if (analysis?.error) {
      console.error("[Extract Channels Error]", analysis.error);
      return NextResponse.json(
        {
          success: false,
          error: analysis.error || "Erreur lors de l'analyse avec Gemini.",
        },
        { status: 400 }
      );
    }

    // Extraction et normalisation des coordonnées
    const rawEmail = analysis?.email && typeof analysis.email === "string" && analysis.email.includes("@") ? analysis.email.trim().toLowerCase() : null;
    
    // Détection Téléphone / WhatsApp via notre helper
    const rawPhoneCandidate = analysis?.phone || analysis?.whatsapp;
    let detectedPhone = null;
    if (rawPhoneCandidate) {
      const cleaned = String(rawPhoneCandidate).replace(/\D/g, "");
      if (cleaned.length === 9 && /^(?:70|75|76|77|78|33)\d{7}$/.test(cleaned)) {
        detectedPhone = `221${cleaned}`;
      } else if (cleaned.length >= 8 && cleaned.length <= 15) {
        detectedPhone = cleaned;
      }
    }
    if (!detectedPhone && analysis?.raw_text) {
      // Fallback regex sur raw_text
      const snMatch = analysis.raw_text.match(/(?:\+?221|00221)?[\s.-]?(?:7[05678]|33)[\s.-]?[0-9]{2,3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/);
      if (snMatch) {
        const digits = snMatch[0].replace(/\D/g, "");
        if (digits.length === 9) detectedPhone = `221${digits}`;
        else if (digits.length >= 11) detectedPhone = digits;
      }
    }

    // Détection d'URL / Lien de formulaire
    let detectedUrl = analysis?.apply_url || analysis?.form_url || null;
    if (!detectedUrl && analysis?.raw_text) {
      const urlMatch = analysis.raw_text.match(/(https?:\/\/[^\s"'<>]+|forms\.gle\/[^\s"'<>]+|typeform\.com\/to\/[^\s"'<>]+)/i);
      if (urlMatch) {
        detectedUrl = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
      }
    }

    // Si AUCUN moyen de contact n'est trouvé
    if (!rawEmail && !detectedPhone && !detectedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun moyen de contact (e-mail, numéro WhatsApp ou formulaire) détecté sur cette affiche. Essayez une photo plus nette ou mieux cadrée.",
          details: analysis,
        },
        { status: 200 }
      );
    }

    const jobTitle = analysis.job_title || null;
    const company = analysis.company || null;
    
    // Génération du lien WhatsApp personnalisé
    let whatsappUrl = null;
    if (detectedPhone) {
      const greetingMsg = `Bonjour${company ? ` ${company}` : ""}, je vous contacte concernant votre offre de recrutement "${jobTitle || "ce poste"}" vue sur Facilité.`;
      whatsappUrl = `https://wa.me/${detectedPhone}?text=${encodeURIComponent(greetingMsg)}`;
    }

    const applicationEmail = (analysis?.application_email && typeof analysis.application_email === "string" && analysis.application_email.includes("@"))
      ? analysis.application_email.trim().toLowerCase()
      : rawEmail;

    return NextResponse.json({
      success: true,
      email: rawEmail,
      application_email: applicationEmail,
      phone: detectedPhone,
      whatsapp: detectedPhone,
      whatsapp_url: whatsappUrl,
      apply_url: detectedUrl,
      form_url: detectedUrl,
      job_title: jobTitle,
      company: company,
      contract_type: analysis.contract_type || null,
      location: analysis.location || null,
      salary: analysis.salary || null,
      deadline: analysis.deadline || null,
      skills: analysis.skills || null,
      summary: analysis.summary || null,
      instructions: analysis.instructions || null,
      additional_info: analysis.additional_info || null,
      raw_text: analysis.raw_text || null,
    });
  } catch (error) {
    console.error("[Extract Email Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Impossible d'analyser l'annonce pour le moment. Réessayez dans quelques instants.",
      },
      { status: 400 }
    );
  }
}
