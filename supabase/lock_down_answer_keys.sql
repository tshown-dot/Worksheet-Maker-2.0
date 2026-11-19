-- ==============================================================================
-- WORKSHEET MAKER 2.0 - LOCK DOWN ANSWER KEYS
-- ==============================================================================
-- Before this script, anyone with the site's public key (which is in the site's
-- code) could read every answer key, and anyone with an assignment code (which
-- is printed on every worksheet) could fetch that worksheet's key. After it:
--   * questions (answers, rubrics) can be read only by signed-in teachers on
--     the allowed_teachers list;
--   * the autograder's key lookup only works with the Supabase secret key.
-- Worksheet titles and codes stay readable, so the worksheet list still works.
--
-- RUN ORDER (do not skip):
--   1. lock_down_writes.sql must already have been run (it creates
--      allowed_teachers and is_allowed_teacher()).
--   2. In the Google Sheet, run 'Math Autograder -> Set Supabase Secret Key'
--      and paste the secret key (Supabase Dashboard -> Project Settings ->
--      API Keys -> Secret keys). Without it, grading stops working after step 3.
--   3. Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--
-- TO UNDO: run the two statements in the "UNDO" block at the bottom.
-- ==============================================================================

BEGIN;

-- 1. Answer keys: teachers only
DROP POLICY IF EXISTS "Public can view questions for accessible worksheets" ON public.questions;
DROP POLICY IF EXISTS "Teachers can view questions" ON public.questions;

CREATE POLICY "Teachers can view questions" ON public.questions
    FOR SELECT USING (public.is_allowed_teacher());

-- 2. The autograder's one-call key lookup: secret key only
REVOKE EXECUTE ON FUNCTION public.get_worksheet_manifest(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worksheet_manifest(TEXT) TO service_role;

COMMIT;

-- ------------------------------------------------------------------------------
-- UNDO (only if something breaks and you need the old behaviour back):
--
-- CREATE POLICY "Public can view questions for accessible worksheets" ON public.questions
--     FOR SELECT USING (true);
-- GRANT EXECUTE ON FUNCTION public.get_worksheet_manifest(TEXT) TO anon, authenticated;
-- ------------------------------------------------------------------------------
