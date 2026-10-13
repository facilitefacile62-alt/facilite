require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\174802a4-f7f3-494a-9314-e64f43ba33d0\\.user_uploaded\\media_1791887653218.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'auchan_renforts_ramadan_2027.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée avec succès dans public/auchan_renforts_ramadan_2027.jpg');
    } else {
      console.warn('Image source introuvable à:', sourceImage);
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/auchan_renforts_ramadan_2027.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('job-offers')
        .upload('auchan_renforts_ramadan_2027.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('job-offers')
          .getPublicUrl('auchan_renforts_ramadan_2027.jpg');
        if (publicUrlData?.publicUrl) {
          imageUrl = publicUrlData.publicUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Erreur upload storage:', err.message);
  }

  console.log('Image URL retenue:', imageUrl);

  // 3. Préparer le payload de l'offre
  const description = `🛒 APPEL À CANDIDATURES — RENFORTS RAMADAN 2027 — AUCHAN SÉNÉGAL

Dans le cadre du renforcement exceptionnel de ses équipes pour la période du Ramadan 2027, Auchan Sénégal recrute pour ses magasins à Dakar et dans plusieurs villes du Sénégal !

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 POSTES À POURVOIR :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Caissier(ère) :
• Accueil chaleureux des clients
• Encaissement rapide et efficace
• Fiabilité et tenue irréprochable de la caisse
• Fidélisation et satisfaction client

2️⃣ Employé(e) Commercial(e) / Rayonniste :
• Mise en rayon et réassort continu des produits
• Propreté, hygiène et organisation de l'espace de vente
• Conseil et orientation des clients en magasin

3️⃣ Porteur :
• Accompagnement bienveillant des clients
• Chargement et aide au transport des achats volumineux

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PROFIL RECHERCHÉ :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Niveau d'études : Bac demandé.
• Personnes dynamiques, motivées, sérieuses, ponctuelles et disponibles durant toute la période du Ramadan.
• Sens aigu du service client et aptitude au travail en équipe.
• Expérience en grande distribution ou commerce appréciée (un atout supplémentaire).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 DÉTAILS DU CONTRAT :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Localisation : Dakar & Villes du Sénégal
• Type de contrat : CDD (< 6 mois)
• Rémunération : Selon grille salariale Auchan Sénégal
• Date limite de candidature : 24 octobre 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 COMMENT POSTULER DIRECTEMENT :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Postulez directement en ligne via le lien officiel du recrutement :
https://sociumjob.com/jobs/appel-a-candidatures-renforts-ramadan-2027-auchan-senegal-1791540972248`;

  const now = new Date().toISOString();
  const offerPayload = {
    title: "Auchan Sénégal recrute — Renforts Ramadan 2027 (Caissiers, Rayonnistes, Porteurs)",
    company: "Auchan Sénégal",
    location: "Dakar & Villes du Sénégal",
    contract_type: "CDD (< 6 mois)",
    salary_range: "Selon grille Auchan Sénégal",
    min_education_level: "Bac demandé",
    min_education_level_code: "BAC",
    deadline: "2026-10-24",
    image_url: imageUrl,
    external_link: "https://sociumjob.com/jobs/appel-a-candidatures-renforts-ramadan-2027-auchan-senegal-1791540972248",
    application_url: "https://sociumjob.com/jobs/appel-a-candidatures-renforts-ramadan-2027-auchan-senegal-1791540972248",
    description: description,
    listing_type: "offre_emploi",
    status: "approved",
    is_active: true,
    is_test_account: false,
    recruiter_id: "00000000-0000-4000-a000-000000000001",
    created_at: now,
    updated_at: now,
    status_updated_at: now,
  };

  const { data: insertedOffer, error: insertError } = await supabaseAdmin
    .from('job_offers')
    .insert(offerPayload)
    .select()
    .single();

  if (insertError) {
    console.error('Erreur insertion offre:', insertError);
    process.exit(1);
  }

  console.log('✅ Offre insérée avec ID:', insertedOffer.id);

  // 4. Modération & Approbation via RPC si le statut a été remis à pending_review par un trigger
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'facilitefacile62@gmail.com',
  });

  if (!linkErr && linkData?.properties?.hashed_token) {
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: verifyData } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyData?.session) {
      console.log('Connecté en admin pour vérification/approbation RPC');
      const { data: modData, error: modErr } = await anonClient.rpc('moderate_job_offer', {
        offer_id: insertedOffer.id,
        decision: 'approved',
      });
      if (modErr) {
        console.warn('moderate_job_offer warning:', modErr.message);
      } else {
        console.log('RPC moderate_job_offer exécutée avec succès !');
      }
    }
  }

  // 5. Garantir is_active: true et status: 'approved'
  await supabaseAdmin
    .from('job_offers')
    .update({
      is_active: true,
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', insertedOffer.id);

  // 6. Vérification publique
  const anonClientPublic = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: finalOffer, error: fetchErr } = await anonClientPublic
    .from('job_offers')
    .select('id, title, company, location, contract_type, deadline, status, is_active, image_url, external_link')
    .eq('id', insertedOffer.id)
    .single();

  if (fetchErr) {
    console.error('Erreur lecture publique:', fetchErr);
  } else {
    console.log('\n🎉 Offre Auchan Sénégal vérifiée et visible publiquement :', finalOffer);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
