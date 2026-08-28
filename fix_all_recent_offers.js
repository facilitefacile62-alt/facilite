require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('--- 1. Authentification Session Admin ---');
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
  console.log('Connecté en tant qu\'administrateur:', verifyData.user.email);

  // 1. Nettoyer les doublons incomplets en brouillon
  console.log('\n--- 2. Nettoyage des brouillons doublons ---');
  const duplicateDraftIds = [
    'a7a84ddf-43ad-4ee8-aaa7-4fcc0ce5ee4e',
    '2b0220bd-84d8-4475-9f2a-4db9b57d0749'
  ];
  const { data: delData, error: delErr } = await supabaseAdmin
    .from('job_offers')
    .delete()
    .in('id', duplicateDraftIds)
    .select('id, title');
  console.log('Brouillons supprimés:', delData, delErr);

  // 2. Activer et actualiser les dates des 4 offres clés
  console.log('\n--- 3. Activation & Mise à la une des 4 dernières offres ---');
  const now = new Date();
  
  // Offre 1 : Ilios Groupe
  const iliosId = '91e5b49b-f4e1-4ab1-92ed-5b87f6011f28';
  await supabaseAdmin
    .from('job_offers')
    .update({
      is_active: true,
      created_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), // Il y a 5 min
      updated_at: now.toISOString(),
    })
    .eq('id', iliosId);

  await anonClient.rpc('moderate_job_offer', {
    offer_id: iliosId,
    decision: 'approved',
  });
  console.log('✅ Offre 1 (Ilios Groupe) : Approuvée et Activée !');

  // Offre 2 : Grant Thornton Technologies
  const gtId = 'b8ec7721-89f2-4a12-bb41-958bcf7d6392';
  await supabaseAdmin
    .from('job_offers')
    .update({
      is_active: true,
      created_at: new Date(now.getTime() - 1000 * 60 * 10).toISOString(), // Il y a 10 min
      updated_at: now.toISOString(),
    })
    .eq('id', gtId);

  await anonClient.rpc('moderate_job_offer', {
    offer_id: gtId,
    decision: 'approved',
  });
  console.log('✅ Offre 2 (Grant Thornton) : Approuvée et Activée !');

  // Offre 3 : SENSAT GAINDESAT-1A
  const sensatId = 'a7ccd61a-5661-4e7d-bc40-bc725ae4fa63';
  await supabaseAdmin
    .from('job_offers')
    .update({
      is_active: true,
      created_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(), // Il y a 15 min
      updated_at: now.toISOString(),
    })
    .eq('id', sensatId);

  await anonClient.rpc('moderate_job_offer', {
    offer_id: sensatId,
    decision: 'approved',
  });
  console.log('✅ Offre 3 (SENSAT GAINDESAT) : Approuvée et Activée !');

  // Offre 4 : Électrotechnicien & Automatisme
  const electroId = 'b69b4b86-859f-4cff-a508-b2c21c74e765';
  await supabaseAdmin
    .from('job_offers')
    .update({
      is_active: true,
      created_at: new Date(now.getTime() - 1000 * 60 * 20).toISOString(), // Il y a 20 min
      updated_at: now.toISOString(),
    })
    .eq('id', electroId);

  await anonClient.rpc('moderate_job_offer', {
    offer_id: electroId,
    decision: 'approved',
  });
  console.log('✅ Offre 4 (Électrotechnicien) : Approuvée et Activée !');

  // 4. Vérification via le client Public (comme un visiteur sur le fil d'actualité)
  console.log('\n--- 4. Vérification du Fil d\'Actualité Public (Requête Visiteur) ---');
  const { data: publicFeed, error: pubErr } = await anonClient
    .from('job_offers')
    .select('id, title, company, status, is_active, created_at, image_url')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(6);

  console.log('Résultats du Fil d\'Actualité Public :');
  console.table(publicFeed);
  console.log('Erreur :', pubErr);
}

main().catch(console.error);
