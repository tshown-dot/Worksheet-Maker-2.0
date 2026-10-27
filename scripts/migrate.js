import pg from 'pg';
import fs from 'fs';

const regions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-central-1', 'eu-west-1'];
const password = 'nLbpJKgrABKdFuGc';
const projectRef = 'dgmkobsqhlfokquolkqf';
const user = `postgres.${projectRef}`;
const sql = fs.readFileSync('./supabase/schema.sql', 'utf8');

async function tryConnect() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Trying ${host}...`);
    const client = new pg.Client({
      host,
      port: 6543,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`Connected successfully to ${region}! Running migration...`);
      await client.query(sql);
      console.log('Migration executed successfully!');
      await client.end();
      return true;
    } catch (err) {
      console.log(`Failed for ${region}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
  return false;
}

tryConnect().then((success) => {
  if (success) {
    console.log('Database setup complete!');
    process.exit(0);
  } else {
    console.log('Could not connect via pooler automatically.');
    process.exit(1);
  }
});
