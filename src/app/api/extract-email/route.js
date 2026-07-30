import { NextResponse } from "next/server";
import { extractJobAnnouncementWithGemini } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucune image fournie." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const check = validateUploadedFile(buffer, file.type, file.size);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "L'Extracteur ne lit que des images (photo de l'annonce)." }, { status: 415 });
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

    // Analyse de l'image de recrutement via Gemini 2.5 Flash
    const analysis = await extractJobAnnouncementWithGemini(buffer, file.type);

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
      console.error("[Extract Email Error]", analysis.error);
      return NextResponse.json(
        {
          success: false,
          error: analysis.error || "Erreur lors de l'analyse avec Gemini.",
        },
        { status: 400 }
      );
    }

    if (!analysis?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucune adresse e-mail détectée sur cette affiche. Essayez une photo plus nette ou mieux cadrée.",
          details: analysis,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      email: analysis.email.toLowerCase(),
      job_title: analysis.job_title || null,
      company: analysis.company || null,
      contract_type: analysis.contract_type || null,
    });
  } catch (error) {
    console.error("[Extract Email Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de l'analyse avec Gemini.",
      },
      { status: 400 }
    );
  }
}
