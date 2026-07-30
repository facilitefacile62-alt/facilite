import { NextResponse } from "next/server";
import { createWorker } from "tesseract.js";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier image n'a été fourni." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Initialisation du worker Tesseract.js pour l'analyse OCR
    const worker = await createWorker("fra+eng");
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();

    // Regex robuste pour l'extraction de l'adresse e-mail dans le texte OCR
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const match = text.match(emailRegex);

    if (!match) {
      return NextResponse.json({
        email: null,
        extractedText: text,
        message: "Aucune adresse e-mail détectée sur l'image."
      }, { status: 200 });
    }

    const extractedEmail = match[1].toLowerCase();

    return NextResponse.json({
      success: true,
      email: extractedEmail,
      extractedText: text
    });
  } catch (error) {
    console.error("Erreur API extract-email:", error);
    return NextResponse.json({ error: "Échec de l'analyse OCR de l'image." }, { status: 500 });
  }
}
