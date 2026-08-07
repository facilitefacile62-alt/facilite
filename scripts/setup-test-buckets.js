const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.test.local' });

// We need the service role key to create buckets
const supabase = createClient(
  process.env.TEST_SUPABASE_URL,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
);

async function createBuckets() {
  const bucketsToCreate = ['resumes', 'chat-attachments'];
  for (const bucket of bucketsToCreate) {
    const { data, error } = await supabase.storage.createBucket(bucket, {
      public: false,
    });
    if (error && error.message !== 'The resource already exists') {
      console.error(`Error creating bucket ${bucket}:`, error.message);
    } else {
      console.log(`Bucket ${bucket} created or already exists.`);
    }
  }
}

createBuckets();
