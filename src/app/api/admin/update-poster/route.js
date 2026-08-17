import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

const VALID_TARGETS = {
  s1: "affiche_cv_pro.jpg",
  s2: "affiche_boostez_carriere.jpg",
  s3: "affiche_cv_pro.jpg",
  s4: "affiche2.jpg",
  "affiche_cv_pro.jpg": "affiche_cv_pro.jpg",
  "affiche_boostez_carriere.jpg": "affiche_boostez_carriere.jpg",
  "affiche2.jpg": "affiche2.jpg",
};

export async function POST(req) {
  try {
    // 1. Authentification
    const { user, error: authError } = await requireUser(req, { logDenials: true });
    if (authError) return authError;

    // 2. Vérification RBAC Admin
    const admin = getSupabaseAdmin();
    if (!(await isCallerAdmin(admin, user.id))) {
      return NextResponse.json({ error: "Action réservée aux administrateurs." }, { status: 403 });
    }

    // 3. Récupération du formulaire multipart
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Données de formulaire invalides." }, { status: 400 });
    }

    const file = formData.get("file");
    const targetKey = formData.get("targetKey") || "s1";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté. Veuillez utiliser un fichier PNG, JPG ou WEBP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Le fichier dépasse la taille maximale de 10 Mo." }, { status: 400 });
    }

    const filename = VALID_TARGETS[targetKey] || "affiche_cv_pro.jpg";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Écriture sécurisée dans le répertoire public
    const publicDir = path.resolve(process.cwd(), "public");
    const filePath = path.join(publicDir, filename);

    await fs.writeFile(filePath, buffer);

    // Si on modifie affiche_cv_pro.jpg, synchroniser aussi les vignettes de modèles
    if (filename === "affiche_cv_pro.jpg") {
      const mirrors = ["model1.jpg", "photo1.jpg"];
      for (let i = 1; i <= 8; i++) mirrors.push(`model${i}.png`);
      for (const mirror of mirrors) {
        try {
          await fs.writeFile(path.join(publicDir, mirror), buffer);
        } catch {
          // ignore mirror copy errors
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `L'affiche (${filename}) a été mise à jour avec succès !`,
      url: `/${filename}?t=${Date.now()}`,
    });
  } catch (err) {
    console.error("[Admin Update Poster Error]", err);
    return NextResponse.json({ error: "Erreur serveur lors de la mise à jour de l'affiche." }, { status: 500 });
  }
}
