import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";

export const runtime = "nodejs";
// L'OCR (Vision + repli Tesseract, jusqu'à ~33s dans le pire cas) doit avoir
// le temps de se terminer proprement avant que Vercel ne tue la fonction —
// sans quoi le client reste bloqué en attente d'une réponse qui n'arrive jamais.
export const maxDuration = 55;

// Même expression que mapTextToProfileFields (src/lib/documentParser.js) :
// on reste cohérent avec la détection d'e-mail déjà utilisée ailleurs dans l'app.
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export async function POST(req) {
  try {
    // OCR = opération coûteuse en CPU : jamais accessible sans authentification
    // ni limite de débit, sans quoi n'importe qui peut la faire tourner en
    // boucle (déni de service / explosion de coûts serveur).
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

    // Réutilise l'OCR déjà en place pour les images (tesseract.js, fra+eng).
    const text = await extractTextFromFile(buffer, file.name, file.type);
    const match = text.match(EMAIL_REGEX);

    if (!match) {
      return NextResponse.json({
        success: false,
        error: "Aucune adresse e-mail détectée sur cette image. Essayez une photo plus nette ou mieux cadrée.",
      });
    }

    return NextResponse.json({ success: true, email: match[0].toLowerCase() });
  } catch (error) {
    console.error("[Extract Email Route Error]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'analyse de l'image." },
      { status: 500 }
    );
  }
}
