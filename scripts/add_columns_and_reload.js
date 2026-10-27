import pg from 'pg';

const host = 'aws-0-us-east-2.pooler.supabase.com';
const client = new pg.Client({
  host,
  port: 6543,
  user: 'postgres.dgmkobsqhlfokquolkqf',
  password: 'nLbpJKgrABKdFuGc',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function addColumns() {
  await client.connect();

  console.log('Adding columns and spacing to public.worksheets...');
  await client.query(`
    ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS columns INT DEFAULT 2;
    ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS spacing TEXT DEFAULT 'balanced';

    -- Notify PostgREST to reload its schema cache immediately!
    NOTIFY pgrst, 'reload schema';
  `);

  console.log('Columns added and schema cache reloaded!');

  // Verify columns exist
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'worksheets';
  `);
  console.log('Worksheet columns:', res.rows.map(r => r.column_name).join(', '));

  await client.end();
}

addColumns().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
