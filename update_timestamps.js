require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  console.log('Connected, updating timestamps...');
  await client.query('ALTER TABLE job_offers DISABLE TRIGGER trg_reset_job_offer_moderation');
  
  // Stagger the created_at by a few seconds so order is deterministic
  // Newest at the top (Fadel Digital first, then Sonagoo, then Wave, then the other Fadel)
  const now = new Date();
  
  const fadel2Time = new Date(now.getTime() - 1000).toISOString();
  const sonagooTime = new Date(now.getTime() - 2000).toISOString();
  const waveTime = new Date(now.getTime() - 3000).toISOString();
  const fadel1Time = new Date(now.getTime() - 4000).toISOString();

  await client.query("UPDATE job_offers SET created_at = $1 WHERE title = 'Responsable E-commerce & Réseaux Sociaux' AND company = 'Fadel Digital'", [fadel2Time]);
  await client.query("UPDATE job_offers SET created_at = $1 WHERE company = 'Sonagoo Transformation Agricole'", [sonagooTime]);
  await client.query("UPDATE job_offers SET created_at = $1 WHERE company = 'Wave'", [waveTime]);
  await client.query("UPDATE job_offers SET created_at = $1 WHERE title = 'Développeur Informaticien Web' AND company = 'Fadel Digital'", [fadel1Time]);
  
  await client.query('ALTER TABLE job_offers ENABLE TRIGGER trg_reset_job_offer_moderation');
  console.log('Done updating timestamps');
  client.end();
}).catch(err => console.error(err));
