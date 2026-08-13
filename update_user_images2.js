require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  console.log('Connected');
  await client.query('ALTER TABLE job_offers DISABLE TRIGGER trg_reset_job_offer_moderation');
  
  await client.query("UPDATE job_offers SET image_url = '/pub.jpg' WHERE company = 'Wave'");
  await client.query("UPDATE job_offers SET image_url = '/pub3.jpg' WHERE company = 'Sonagoo Transformation Agricole'");
  await client.query("UPDATE job_offers SET image_url = '/pub2.jpg' WHERE company = 'Fadel Digital'");
  
  await client.query('ALTER TABLE job_offers ENABLE TRIGGER trg_reset_job_offer_moderation');
  console.log('Done');
  client.end();
}).catch(err => console.error(err));
