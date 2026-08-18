require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787066313863.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'chauffeur_ambassade_usa.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/chauffeur_ambassade_usa.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/chauffeur_ambassade_usa.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('chauffeur_ambassade_usa.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('chauffeur_ambassade_usa.jpg');
        if (publicUrlData?.publicUrl) {
          imageUrl = publicUrlData.publicUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Erreur upload storage:', err.message);
  }

  console.log('Image URL retenue:', imageUrl);

  // 3. Insertion de l'offre dans job_offers
  const offerPayload = {
    title: "Chauffeur (Motor Pool) - Ambassade des États-Unis",
    company: "Ambassade des États-Unis au Sénégal",
    location: "Dakar, Sénégal",
    contract_type: "CDI",
    salary_range: "7 508 035 FCFA / an (~625 000 FCFA/mois)",
    min_education_level: "Primaire",
    deadline: "2026-09-30",
    image_url: imageUrl,
    external_link: "https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17",
    contact_email: "DakarHR@state.gov",
    description: `L’Ambassade des États-Unis à Dakar recrute un(e) Chauffeur (Motor Pool Chauffeur) pour assurer le transport sécurisé du personnel diplomatique, des visiteurs et du fret.

📌 PROFIL RECHERCHÉ :
• Expérience : Au moins 3 ans d'expérience continue comme chauffeur.
• Permis : Permis de conduire valide obligatoire.
• Connaissances : Excellente maîtrise des itinéraires et du trafic de Dakar.
• Langues : Français (bon niveau de travail) et notions d'anglais.

💰 SALAIRE & AVANTAGES :
• Salaire annuel : 7 508 035 FCFA / an (~625 000 FCFA / mois).
• Avantages : Assurance santé complète et indemnités de la Mission Américaine.

🔗 COMMENT POSTULER :
Postulez directement en ligne sur le portail officiel ERA de l'Ambassade des États-Unis :
https://erajobs.state.gov/dos-era/vacancy/viewVacancyDetail.hms?_ref=vtb5rmp3pt0&returnToSearch=true&jnum=76919&orgId=17`,
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
