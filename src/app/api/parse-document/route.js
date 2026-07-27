import { NextResponse } from "next/server";
import { extractTextFromFile, mapTextToProfileFields } from "@/lib/documentParser";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawText = await extractTextFromFile(buffer, file.name, file.type);
    const fields = mapTextToProfileFields(rawText);

    return NextResponse.json({ fields, rawTextLength: rawText.length });
  } catch (error) {
    console.error("Erreur d'extraction du document:", error);
    return NextResponse.json(
      { error: "Impossible d'analyser le contenu du document." },
      { status: 500 }
    );
  }
}
