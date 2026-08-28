require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function approveOffer() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to PG');
    await client.query('ALTER TABLE job_offers DISABLE TRIGGER trg_reset_job_offer_moderation');
    const res = await client.query("UPDATE job_offers SET status = 'approved', is_active = true, is_test_account = false WHERE id = 'fa161041-9194-427c-85dc-440bcd9e8b06' RETURNING id, title, status");
    console.log('Updated rows:', res.rows);
    await client.query('ALTER TABLE job_offers ENABLE TRIGGER trg_reset_job_offer_moderation');
    console.log('Trigger re-enabled');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

approveOffer();
