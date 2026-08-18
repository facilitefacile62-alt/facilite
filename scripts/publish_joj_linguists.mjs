import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ocfhzwwjvljintabxxlg.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const filePath = path.join(process.cwd(), "public", "joj_dakar_2026_youth_linguists.jpg");
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = `joj_dakar_2026_youth_linguists_${Date.now()}.jpg`;

  console.log("📤 Upload de l'affiche JOJ Dakar 2026 dans Supabase Storage...");
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("job-posters")
    .upload(fileName, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  let imageUrl = "/joj_dakar_2026_youth_linguists.jpg";
  if (uploadData?.path) {
    const { data: publicUrlData } = supabase.storage
      .from("job-posters")
      .getPublicUrl(uploadData.path);
    imageUrl = publicUrlData.publicUrl;
    console.log("✅ Image uploadée avec succès :", imageUrl);
  } else if (uploadError) {
    console.warn("⚠️ Avertissement upload Supabase Storage:", uploadError.message);
  }

  const offerId = "30e060ee-6c17-48f8-b3bf-5e744d03e911";
  const title = "Youth Linguists Programme (YLP) - JOJ Dakar 2026 / ONFP";
  const company = "Comité d'Organisation JOJ Dakar 2026 & ONFP";
  const location = "Dakar, Sénégal";
  const contractType = "Programme Jeunesse / Mission Internationale";
  const description = `🌍🗣️ Tu as entre 21 et 35 ans, tu es Sénégalais(e) et trilingue ?

Le Youth Linguists Programme des Jeux Olympiques de la Jeunesse (JOJ Dakar 2026) recrute en partenariat avec l'ONFP et l'Association Sénégalaise des Traducteurs (Astra) ! Rejoins une équipe de jeunes talents linguistiques (Junior Linguist Operators - JLO) et vis une expérience humaine et professionnelle unique au cœur des premiers Jeux Olympiques organisés en Afrique.

📌 MISSIONS PRINCIPALES :
• Assurer l'assistance et les services linguistiques multilingues (interprétariat d'accueil, accompagnement des délégations, traduction).
• Faciliter la communication entre les délégations internationales, les athlètes, les officiels et le comité d'organisation.
• Participer aux opérations linguistiques sur les sites de compétition et villages olympiques.

🎯 CRITÈRES D'ÉLIGIBILITÉ & PROFIL :
• Âge : Entre 21 et 35 ans.
• Nationalité : Être de nationalité sénégalaise.
• Langues : Maîtrise d'au moins 3 langues (Français, Anglais, Wolof ou autres langues internationales : Espagnol, Arabe, etc.).
• Excellente aisance relationnelle, diplomatie et sens du protocole.

📅 MODALITÉS & CANDIDATURES :
• Période d'inscription : Du 17 au 23 août 2026
• Portail officiel de candidature : https://sigof.onfp.sn/ylp
• Informations complémentaires : www.dakar2026.org | E-mail : YLP@dakar2026.org

🔗 Postulez en ligne dès maintenant sur la plateforme dédiée SIGOF ONFP !`;

  console.log("📝 Insertion de l'offre dans public.job_offers...");
  const { data: job, error: jobError } = await supabase
    .from("job_offers")
    .upsert({
      id: offerId,
      title,
      company,
      location,
      contract_type: contractType,
      salary_range: "Prise en charge & Mission Olympique",
      description,
      image_url: imageUrl,
      min_education_level: "Bac +2 à Bac +5 (Langues / Traduction / Relations Internationales)",
      deadline: "2026-08-23",
      external_link: "https://sigof.onfp.sn/ylp",
      contact_email: "YLP@dakar2026.org",
      is_active: true,
      status: "approved",
      is_sponsored: true,
      sponsor_priority: 25,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError) {
    console.error("❌ Erreur insertion offre:", jobError.message);
  } else {
    console.log("🎉 Offre JOJ Dakar 2026 insérée avec succès (ID:", job.id, ")");
  }
}

main();
