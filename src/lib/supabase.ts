import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dgmkobsqhlfokquolkqf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KtjE2Vm9pkp9DRTKzzprcg_kyP4LMMK';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
