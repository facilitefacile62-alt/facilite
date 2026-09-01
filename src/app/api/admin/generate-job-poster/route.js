import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Route API /api/admin/generate-job-poster
 * Générateur d'affiches de recrutement par IA au format carré 1:1 (1024x1024).
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const supabaseAdmin = getSupabaseAdmin();

    // Vérifier rôle admin ou recruteur
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "recruiter")) {
      return NextResponse.json({ error: "Accès réservé aux administrateurs et recruteurs." }, { status: 403 });
    }

    const body = await req.json();
    const rawPrompt = body?.prompt?.trim();
    const title = body?.title?.trim() || "";
    const company = body?.company?.trim() || "";

    if (!rawPrompt && !title) {
      return NextResponse.json(
        { error: "Veuillez fournir un prompt ou un titre pour générer l'affiche." },
        { status: 400 }
      );
    }

    // Amélioration du prompt pour un rendu professionnel format 1:1
    const baseSubject = rawPrompt || `Professional job hiring recruitment banner for ${title} at ${company} in Dakar Senegal`;
    const enrichedPrompt = `${baseSubject}, 1:1 aspect ratio square composition, premium modern corporate graphic design, sharp lighting, vibrant colors, cinematic photography, high resolution 8k, ultra-detailed, professional marketing poster, social media ready`;

    const encodedPrompt = encodeURIComponent(enrichedPrompt);
    const seed = Math.floor(Math.random() * 10000000);
    
    // Génération 1024x1024 (Format 1:1) via le moteur IA haute définition
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    console.log(`[AI Poster Generator] Génération de l'image 1:1 pour prompt: "${rawPrompt || title}"`);

    const imageRes = await fetch(pollinationsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!imageRes.ok) {
      throw new Error(`Échec du moteur de rendu IA (${imageRes.status})`);
    }

    const imageArrayBuffer = await imageRes.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    // Upload direct de l'image générée dans le bucket Supabase Storage
    const fileName = `generated_poster_1x1_${Date.now()}_${seed}.jpg`;
    
    let publicUrl = "";
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from("job-offers")
      .upload(`ai-generated/${fileName}`, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (!uploadErr && uploadData?.path) {
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("job-offers")
        .getPublicUrl(uploadData.path);
      publicUrl = publicUrlData?.publicUrl || "";
    }

    // Fallback si bucket local
    if (!publicUrl) {
      const base64Data = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
      publicUrl = base64Data;
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      promptUsed: enrichedPrompt,
      seed,
    });
  } catch (error) {
    console.error("[AI Poster Generator Exception]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
