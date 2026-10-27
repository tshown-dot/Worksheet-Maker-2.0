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

async function addStandardsColumns() {
  await client.connect();

  console.log('Adding standard to questions and track_standards to worksheets...');
  await client.query(`
    -- Add track_standards to worksheets
    ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS track_standards BOOLEAN DEFAULT true;

    -- Add standard to questions
    ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS standard TEXT;

    -- Update get_worksheet_manifest RPC to return standard
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
                'columns', w.columns,
                'spacing', w.spacing,
                'track_standards', w.track_standards,
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
                        'standard', q.standard,
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

    NOTIFY pgrst, 'reload schema';
  `);

  console.log('Standards columns and RPC updated successfully!');
  await client.end();
}

addStandardsColumns().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
