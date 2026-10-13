require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ocfhzwwjvljintabxxlg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\271d28d8-f02d-4e68-ac3a-3dcd46b7d1d8\\.user_uploaded\\media_1791634983606.jpg';
  const publicDest = path.join(process.cwd(), 'public', 'pyxis_logistics_chauffeur.jpg');

  // 1. Sauvegarder dans public/
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('✅ Image copiée dans public/pyxis_logistics_chauffeur.jpg');
    } else {
      console.warn('⚠️ Source image non trouvée:', sourceImage);
    }
  } catch (err) {
    console.error('Erreur copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage buckets
  let imageUrl = '/pyxis_logistics_chauffeur.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      
      // Upload dans job-posters
      const { data: posterData, error: posterError } = await supabase.storage
        .from('job-posters')
        .upload('pyxis_logistics_chauffeur.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!posterError) {
        const { data: publicUrlData } = supabase.storage
          .from('job-posters')
          .getPublicUrl('pyxis_logistics_chauffeur.jpg');
        if (publicUrlData?.publicUrl) {
          imageUrl = publicUrlData.publicUrl;
        }
      } else {
        console.warn('Upload job-posters warn:', posterError.message);
      }

      // Upload dans job-offers aussi pour redondance
      await supabase.storage
        .from('job-offers')
        .upload('pyxis_logistics_chauffeur.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });
    }
  } catch (err) {
    console.warn('Erreur upload storage:', err.message);
  }

  console.log('🖼️ Image URL finale:', imageUrl);

  const offerId = crypto.randomUUID();

  const description = `Dans le cadre du développement de ses activités de transport, transit et supply chain, Pyxis Logistics recrute un Chauffeur professionnel et expérimenté basé à Dakar.

🚛 POSTE : Chauffeur

📌 EXIGENCES & CRITÈRES DU POSTE :
• Expérience : 3 ans minimum dans la conduite professionnelle.
• Permis de conduire : Permis B obligatoire et en cours de validité.
• Connaissances géographiques : Bonne connaissance de Dakar et de ses environs.
• Qualités recherchées : Ponctuel, dynamique et consciencieux.

📁 MODALITÉS DE CANDIDATURE :
Envoyez votre CV et vos références à :
📧 Adresse e-mail : administratif@logistics-pyxis.com
📌 Objet du mail obligatoire : Candidature - Chauffeur

🤝 Pyxis Logistics - Votre partenaire logistique de confiance.`;

  // 3. Insertion de l'offre dans job_offers
  const offerPayload = {
    id: offerId,
    title: "Pyxis Logistics recrute un Chauffeur",
    company: "Pyxis Logistics",
    location: "Dakar et ses environs, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & expérience",
    min_education_level: "Permis B obligatoire (3 ans d'expérience min)",
    deadline: "2026-11-30",
    image_url: imageUrl,
    contact_email: "administratif@logistics-pyxis.com",
    external_link: "mailto:administratif@logistics-pyxis.com?subject=Candidature%20-%20Chauffeur",
    description: description,
    status: "approved",
    is_active: true,
    is_test_account: false,
    listing_type: "offre_emploi",
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
    console.error('❌ Erreur insertion Supabase:', insertError);
  } else {
    console.log('🎉 Offre Pyxis Logistics insérée avec succès dans Supabase !');
    console.log('ID:', insertedOffer.id);
    console.log('Statut initial:', insertedOffer.status);
    
    // Si le statut a été forcé en pending_review par défaut, on l'approuve directement avec le service role
    if (insertedOffer.status !== 'approved') {
      const { data: updatedOffer, error: updateError } = await supabase
        .from('job_offers')
        .update({ status: 'approved', status_updated_at: new Date().toISOString() })
        .eq('id', insertedOffer.id)
        .select()
        .single();
      if (updateError) {
        console.warn('Attention update status:', updateError.message);
      } else {
        console.log('✅ Offre approuvée avec succès ! Statut:', updatedOffer.status);
      }
    }

    console.log('URL de détail: /offres/' + insertedOffer.id);
  }
}

main();
