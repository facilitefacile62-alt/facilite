require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\be78a6b5-6eaa-4b42-b042-4912df36c0fa\\.user_uploaded\\media_1787075448881.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'cadre_infirmier_infections.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/cadre_infirmier_infections.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/cadre_infirmier_infections.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('cadre_infirmier_infections.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('cadre_infirmier_infections.jpg');
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
    title: "Cadre infirmier(ère) référent(e) senior en prévention et contrôle des infections",
    company: "Établissement de Santé (Secteur Hospitalier)",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & grille cadre hospitalier",
    min_education_level: "Diplôme d'infirmier(ère) + Certification PCI",
    deadline: "2026-09-30",
    image_url: imageUrl,
    external_link: "https://lnkd.in/gv6pvNJq",
    description: `Un établissement de santé recrute un(e) Cadre infirmier(ère) référent(e) senior chargé(e) de piloter son programme de prévention et de contrôle des infections (PCI).

🎯 PRINCIPALES RESPONSABILITÉS :
• Prévenir et surveiller les infections associées aux soins (IAS).
• Superviser les audits, les procédures et les plans d’amélioration.
• Coordonner la réponse aux épidémies et aux risques infectieux.
• Collaborer avec le laboratoire de microbiologie.
• Suivre la résistance aux antimicrobiens et micro-organismes multirésistants.
• Former et accompagner les équipes de soins.
• Contribuer aux démarches de qualité, de gestion des risques et d’accréditation.

📌 PROFIL RECHERCHÉ :
• Diplôme d’infirmier(ère) et autorisation professionnelle valide.
• Formation ou certification en prévention et contrôle des infections (PCI).
• Au moins 7 à 10 ans d’expérience clinique.
• Expérience confirmée en prévention des infections en milieu hospitalier.
• Solides compétences en leadership, épidémiologie, microbiologie et analyse des données.

🔗 COMMENT POSTULER :
Déposez votre candidature directement en ligne :
https://lnkd.in/gv6pvNJq`,
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

  console.log('✅ Offre Cadre Infirmier publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
