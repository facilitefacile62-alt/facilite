import { NextResponse } from "next/server";
import { extractFullJobOfferFromPosterWithGemini } from "@/lib/documentParser";
import { requireUser } from "@/lib/apiAuth";
import { validateUploadedFile } from "@/lib/validation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { detectWhatsAppNumber, buildWhatsAppLink } from "@/lib/offerContact";
import { LISTING_TYPE_LABELS } from "@/lib/listingTypes";

export const runtime = "nodejs";
export const maxDuration = 45;

const VALID_LISTING_TYPES = Object.keys(LISTING_TYPE_LABELS);

export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const supabaseAdmin = getSupabaseAdmin();

    // Vérifier rôle admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleRow || roleRow.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const accompanyingText = formData.get("accompanying_text") || formData.get("description") || formData.get("text") || "";

    const hasFile = file && typeof file !== "string";
    const hasText = typeof accompanyingText === "string" && accompanyingText.trim().length > 0;

    if (!hasFile && !hasText) {
      return NextResponse.json({ error: "Veuillez fournir une affiche ou un texte descriptif de l'offre." }, { status: 400 });
    }

    let buffer = null;
    let fileMime = "image/jpeg";
    let uploadedImageUrl = "";

    if (hasFile) {
      buffer = Buffer.from(await file.arrayBuffer());
      fileMime = file.type || "image/jpeg";

      const check = validateUploadedFile(buffer, fileMime, file.size);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: check.status });
      }

      // 1. Sauvegarder automatiquement l'affiche sur Supabase Storage
      try {
        const ext = (file.name || "poster.jpg").split(".").pop().toLowerCase();
        const storageKey = `admin-posters/poster-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("job-offers")
          .upload(storageKey, buffer, {
            contentType: fileMime,
            upsert: true,
          });

        if (!uploadError) {
          const { data: pubData } = supabaseAdmin.storage
            .from("job-offers")
            .getPublicUrl(storageKey);
          uploadedImageUrl = pubData?.publicUrl || "";
        } else {
          console.warn("[Poster Upload Warning]", uploadError);
        }
      } catch (uploadEx) {
        console.warn("[Poster Storage Exception]", uploadEx);
      }
    }

    // 2. Extraction IA des données de l'affiche et/ou du texte d'accompagnement via Gemini
    const extracted = await extractFullJobOfferFromPosterWithGemini(buffer, fileMime, accompanyingText);

    if (extracted.error) {
      return NextResponse.json(
        {
          success: false,
          error: extracted.error,
          image_url: uploadedImageUrl,
        },
        { status: 400 }
      );
    }

    // 3. Normalisation & Détection WhatsApp automatique
    const rawPhone = extracted.contact_phone || "";
    const detectedPhone = detectWhatsAppNumber({
      contact_phone: rawPhone,
      description: extracted.description,
      title: extracted.title,
      company: extracted.company,
    });

    let autoExternalLink = extracted.external_link || "";
    if (detectedPhone && (!autoExternalLink || autoExternalLink.includes("wa.me"))) {
      autoExternalLink = buildWhatsAppLink(detectedPhone, {
        title: extracted.title,
        company: extracted.company,
      });
    }

    return NextResponse.json({
      success: true,
      offer: {
        title: extracted.title || "Opportunité de recrutement",
        company: extracted.company || "Entreprise",
        location: extracted.location || "Sénégal",
        contract_type: extracted.contract_type || "CDI",
        contact_phone: detectedPhone ? `+${detectedPhone}` : rawPhone,
        contact_email: extracted.contact_email || "",
        external_link: autoExternalLink,
        deadline: extracted.deadline || "",
        min_education_level: extracted.min_education_level || "Aucun",
        salary_range: extracted.salary_range || "",
        description: extracted.description || "",
        image_url: uploadedImageUrl,
        listing_type: VALID_LISTING_TYPES.includes(extracted.listing_type) ? extracted.listing_type : "offre_emploi",
      },
    });
  } catch (error) {
    console.error("[Extract Job Poster API Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur interne lors du traitement de l'offre.",
      },
      { status: 500 }
    );
  }
}
