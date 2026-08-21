require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\cc8da5de-b0b4-4140-8ea0-86f11ab88973\\.user_uploaded\\media_1787171752473.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'foundever_conseiller_client.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/foundever_conseiller_client.jpg');
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/foundever_conseiller_client.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-offers')
        .upload('foundever_conseiller_client.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('job-offers')
          .getPublicUrl('foundever_conseiller_client.jpg');
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
    title: "Conseillers Clients en Réception d’Appels",
    company: "Foundever",
    location: "Dakar, Sénégal",
    contract_type: "CDI / Plein temps",
    salary_range: "Rémunération attractive (fixe + prime)",
    min_education_level: "BAC",
    deadline: "2026-09-30",
    image_url: imageUrl,
    external_link: "https://career4.successfactors.com/careers?company=SitelPROD&_gl=1*w592w8*_gcl_au*Njc4OTEzNzE1LjE3ODcxMzc3MTM.*_ga*OTcwMDQ4NzI2LjE3ODcxMzc3MTM.*_ga_VZWYPKQK9Z*czE3ODcxNzA1MTQkbzMkZzEkdDE3ODcxNzE4MDEkajYwJGwwJGgw",
    description: `À propos de Foundever™ :
Foundever™ est un leader mondial de l'expérience client (CX). Avec 170 000 collaborateurs dans le monde, nous sommes l’équipe derrière les meilleures expériences des 750 plus grandes marques internationales et digitales. Nos solutions CX innovantes, notre technologie et notre expertise sont conçues pour répondre aux besoins opérationnels de nos clients et leur offrir une expérience sans couture, partout et à tout moment. Prenant en charge 9 millions d’expériences chaque jour dans plus de 60 langues et 45 pays, Foundever combine la force d’une présence mondiale à une approche entrepreneuriale, permettant aux entreprises de toutes tailles et de tous secteurs de transformer leur CX.

🎯 Résumé du poste :
Nous recrutons des conseillers clients en réception d’appels qui auront pour missions d’assurer l’assistance de la clientèle en difficulté dans un esprit de fidélisation et de satisfaction en apportant une réponse complète et fiable à leur demande.

📋 Dans ce contexte, vous serez chargé(e) de :
• Accueillir les appels des clients
• Écouter et diagnostiquer leurs besoins afin de leur apporter la solution adaptée
• Appliquer les process définis et maîtriser l’utilisation des outils
• Remonter toute information permettant d’identifier un dysfonctionnement ou d’améliorer une procédure
• Contribuer à la bonne marche du service
• Veiller à atteindre les objectifs qualitatifs et quantitatifs fixés par la direction

👤 Profil recherché :
• Une parfaite maîtrise de la langue française (à l’oral comme à l’écrit)
• Le sens de l’écoute et du service
• Une bonne connaissance de l’outil informatique
• Assidu, impliqué, ponctuel

🎁 Nous offrons :
• Rémunération attractive (fixe + prime)
• Formation rémunérée à 100%
• Avantages sociaux attrayants

🌐 Pour postuler directement :
https://career4.successfactors.com/careers?company=SitelPROD&_gl=1*w592w8*_gcl_au*Njc4OTEzNzE1LjE3ODcxMzc3MTM.*_ga*OTcwMDQ4NzI2LjE3ODcxMzc3MTM.*_ga_VZWYPKQK9Z*czE3ODcxNzA1MTQkbzMkZzEkdDE3ODcxNzE4MDEkajYwJGwwJGgw

🔗 Pour visiter le site officiel :
https://jobs.foundever.com/`,
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

  console.log('✅ Offre Foundever publiée avec succès ! ID:', insertedOffer.id);
  console.log(insertedOffer);
}

main();
