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

async function addAuthColumns() {
  await client.connect();

  console.log('Adding teacher_id to folders and setting indexes...');
  await client.query(`
    -- Add teacher_id to folders
    ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS teacher_id UUID NULL;

    -- Add index on worksheets(teacher_id) and folders(teacher_id)
    CREATE INDEX IF NOT EXISTS idx_worksheets_teacher_id ON public.worksheets(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_folders_teacher_id ON public.folders(teacher_id);

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
  `);

  console.log('Successfully updated schema!');
  await client.end();
}

addAuthColumns().catch((err) => {
  console.error(err);
  process.exit(1);
});
