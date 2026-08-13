require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  console.log('Connected');
  await client.query('ALTER TABLE job_offers DISABLE TRIGGER trg_reset_job_offer_moderation');
  const res = await client.query("UPDATE job_offers SET status = 'approved', is_test_account = false WHERE company IN ('Wave', 'Sonagoo Transformation Agricole', 'Fadel Digital') RETURNING *");
  console.log('Updated', res.rowCount);
  await client.query('ALTER TABLE job_offers ENABLE TRIGGER trg_reset_job_offer_moderation');
  console.log('Done');
  client.end();
}).catch(err => console.error(err));
