require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787074665252.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'semi_sarl_chef_chantier.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/semi_sarl_chef_chantier.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/semi_sarl_chef_chantier.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('semi_sarl_chef_chantier.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('semi_sarl_chef_chantier.jpg');
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
    title: "SEMI SARL recrute un(e) Chef(fe) de Chantier (BTP & Construction)",
    company: "SEMI SARL",
    location: "Sénégal (Pôles aquacoles)",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & expérience BTP",
    min_education_level: "Bac+2 à Bac+5 (Génie Civil / BTP)",
    deadline: "2026-09-15",
    image_url: imageUrl,
    contact_email: "sarrsoda@semisenegal.sn",
    external_link: "mailto:sarrsoda@semisenegal.sn?subject=Candidature%20%E2%80%93%20Chef%20de%20Chantier",
    description: `Dans le cadre de notre projet de construction de pôles aquacoles, SEMI SARL recrute un(e) Chef(fe) de Chantier pour renforcer nos équipes et participer au suivi opérationnel des travaux sur nos différents sites.

📌 MISSIONS PRINCIPALES :
• Organiser et superviser les travaux sur le chantier.
• Coordonner les équipes et assurer la bonne exécution des activités.
• Suivre quotidiennement l’avancement des travaux.
• Veiller au respect des plans, délais et consignes techniques.
• Contrôler la qualité des travaux réalisés.
• Faire respecter les règles d’hygiène et de sécurité (HSE).
• Assurer un reporting régulier auprès de la Direction des Travaux.

🎯 PROFIL RECHERCHÉ :
• Expérience confirmée en tant que Chef de Chantier (BTP ou construction).
• Bonne capacité d’organisation, de coordination et de gestion d’équipe.
• Sens des responsabilités, rigueur et autonomie.
• Disponibilité pour travailler sur les différents sites du projet.

📩 COMMENT POSTULER :
Envoyez votre CV à : sarrsoda@semisenegal.sn
📌 Objet du mail : « Candidature – Chef de Chantier »`,
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

  console.log('✅ Offre SEMI SARL publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
