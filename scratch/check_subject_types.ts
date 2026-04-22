
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addSubjectTypesColumn() {
  console.log('Attempting to add subject_types column...');
  
  // Note: We use the SQL editor usually, but I'll try to check if I can just update the row 
  // if I've already added it via some other way, but I haven't.
  // Since I can't run RAW SQL via standard REST, I'll have to rely on the fact that 
  // the user might have to run it, OR I can try to see if it's already there.
  
  // I'll use a hacky way to check if column exists by trying to select it.
  const { error } = await supabaseAdmin.from('company_settings').select('subject_types').limit(1);
  
  if (error && error.code === 'PGRST204') {
     console.log('Column subject_types does NOT exist. You need to run SQL:');
     console.log('ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS subject_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];');
     console.log("UPDATE public.company_settings SET subject_types = ARRAY['ลบ', 'แก้ไขออเดอร์', 'แจ้ง error', 'เรื่องอื่นๆ'] WHERE id = (SELECT id FROM public.company_settings LIMIT 1);");
  } else if (!error) {
     console.log('Column subject_types already exists.');
  } else {
     console.error('Error:', error);
  }
}

addSubjectTypesColumn();
