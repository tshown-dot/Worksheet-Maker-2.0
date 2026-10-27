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

async function addFolders() {
  await client.connect();

  console.log('Adding folders schema...');
  await client.query(`
    -- Create folders table
    CREATE TABLE IF NOT EXISTS public.folders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT 'blue',
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Enable RLS
    ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

    -- Drop and create open policies for school folder management
    DROP POLICY IF EXISTS "Public can manage folders" ON public.folders;
    CREATE POLICY "Public can manage folders" ON public.folders FOR ALL USING (true) WITH CHECK (true);

    -- Add folder_name column to worksheets
    ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS folder_name TEXT DEFAULT 'General';

    -- Insert default folders if empty
    INSERT INTO public.folders (name, color) VALUES
      ('Unit 1: Number Systems', 'amber'),
      ('Unit 2: Expressions & Equations', 'blue'),
      ('Unit 3: Ratios & Proportions', 'emerald'),
      ('Daily Warm-Ups (POD)', 'purple')
    ON CONFLICT (name) DO NOTHING;
  `);

  console.log('Folders table and columns created successfully!');

  // Update get_worksheet_manifest RPC to include folder_name
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_worksheet_manifest(lookup_code TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        result JSONB;
    BEGIN
        SELECT jsonb_build_object(
            'worksheet', jsonb_build_object(
                'id', w.id,
                'short_code', w.short_code,
                'title', w.title,
                'subject', w.subject,
                'grade_level', w.grade_level,
                'folder_name', w.folder_name,
                'style_preset', w.style_preset,
                'total_pages', w.total_pages,
                'student_id_digits', w.student_id_digits,
                'layout_config', w.layout_config
            ),
            'questions', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', q.id,
                        'order_index', q.order_index,
                        'page_number', q.page_number,
                        'prompt', q.prompt,
                        'diagram_url', q.diagram_url,
                        'question_type', q.question_type,
                        'options', q.options,
                        'correct_answer', q.correct_answer,
                        'acceptable_alternatives', q.acceptable_alternatives,
                        'points', q.points,
                        'rubric_notes', q.rubric_notes,
                        'bounding_box', q.bounding_box
                    ) ORDER BY q.page_number, q.order_index
                ), '[]'::jsonb)
                FROM public.questions q
                WHERE q.worksheet_id = w.id
            )
        ) INTO result
        FROM public.worksheets w
        WHERE UPPER(w.short_code) = UPPER(lookup_code)
        LIMIT 1;

        RETURN result;
    END;
    $$;
  `);

  console.log('Updated get_worksheet_manifest RPC.');
  await client.end();
}

addFolders().catch(err => {
  console.error('Folder migration error:', err);
  process.exit(1);
});
