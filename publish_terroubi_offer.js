require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\terrou_bi_reservation_agent_1787071223231.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'terrou_bi_reservation.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/terrou_bi_reservation.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/terrou_bi_reservation.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('terrou_bi_reservation.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('terrou_bi_reservation.jpg');
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
    title: "Le Terrou-Bi Dakar recrute un(e) Agent de Réservation Individuelle (H/F)",
    company: "Hôtel & Resort Terrou-Bi Dakar",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & grille hôtelière 5 étoiles",
    min_education_level: "Bac+3 (Hôtellerie / Tourisme / Commerce)",
    deadline: "2026-08-31",
    image_url: imageUrl,
    external_link: "https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform",
    description: `L’Hôtel & Resort Terrou-Bi Dakar recherche un(e) Agent de Réservation Individuelle (H/F) dynamique et orienté client pour assurer la gestion optimale des réservations et sublimer l'expérience client avant séjour.

📌 MISSIONS PRINCIPALES :
• Traitement et confirmation des réservations (téléphone, e-mail, site web, OTA & GDS).
• Application des techniques d'upselling et valorisation des offres du Resort.
• Accueil personnalisé, conseil client et respect des standards LQA de luxe.
• Préparation des confirmations, factures pro forma et réconciliation extranet.
• Coordination avec la réception, conciergerie et housekeeping.

🎯 PROFIL & QUALIFICATIONS :
• Formation : Bac+3 en Hôtellerie, Tourisme, Commerce ou Marketing.
• Expérience : Minimum 2 ans dans une fonction similaire en hôtellerie.
• Compétences : Maîtrise des PMS, OTA et GDS, gestion tarifaire & facturation.
• Langues : Très bonne maîtrise du français et de l'anglais.
• Disponibilité : Flexibilité horaire (travail en soirée, nuit ou week-ends).

🔗 COMMENT POSTULER :
Remplissez directement le formulaire de candidature officiel en ligne :
https://docs.google.com/forms/d/e/1FAIpQLScGI6d43s6A-rrjORx8BlwuN_K-gTRYgcYw3MCf_8XAfBM8RQ/viewform`,
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

  console.log('✅ Offre Terrou-Bi publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
