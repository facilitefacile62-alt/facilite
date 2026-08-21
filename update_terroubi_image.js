require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const publicDest = path.join(process.cwd(), 'public', 'terrou_bi_reservation.jpg');
  if (fs.existsSync(publicDest)) {
    const fileBody = fs.readFileSync(publicDest);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-offers')
      .upload('terrou_bi_reservation.jpg', fileBody, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Storage upload error:', uploadError.message);
    } else {
      console.log('✅ Image Terrou-Bi mise à jour dans le bucket Supabase Storage avec succès !');
    }
  }
}

main();
