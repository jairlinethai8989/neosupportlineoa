const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key to bypass RLS!
const supabase = createClient(supabaseUrl, supabaseKey);

async function populate() {
  const defaultTemplates = [
    { id: "1", title: "แก้ไขเรียบร้อย", content: "ดำเนินการแก้ไขปัญหาและทดสอบระบบเรียบร้อยแล้วครับ" },
    { id: "2", title: "ส่งมอบงาน", content: "ส่งมอบงานประสานงานสำเร็จ" },
    { id: "3", title: "ยกเลิกงาน", content: "ยกเลิกเนื่องจากแจ้งผิดพลาด" }
  ];

  console.log('Updating company_settings global templates...');
  const { data, error } = await supabase
    .from('company_settings')
    .update({ resolution_templates: defaultTemplates })
    .eq('id', 1)
    .select();

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update succeeded:', JSON.stringify(data, null, 2));
  }
}

populate();
