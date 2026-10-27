-- ==============================================================================
-- WORKSHEET MAKER 2.0 & AUTOGRADER - SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. WORKSHEETS TABLE
-- Stores metadata and layout styling presets for math worksheets
CREATE TABLE IF NOT EXISTS public.worksheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_code TEXT UNIQUE NOT NULL,                       -- e.g. 'ALG-701' for QR code encoding
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,                                   -- e.g. 'Unit 3: Two-Step Equations'
    subject TEXT DEFAULT 'Mathematics',
    grade_level TEXT DEFAULT '7th Grade',
    style_preset TEXT DEFAULT 'homework',                  -- 'homework', 'pod', 'quiz', 'exit_ticket'
    total_pages INT DEFAULT 1 CHECK (total_pages IN (1, 2)),
    student_id_digits INT DEFAULT 3 CHECK (student_id_digits BETWEEN 3 AND 8),
    layout_config JSONB DEFAULT '{
        "border_style": "solid",
        "show_dot_grid": false,
        "columns": 1,
        "show_honor_pledge": false
    }'::jsonb,
    is_public BOOLEAN DEFAULT true,                        -- Allow sharing between teachers
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. QUESTIONS TABLE
-- Stores problems, correct answer keys, points, rubric notes, and millimeter bounding boxes
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worksheet_id UUID REFERENCES public.worksheets(id) ON DELETE CASCADE NOT NULL,
    order_index INT NOT NULL,                              -- 1, 2, 3...
    page_number INT DEFAULT 1 CHECK (page_number IN (1, 2)),
    prompt TEXT NOT NULL,                                  -- Supports LaTeX e.g. \frac{2}{3}x + 5 = 15
    diagram_url TEXT,                                      -- Optional geometry or coordinate diagram image
    question_type TEXT DEFAULT 'numeric',                  -- 'numeric', 'fraction', 'expression', 'multiple_choice', 'multi_step'
    options JSONB DEFAULT '[]'::jsonb,                     -- Options for multiple choice: [{"label": "A", "text": "x = 5"}, ...]
    correct_answer TEXT NOT NULL,                          -- Ground truth answer e.g. '7' or '-3/4' or '2x + 1'
    acceptable_alternatives JSONB DEFAULT '[]'::jsonb,     -- Alternative valid formats: ["0.5", "1/2"]
    points NUMERIC(4, 1) DEFAULT 1.0,
    rubric_notes TEXT,                                     -- Hints for AI autograder (e.g. "Check negative sign")
    bounding_box JSONB DEFAULT '{
        "work_box": {"x": 15, "y": 65, "w": 120, "h": 50},
        "answer_box": {"x": 140, "y": 80, "w": 55, "h": 25}
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_worksheets_short_code ON public.worksheets(short_code);
CREATE INDEX IF NOT EXISTS idx_questions_worksheet_id ON public.questions(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_questions_page_order ON public.questions(worksheet_id, page_number, order_index);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public can view worksheets by short_code or if public" ON public.worksheets;
DROP POLICY IF EXISTS "Authenticated users can create worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Users can update their own worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Users can delete their own worksheets" ON public.worksheets;

DROP POLICY IF EXISTS "Public can view questions for accessible worksheets" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can manage questions" ON public.questions;

-- Policies for worksheets:
CREATE POLICY "Public can view worksheets by short_code or if public"
    ON public.worksheets FOR SELECT
    USING (true); -- Autograder and students/teachers can read by short code

CREATE POLICY "Anyone can create or save worksheets"
    ON public.worksheets FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update worksheets"
    ON public.worksheets FOR UPDATE
    USING (true);

CREATE POLICY "Anyone can delete worksheets"
    ON public.worksheets FOR DELETE
    USING (true);

-- Policies for questions:
CREATE POLICY "Public can view questions for accessible worksheets"
    ON public.questions FOR SELECT
    USING (true);

CREATE POLICY "Anyone can manage questions"
    ON public.questions FOR ALL
    USING (true);

-- 4. AUTOGRADER MANIFEST API (RPC FUNCTION)
-- Google Apps Script calls this single endpoint to get the entire key + coordinates in one shot!
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

-- Grant execution permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_worksheet_manifest(TEXT) TO anon, authenticated, service_role;

-- 5. STORAGE BUCKET FOR PROBLEM DIAGRAMS
INSERT INTO storage.buckets (id, name, public)
VALUES ('worksheet-diagrams', 'worksheet-diagrams', true)
ON CONFLICT (id) DO NOTHING;

-- Storage public read policy
DROP POLICY IF EXISTS "Public can view diagrams" ON storage.objects;
CREATE POLICY "Public can view diagrams"
ON storage.objects FOR SELECT
USING (bucket_id = 'worksheet-diagrams');

-- Storage upload policy
DROP POLICY IF EXISTS "Anyone can upload diagrams" ON storage.objects;
CREATE POLICY "Anyone can upload diagrams"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worksheet-diagrams');
