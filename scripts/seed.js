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

async function seed() {
  await client.connect();

  // Check if DEMO-701 already exists
  const existing = await client.query("SELECT id FROM public.worksheets WHERE short_code = 'DEMO-701'");
  let worksheetId;
  if (existing.rows.length === 0) {
    const wsRes = await client.query(`
      INSERT INTO public.worksheets (
        short_code, title, subject, grade_level, style_preset, total_pages, student_id_digits, layout_config
      ) VALUES (
        'DEMO-701',
        'Unit 3: Two-Step & Multi-Step Equations',
        'Mathematics',
        '7th Grade',
        'homework',
        1,
        3,
        '{"border_style": "solid", "show_dot_grid": false, "columns": 1}'::jsonb
      ) RETURNING id;
    `);
    worksheetId = wsRes.rows[0].id;

    // Add 4 questions
    const q1 = await client.query(`
      INSERT INTO public.questions (
        worksheet_id, order_index, page_number, prompt, question_type, correct_answer, acceptable_alternatives, points, rubric_notes, bounding_box
      ) VALUES (
        $1, 1, 1,
        'Solve for x: \\quad 3x + 7 = 22',
        'numeric',
        '5',
        '["x = 5", "5"]'::jsonb,
        2.0,
        'Full credit for x = 5. Award 1 point if student subtracted 7 correctly (3x = 15) but made division error.',
        '{"work_box": {"x_mm": 15, "y_mm": 70, "w_mm": 115, "h_mm": 45}, "answer_box": {"x_mm": 135, "y_mm": 80, "w_mm": 65, "h_mm": 30}}'::jsonb
      )
    `, [worksheetId]);

    const q2 = await client.query(`
      INSERT INTO public.questions (
        worksheet_id, order_index, page_number, prompt, question_type, correct_answer, acceptable_alternatives, points, rubric_notes, bounding_box
      ) VALUES (
        $1, 2, 1,
        'Solve for y: \\quad \\frac{y}{4} - 3 = 5',
        'numeric',
        '32',
        '["y = 32", "32"]'::jsonb,
        2.0,
        'Full credit for y = 32. Partial credit (1 pt) if student added 3 to get y/4 = 8.',
        '{"work_box": {"x_mm": 15, "y_mm": 120, "w_mm": 115, "h_mm": 45}, "answer_box": {"x_mm": 135, "y_mm": 130, "w_mm": 65, "h_mm": 30}}'::jsonb
      )
    `, [worksheetId]);

    const q3 = await client.query(`
      INSERT INTO public.questions (
        worksheet_id, order_index, page_number, prompt, question_type, correct_answer, acceptable_alternatives, points, rubric_notes, bounding_box
      ) VALUES (
        $1, 3, 1,
        'Solve for m: \\quad 2(m + 4) = 18',
        'numeric',
        '5',
        '["m = 5", "5"]'::jsonb,
        2.0,
        'Student may distribute (2m + 8 = 18) or divide by 2 first (m + 4 = 9). Both are valid.',
        '{"work_box": {"x_mm": 15, "y_mm": 170, "w_mm": 115, "h_mm": 45}, "answer_box": {"x_mm": 135, "y_mm": 180, "w_mm": 65, "h_mm": 30}}'::jsonb
      )
    `, [worksheetId]);

    const q4 = await client.query(`
      INSERT INTO public.questions (
        worksheet_id, order_index, page_number, prompt, question_type, correct_answer, acceptable_alternatives, points, rubric_notes, bounding_box
      ) VALUES (
        $1, 4, 1,
        'A cell phone plan costs $35 per month plus $0.10 per text message. Write and solve an equation to find how many text messages (t) were sent if the total bill was $52.50.',
        'numeric',
        '175',
        '["175", "175 texts", "t = 175"]'::jsonb,
        3.0,
        'Equation: 35 + 0.10t = 52.50. 0.10t = 17.50 -> t = 175.',
        '{"work_box": {"x_mm": 15, "y_mm": 220, "w_mm": 115, "h_mm": 45}, "answer_box": {"x_mm": 135, "y_mm": 230, "w_mm": 65, "h_mm": 30}}'::jsonb
      )
    `, [worksheetId]);

    console.log('Seeded DEMO-701 with 4 questions!');
  } else {
    worksheetId = existing.rows[0].id;
    console.log('DEMO-701 already exists.');
  }

  // Test RPC function
  const rpcRes = await client.query("SELECT public.get_worksheet_manifest('DEMO-701') as manifest;");
  console.log('Manifest test output:');
  console.log(JSON.stringify(rpcRes.rows[0].manifest, null, 2));

  await client.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
