const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.test.local' });

// We need the service role key to create buckets
const supabase = createClient(
  process.env.TEST_SUPABASE_URL,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
);

// Paramètres exacts de la production (vérifiés le 2026-08-08 via
// introspection : aucun bucket n'a de file_size_limit ni
// allowed_mime_types configuré — seul `public` diffère par bucket).
// avatars/covers ajoutés le 2026-08-21 : absents de la prod le 08/08,
// créés depuis sans jamais être backportés ici — trouvés manquants sur
// facilite-e2e-test en re-comparant les deux projets (2 buckets, pas 4 :
// le "4 sur 6" du commentaire ci-dessus référence l'incident du 08/08,
// déjà résolu depuis pour ces 6-là).
async function createBuckets() {
  const bucketsToCreate = [
    { id: 'resumes', public: false },
    { id: 'chat-attachments', public: false },
    { id: 'badge-documents', public: false },
    { id: 'completed_cvs', public: false },
    { id: 'invoices', public: false },
    { id: 'job-offers', public: true },
    { id: 'avatars', public: false },
    { id: 'covers', public: false },
  ];
  for (const bucket of bucketsToCreate) {
    const { data, error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public,
    });
    if (error && error.message !== 'The resource already exists') {
      console.error(`Error creating bucket ${bucket.id}:`, error.message);
    } else {
      console.log(`Bucket ${bucket.id} created or already exists.`);
    }
  }
}

createBuckets();
