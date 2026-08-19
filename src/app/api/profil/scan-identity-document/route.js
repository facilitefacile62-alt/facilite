import { NextResponse } from "next/server";
import { extractIdentityFieldsWithGemini } from "@/lib/documentParser";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Traitement 100% éphémère d'une pièce d'identité (CNI/passeport) : l'image
 * n'est JAMAIS écrite en Storage, en base, ni journalisée — traitée en
 * mémoire pour la durée de cette seule requête, puis perdue à la fin de
 * l'exécution (rien n'a jamais été persisté, donc rien à supprimer, y
 * compris en cas d'erreur/timeout — la garantie vient de l'absence totale
 * d'écriture, pas d'un nettoyage après coup). Seuls nom/prénom/quartier
 * ressortent de ce module ; le buffer image n'est lu que par
 * extractIdentityFieldsWithGemini (documentParser.js), jamais par un appel
 * .storage.upload() nulle part dans ce fichier.
 *
 * Distinct de /api/documents/classify et /api/parse-document : ceux-ci
 * traitent CV/lettres de motivation (upload Storage légitime, extraction
 * large). Ce endpoint est le seul point d'entrée pour une pièce d'identité,
 * utilisé en amont dans profil/page.js (handleImportAndParseCv) — un
 * document reconnu comme pièce d'identité ne doit jamais atteindre le
 * chemin CV/Storage.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const check = validateUploadedFile(buffer, file.type, file.size);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const result = await extractIdentityFieldsWithGemini(buffer, file.type || "image/jpeg");

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      isIdentityDocument: result.isIdentityDocument,
      nom: result.nom,
      prenom: result.prenom,
      quartier: result.quartier,
    });
  } catch (error) {
    // Jamais le buffer ni les champs extraits dans ce log — seulement le
    // message d'erreur technique, y compris pour Sentry (aucune donnée
    // utilisateur transmise ici).
    console.error("[Scan Identity Document Error]", error.message);
    return NextResponse.json({ error: "Erreur lors de l'analyse du document." }, { status: 500 });
  }
}
