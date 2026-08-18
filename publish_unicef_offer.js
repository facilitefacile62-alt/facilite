require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787060624957.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'unicef_stage_2026.jpg');
  fs.copyFileSync(sourceImage, publicDest);
  console.log('Image copiée dans public/unicef_stage_2026.jpg');

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/unicef_stage_2026.jpg';
  try {
    const fileBody = fs.readFileSync(sourceImage);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-offers')
      .upload('unicef_stage_2026.jpg', fileBody, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Storage upload warning:', uploadError.message);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('job-offers')
        .getPublicUrl('unicef_stage_2026.jpg');
      if (publicUrlData?.publicUrl) {
        imageUrl = publicUrlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Erreur upload storage:', err.message);
  }

  console.log('Image URL retenue:', imageUrl);

  // 3. Insertion de l'offre dans job_offers
  const offerPayload = {
    title: "Programme de Stages Internationaux - UNICEF 2026",
    company: "UNICEF",
    location: "International (Multi-pays)",
    contract_type: "Stage",
    salary_range: "Indemnité selon grille UNICEF",
    min_education_level: "Bac+1 à Bac+8",
    deadline: "2026-12-31",
    image_url: imageUrl,
    external_link: "https://youthmedia.net/opportunites/programme-de-stages-unicef-2026",
    contact_email: "info@youthmedia.net",
    description: `L'UNICEF offre à des étudiants et jeunes diplômés du monde entier des opportunités de stage international.

📌 PROFIL & ÉLIGIBILITÉ :
- Niveau d'études : Bac+1 à Bac+8 (Étudiants actuellement inscrits ou récents diplômés).
- Lieux : Divers sites internationaux selon le pays et l'offre de stage.
- Date limite : Candidatures ouvertes en continu tout au long de l'année.

🔗 CANDIDATURE :
Retrouvez toutes les informations, les critères d'éligibilité détaillés et les modalités de candidature sur le portail officiel :
https://youthmedia.net/opportunites/programme-de-stages-unicef-2026

📞 CONTACT & INFOLINE :
- Email : info@youthmedia.net
- Téléphone : +225 27 22 49 81 33 / +225 05 65 68 74 61`,
    status: "approved",
    is_active: true,
    is_test_account: false,
    recruiter_id: "00000000-0000-4000-a000-000000000001",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  const { data: insertedOffer, error: insertError } = await supabase
    .from('job_offers')
    .insert(offerPayload)
    .select()
    .single();

  if (insertError) {
    console.error('Erreur insertion offre:', insertError);
    process.exit(1);
  }

  console.log('✅ Offre publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
