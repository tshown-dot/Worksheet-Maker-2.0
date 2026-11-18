-- ==============================================================================
-- WORKSHEET MAKER 2.0 - LOCK DOWN WRITES
-- ==============================================================================
-- Before this script, anyone with the site's public key could create, edit or
-- delete any worksheet, answer key, folder or diagram. After it, only signed-in
-- teachers whose email is in public.allowed_teachers can. Reading is unchanged,
-- so the autograder and the worksheet list keep working.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste this whole file.
-- FIRST edit the email on the INSERT line below to the Google account you sign
-- in to Worksheet Maker with. After running, you must be signed in to save.
-- ==============================================================================

BEGIN;

-- 1. Who counts as a teacher
CREATE TABLE IF NOT EXISTS public.allowed_teachers (
    email TEXT PRIMARY KEY
);
ALTER TABLE public.allowed_teachers ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the database owner (SQL Editor) can read or edit it.

INSERT INTO public.allowed_teachers (email)
VALUES ('REPLACE-WITH-YOUR-SIGN-IN-EMAIL@example.com')   -- <-- EDIT THIS
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_allowed_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.allowed_teachers t
        WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_teacher() TO anon, authenticated;

-- 2. Worksheets: anyone may read, only teachers may write
DROP POLICY IF EXISTS "Anyone can create or save worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Anyone can update worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Anyone can delete worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Teachers can insert worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Teachers can update worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Teachers can delete worksheets" ON public.worksheets;

CREATE POLICY "Teachers can insert worksheets" ON public.worksheets
    FOR INSERT WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can update worksheets" ON public.worksheets
    FOR UPDATE USING (public.is_allowed_teacher()) WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can delete worksheets" ON public.worksheets
    FOR DELETE USING (public.is_allowed_teacher());

-- 3. Questions (the answer keys)
DROP POLICY IF EXISTS "Anyone can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Teachers can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Teachers can update questions" ON public.questions;
DROP POLICY IF EXISTS "Teachers can delete questions" ON public.questions;

CREATE POLICY "Teachers can insert questions" ON public.questions
    FOR INSERT WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can update questions" ON public.questions
    FOR UPDATE USING (public.is_allowed_teacher()) WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can delete questions" ON public.questions
    FOR DELETE USING (public.is_allowed_teacher());

-- 4. Folders
DROP POLICY IF EXISTS "Public can manage folders" ON public.folders;
DROP POLICY IF EXISTS "Public can view folders" ON public.folders;
DROP POLICY IF EXISTS "Teachers can insert folders" ON public.folders;
DROP POLICY IF EXISTS "Teachers can update folders" ON public.folders;
DROP POLICY IF EXISTS "Teachers can delete folders" ON public.folders;

CREATE POLICY "Public can view folders" ON public.folders
    FOR SELECT USING (true);
CREATE POLICY "Teachers can insert folders" ON public.folders
    FOR INSERT WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can update folders" ON public.folders
    FOR UPDATE USING (public.is_allowed_teacher()) WITH CHECK (public.is_allowed_teacher());
CREATE POLICY "Teachers can delete folders" ON public.folders
    FOR DELETE USING (public.is_allowed_teacher());

-- 5. Diagram uploads
DROP POLICY IF EXISTS "Anyone can upload diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload diagrams" ON storage.objects;
CREATE POLICY "Teachers can upload diagrams" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'worksheet-diagrams' AND public.is_allowed_teacher());

COMMIT;
