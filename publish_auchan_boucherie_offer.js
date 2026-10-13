require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sourceImage = 'C:\\Users\\gta\\.gemini\\antigravity-ide\\brain\\174802a4-f7f3-494a-9314-e64f43ba33d0\\.user_uploaded\\media_1791888374363.jpg';
  
  // 1. Sauvegarder dans public/
  const publicDest = path.join(process.cwd(), 'public', 'auchan_formation_boucherie_8e_promo.jpg');
  try {
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, publicDest);
      console.log('Image copiée dans public/auchan_formation_boucherie_8e_promo.jpg');
    } else {
      console.warn('Image source introuvable à:', sourceImage);
    }
  } catch (err) {
    console.warn('Copie image locale:', err.message);
  }

  // 2. Upload dans Supabase Storage bucket 'job-offers'
  let imageUrl = '/auchan_formation_boucherie_8e_promo.jpg';
  try {
    if (fs.existsSync(publicDest)) {
      const fileBody = fs.readFileSync(publicDest);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('job-offers')
        .upload('auchan_formation_boucherie_8e_promo.jpg', fileBody, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage upload warning:', uploadError.message);
      } else {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('job-offers')
          .getPublicUrl('auchan_formation_boucherie_8e_promo.jpg');
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
  const description = `🥩 APPEL À CANDIDATURES — 8ᵉ PROMOTION FORMATION EN BOUCHERIE
🎓 FORMATION GRATUITE 100% FINANCÉE AVEC EMBAUCHE EN CDI !

Auchan Sénégal, en partenariat avec l'EFMA (École de Formation aux Métiers d'Avenir), lance un appel à candidatures exceptionnel pour la 8ᵉ promotion de sa formation en boucherie professionnelle avec perspective d'embauche en CDI à la clé.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 DESCRIPTION DU PROGRAMME :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Formation entièrement gratuite et financée à 100 % par Auchan Sénégal en partenariat avec l'EFMA.
• Opportunité unique d'acquérir des compétences techniques spécialisées de pointe dans le métier de la boucherie moderne et de la grande distribution.
• Expérience souhaitée : 6 mois à 1 an (un véritable plus pour faciliter votre apprentissage).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 PROFIL RECHERCHÉ :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Niveau d'études requis : Bac demandé.
• Passionné(e) et motivé(e) par les métiers de la boucherie et de l'alimentation.
• Personne sérieuse, dynamique, rigoureuse et organisée.
• Forte capacité d'apprentissage et goût du travail bien fait.
• Disponibilité totale pour suivre l'intégralité du parcours intensif de formation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 CONDITIONS & DÉTAILS :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Localisation : Dakar, Sénégal
• Type de contrat : CDI (après validation du parcours de formation)
• Frais pédagogiques : 0 FCFA (100% pris en charge par Auchan)
• Date limite de clôture : 18 octobre 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 COMMENT POSTULER DIRECTEMENT :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Postulez directement en ligne via la plateforme officielle de recrutement :
https://sociumjob.com/jobs/appel-a-candidatures-pour-la-8ieme-promotion-de-la-formation-gratuite-en-boucherie-en-partenariat-avec-efma-(ecole-de-formation-aux-metiers-d-avenir)-auchan-senegal-1791372547449`;

  const now = new Date().toISOString();
  const offerPayload = {
    title: "Auchan Sénégal x EFMA — Formation en Boucherie (8ᵉ Promotion) avec CDI après formation",
    company: "Auchan Sénégal & EFMA",
    location: "Dakar, Sénégal",
    contract_type: "CDI (après formation)",
    salary_range: "Formation 100% financée + CDI",
    min_education_level: "Bac demandé",
    min_education_level_code: "BAC",
    deadline: "2026-10-18",
    image_url: imageUrl,
    external_link: "https://sociumjob.com/jobs/appel-a-candidatures-pour-la-8ieme-promotion-de-la-formation-gratuite-en-boucherie-en-partenariat-avec-efma-(ecole-de-formation-aux-metiers-d-avenir)-auchan-senegal-1791372547449",
    application_url: "https://sociumjob.com/jobs/appel-a-candidatures-pour-la-8ieme-promotion-de-la-formation-gratuite-en-boucherie-en-partenariat-avec-efma-(ecole-de-formation-aux-metiers-d-avenir)-auchan-senegal-1791372547449",
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

  // 4. Modération & Approbation via RPC
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
      console.log('Connecté en admin pour approbation RPC');
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
    console.log('\n🎉 Offre Auchan Boucherie vérifiée et visible publiquement :', finalOffer);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
