require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const res = await client.query("SELECT id, company, title, created_at FROM job_offers WHERE company IN ('Wave', 'Sonagoo Transformation Agricole', 'Fadel Digital') ORDER BY created_at DESC");
  console.log(res.rows);
  client.end();
}).catch(err => console.error(err));
