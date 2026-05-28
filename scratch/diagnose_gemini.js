const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const { data, error } = await supabase
    .from('company_settings')
    .select('gemini_api_key')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Database error:', error);
    return;
  }

  const key = data?.gemini_api_key;
  if (!key) {
    console.log('No Gemini API Key found in database');
    return;
  }

  console.log('Testing API key starting with:', key.substring(0, 8));

  // 1. List models
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const body = await res.json();
    if (!res.ok) {
      console.error('List models failed:', res.status, body);
    } else {
      console.log('List models response (first 10 models):', body.models?.slice(0, 10).map((m) => m.name));
    }
  } catch (err) {
    console.error('Error fetching models:', err);
  }

  // 2. Try gemini-1.5-flash with generateContent (v1beta)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    const body = await res.json();
    console.log('v1beta gemini-1.5-flash status:', res.status, body);
  } catch (err) {
    console.error('Error testing v1beta:', err);
  }

  // 3. Try gemini-1.5-flash with generateContent (v1)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    const body = await res.json();
    console.log('v1 gemini-1.5-flash status:', res.status, body);
  } catch (err) {
    console.error('Error testing v1:', err);
  }
}

test();
