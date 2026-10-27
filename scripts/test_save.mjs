import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dgmkobsqhlfokquolkqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KtjE2Vm9pkp9DRTKzzprcg_kyP4LMMK';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSave() {
  const { data, error } = await supabase
    .from('worksheets')
    .upsert({
      short_code: 'TEST-COL',
      title: 'Test Columns Saving',
      subject: 'Math',
      grade_level: '7th Grade',
      folder_name: 'General',
      columns: 2,
      spacing: 'balanced',
      total_pages: 1,
      student_id_digits: 3,
      layout_config: { columns: 2, spacing: 'balanced' },
    }, { onConflict: 'short_code' })
    .select('id, short_code, columns, spacing');

  if (error) {
    console.error('Save test error:', error);
  } else {
    console.log('Save test SUCCESS:', data);
  }
}

testSave();
