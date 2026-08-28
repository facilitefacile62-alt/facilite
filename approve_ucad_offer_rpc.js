require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const offerId = 'fa161041-9194-427c-85dc-440bcd9e8b06';

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'facilitefacile62@gmail.com',
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('Erreur génération magic link:', linkErr);
    return;
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: verifyData } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (!verifyData?.session) {
    console.error('Erreur vérification session admin');
    return;
  }

  console.log('Connecté en tant qu\'admin:', verifyData.user.email);

  const { data: modData, error: modErr } = await anonClient.rpc('moderate_job_offer', {
    offer_id: offerId,
    decision: 'approved',
  });

  if (modErr) {
    console.error('Erreur RPC moderate_job_offer:', modErr);
  } else {
    console.log('✅ Offre UCAD approuvée avec succès via moderate_job_offer !', modData);
  }

  // Vérification
  const { data: offer, error: fetchErr } = await anonClient
    .from('job_offers')
    .select('id, title, company, status, is_active, created_at, image_url, external_link, listing_type')
    .eq('id', offerId)
    .single();

  console.log('État de l\'offre en base :', offer);
}

main().catch(console.error);
