require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787069899873.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'secam_chantier_kedougou.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/secam_chantier_kedougou.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/secam_chantier_kedougou.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('secam_chantier_kedougou.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('secam_chantier_kedougou.jpg');
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
    title: "Recrutement Chantier (12 Profils Engins & BTP) - SECAM S.A.",
    company: "SECAM S.A.",
    location: "Kédougou, Sénégal",
    contract_type: "CDD (2 ans)",
    salary_range: "Selon profil & expérience",
    min_education_level: "Professionnel / Technique",
    deadline: "2026-08-20",
    image_url: imageUrl,
    contact_email: "secam.sa@secam.sn",
    external_link: "mailto:secam.sa@secam.sn?cc=kancouba.ba@secam.sn&subject=Candidature%20Chantier%20SECAM%20Kedougou",
    description: `Pour les besoins d’un chantier situé à Kédougou, SECAM S.A. recrute du personnel qualifié pour un contrat de deux (02) ans avec prise de fonction immédiate.

🏗️ 12 POSTES À POURVOIR :
• 06 Conducteurs de chargeurs
• 02 Conducteurs de tractopelles
• 01 Conducteur de compacteur lisse
• 01 Conducteur de bulldozer
• 01 Conducteur de niveleuse CAT 140K
• 01 Mécanicien hydraulicien

📌 PROFIL RECHERCHÉ :
• Expérience professionnelle avérée dans le domaine du poste visé.
• Disponibilité immédiate pour affectation à Kédougou.

📁 DOSSIER DE CANDIDATURE :
• Demande manuscrite + CV à jour
• Copie des diplômes / attestations + CNI

📅 MODALITÉS & CONTACTS :
• Date limite : 20 août 2026
• Dépôt physique : Siège SECAM S.A., Almadies (Dakar)
• Dépôt e-mail : secam.sa@secam.sn ou kancouba.ba@secam.sn
• Téléphones : +221 33 844 30 41 / +221 77 531 33 48`,
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

  console.log('✅ Offre SECAM publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
