require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://ocfhzwwjvljintabxxlg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadImage(filename, filepath) {
  const fileBody = fs.readFileSync(filepath);
  
  const { data, error } = await supabase.storage
    .from('job-offers')
    .upload(filename, fileBody, {
      contentType: 'image/jpeg',
      upsert: true
    });
    
  if (error) {
    console.error('Error uploading', filename, error);
    return null;
  }
  
  const { data: publicUrlData } = supabase.storage
    .from('job-offers')
    .getPublicUrl(filename);
    
  return publicUrlData.publicUrl;
}

async function main() {
  console.log('Uploading images to Supabase...');
  
  const waveUrl = await uploadImage('wave_pub.jpg', 'c:\\Users\\gta\\Downloads\\monprojetfacilite\\pub.jpeg');
  const sonagooUrl = await uploadImage('sonagoo_pub.jpg', 'c:\\Users\\gta\\Downloads\\monprojetfacilite\\pub3.jpeg');
  const fadelUrl = await uploadImage('fadel_pub.jpg', 'c:\\Users\\gta\\Downloads\\monprojetfacilite\\pub2.jpeg');
  
  console.log('Wave URL:', waveUrl);
  console.log('Sonagoo URL:', sonagooUrl);
  console.log('Fadel URL:', fadelUrl);
  
  if (waveUrl && sonagooUrl && fadelUrl) {
    console.log('Updating database...');
    const { Client } = require('pg');
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    
    await pgClient.query('ALTER TABLE job_offers DISABLE TRIGGER trg_reset_job_offer_moderation');
    await pgClient.query("UPDATE job_offers SET image_url = $1 WHERE company = 'Wave'", [waveUrl]);
    await pgClient.query("UPDATE job_offers SET image_url = $1 WHERE company = 'Sonagoo Transformation Agricole'", [sonagooUrl]);
    await pgClient.query("UPDATE job_offers SET image_url = $1 WHERE company = 'Fadel Digital'", [fadelUrl]);
    await pgClient.query('ALTER TABLE job_offers ENABLE TRIGGER trg_reset_job_offer_moderation');
    
    await pgClient.end();
    console.log('Done!');
  }
}

main();
