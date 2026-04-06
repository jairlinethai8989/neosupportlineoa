import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * EMERGENCY SETUP ROUTE
 * Use this to create the initial admin user if the database is empty.
 * Visit: /api/setup-admin?key=NEO_SETUP_2026
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  
  if (key !== 'NEO_SETUP_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the env keys
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const email = 'admin@neo.local';
  const password = 'admin1234';

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
      role: 'Admin',
      status: 'Active'
    });

  if (profileError) {
    return NextResponse.json({ error: 'Profile Error: ' + profileError.message });
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Admin account created successfully!',
    email,
    password,
    uuid: user.id
  });
}
