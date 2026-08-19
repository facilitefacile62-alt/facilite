require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ocfhzwwjvljintabxxlg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\6a5298a3-0793-4c42-be95-659a28b50fb7\\.user_uploaded\\media_1787155591581.png';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'dexintec_chauffeur.png');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/dexintec_chauffeur.png');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/dexintec_chauffeur.png';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('dexintec_chauffeur.png', fileBody, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('dexintec_chauffeur.png');
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
    title: "Recrutement Chauffeur Expérimenté - Dexintec",
    company: "Dexintec",
    location: "Dakar (Golf / environs), Sénégal",
    contract_type: "CDI / Temps plein (Lun-Sam)",
    salary_range: "Selon profil & expérience",
    min_education_level: "Permis de conduire valide",
    deadline: "2026-08-31",
    image_url: imageUrl,
    contact_email: "maaguysarr@hotmail.com",
    external_link: "mailto:maaguysarr@hotmail.com?subject=Candidature%20Chauffeur%20-%20Dexintec",
    description: `Dexintec recrute un Chauffeur sérieux et expérimenté pour rejoindre son équipe.

🚗 POSTE : Chauffeur professionnel

📌 PROFIL RECHERCHÉ :
• De préférence, habiter aux alentours de Golf ou pouvoir s’y rendre très tôt le matin en semaine.
• Être disponible du lundi au samedi.
• Justifier d’une expérience préalable avérée en tant que chauffeur.
• Faire preuve de discrétion, de ponctualité, de rigueur et de professionnalisme.
• Être obligatoirement titulaire d’un permis de conduire valide.

📁 CANDIDATURE :
Les personnes intéressées et correspondant au profil recherché peuvent envoyer leur candidature en précisant leur expérience professionnelle et leur lieu de résidence.

📧 E-mail de candidature : maaguysarr@hotmail.com`,
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
    console.error('Erreur insertion Supabase:', insertError);
  } else {
    console.log('Offre publiée avec succès dans Supabase ! ID:', insertedOffer.id);
  }
}

main();
