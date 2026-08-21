require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\55cfe3b0-fd2b-45b8-8df3-797bcf8f9751\\.user_uploaded\\media_1787318633515.jpg';
  const targetFileName = 'recrutement_urgent_electrotechnicien_automatisme.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', targetFileName);
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log(`Image copiée dans public/${targetFileName}`);
    } else {
      console.warn('Source image introuvable:', sourceImage);
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = `/${targetFileName}`;
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload(targetFileName, fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl(targetFileName);
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
    title: "Électrotechnicien(ne) / Ingénieur(e) en Automatisme & Génie Électrique",
    company: "Entreprise Industrielle & Automatisme",
    location: "Sénégal (Dakar & Régions)",
    contract_type: "CDI / Plein temps",
    salary_range: "Selon profil & expérience",
    min_education_level: "Bac+2 à Bac+5 (Électrotechnique, Automatisme, Génie Électrique)",
    deadline: "2026-09-30",
    image_url: imageUrl,
    contact_email: "walykebe@gmail.com",
    external_link: "mailto:walykebe@gmail.com?subject=Candidature%20%E2%80%93%20%C3%89lectrotechnicien(ne)%20%2F%20Ing%C3%A9nieur(e)%20Automatisme%20G%C3%A9nie%20%C3%89lectrique",
    description: `🚨 RECRUTEMENT URGENT

Une entreprise recherche activement un(e) Électrotechnicien(ne) en automatisme ou un(e) Ingénieur(e) en génie électrique / automatisme.

🎯 MISSIONS & RESPONSABILITÉS :
• Conception, programmation et maintenance des systèmes automatisés (API, HMI, automates industriels).
• Lecture, analyse et réalisation de schémas électriques et opérations de câblage industriel.
• Diagnostic, dépannage et optimisation des installations électrotechniques.
• Participation aux mises en service et suivi des performances des équipements.
• Collaboration avec les équipes techniques et de production.

📌 PROFIL RECHERCHÉ :
• Formation : Bac+2 (BTS, DUT) à Bac+5 (Master, Diplôme d'Ingénieur) en Électrotechnique, Génie Électrique ou Automatisme Industriel.
• Maîtrise confirmée des systèmes automatisés (API, HMI, SCADA).
• Excellente maîtrise des schémas électriques, normes de sécurité et câblage.
• Rigueur, esprit d'analyse méthodique et esprit d'équipe.
• Expérience professionnelle bienvenue (débutants motivés ou profils confirmés).

📩 COMMENT POSTULER :
Envoyez dès maintenant votre CV à l'adresse suivante :
👉 walykebe@gmail.com

⚡ *Besoin urgent — Merci de partager largement !*`,
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

  console.log('✅ Offre Électrotechnicien / Automatisme publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
