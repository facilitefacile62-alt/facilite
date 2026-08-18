require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787070683382.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'bceao_assistant_direction.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/bceao_assistant_direction.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/bceao_assistant_direction.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('bceao_assistant_direction.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('bceao_assistant_direction.jpg');
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
    title: "BCEAO recrute 03 Assistants de direction à Dakar",
    company: "BCEAO (Banque Centrale des États de l'Afrique de l'Ouest)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Grille Institutionnelle BCEAO",
    min_education_level: "Bac+2 à Bac+4",
    deadline: "2026-08-24",
    image_url: imageUrl,
    external_link: "https://bceao2.tzportal.io//fr/jobs/1960-64",
    description: `La Banque Centrale des États de l'Afrique de l'Ouest (BCEAO) recrute pour son Siège basé à Dakar (Sénégal) 03 Secrétaires / Assistants de direction.

📌 MISSIONS PRINCIPALES :
• Accueil téléphonique et physique des visiteurs.
• Gestion du courrier, classement et archivage.
• Gestion des agendas, réunions et constitution des dossiers.
• Saisie et mise en forme des documents officiels.
• Enregistrement des demandes applicatives (congés, ordres de mission).

🎯 CRITÈRES D'ÉLIGIBILITÉ & PROFIL :
• Être ressortissant(e) d’un État membre de l’UMOA (18 à 40 ans).
• Niveau d'études : Bac +2 à Bac +4 en Assistanat de direction ou domaine connexe.
• Expérience : 2 ans minimum d’expérience en tant qu'Assistant(e) de direction.
• Langue : La maîtrise de l’anglais constitue un atout important.

📅 DATE LIMITE : 24 août 2026

🔗 COMMENT POSTULER :
Postulez directement sur la plateforme officielle de la BCEAO :
https://bceao2.tzportal.io//fr/jobs/1960-64`,
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

  console.log('✅ Offre BCEAO publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
