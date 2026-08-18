require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787075783786.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'ziac_stagiaire_informaticien.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/ziac_stagiaire_informaticien.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/ziac_stagiaire_informaticien.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('ziac_stagiaire_informaticien.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('ziac_stagiaire_informaticien.jpg');
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
    title: "Stagiaire Informaticien(ne) - Connaissances ERP Sage & Odoo",
    company: "Zenith International Audit & Conseil (ZIAC)",
    location: "Dakar, Sénégal",
    contract_type: "Stage / Plein temps",
    salary_range: "Indemnité de stage légale",
    min_education_level: "Bac+2 à Bac+5 (Informatique / Génie Logiciel)",
    deadline: "2026-08-23",
    image_url: imageUrl,
    contact_email: "rh@ziac.sn",
    external_link: "mailto:rh@ziac.sn?subject=Candidature%20%E2%80%93%20Stagiaire%20Informaticien(ne)%20ERP",
    description: `Le cabinet Zenith International Audit & Conseil (ZIAC) recrute un(e) Stagiaire Informaticien(ne) avec de solides connaissances sur les solutions ERP (Sage & Odoo).

🎯 MISSIONS PRINCIPALES :
• Participer au paramétrage, à l'intégration et au support des solutions ERP (Sage et Odoo).
• Accompagner les équipes dans la maintenance des systèmes d'information.
• Assurer l'assistance aux utilisateurs et la rédaction de documentations techniques.

📌 PROFIL RECHERCHÉ :
• Formation en Informatique, Génie Logiciel ou domaine équivalent (Bac+2 à Bac+5).
• Connaissances pratiques sur les ERP Sage & Odoo.
• Esprit d’analyse, rigueur, autonomie et curiosité technique.
• Goût prononcé pour le travail en équipe et l’apprentissage continu.

📅 DATE LIMITE : 23 août 2026
📩 COMMENT POSTULER :
Envoyez votre CV à : rh@ziac.sn
📌 Objet du mail : « Candidature – Stagiaire Informaticien(ne) ERP »`,
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

  console.log('✅ Offre ZIAC publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
