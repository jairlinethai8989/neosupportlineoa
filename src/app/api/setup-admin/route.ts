import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * EMERGENCY SETUP ROUTE
 * Use this to create the initial admin user if the database is empty.
 * Visit: /api/setup-admin?key=NEO_SETUP_2026
 */
export async function GET(req: Request) {
  // PROD GUARD
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Setup is disabled in production environment.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  
  const setupKey = process.env.SETUP_KEY;
  if (!setupKey || key !== setupKey) {
    return NextResponse.json({ error: 'Invalid or missing setup key' }, { status: 401 });
  }

  // Use the env keys
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase configuration is missing in environment variables.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, anonKey);

  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json({ error: 'INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD env variable is not set.' }, { status: 500 });
  }

  // 1. Try to Sign Up (This creates the Auth User if allowed by Supabase settings)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    // If user already exists, we might just want to update their profile
    if (!authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Auth Error: ' + authError.message });
    }
  }

  const user = authData?.user;
  if (!user) {
    return NextResponse.json({ message: 'User already exists or check Supabase Auth logs.' });
  }

  // 2. Create the Profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: 'System Admin',
      role: 'Administrator', // Standard Canonical Role
      status: 'Active'
    });

  if (profileError) {
    return NextResponse.json({ error: 'Profile Error: ' + profileError.message });
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Admin account setup completed.',
    email,
    uuid: user.id
  });
}
