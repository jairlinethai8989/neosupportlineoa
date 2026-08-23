import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getStaffAuth } from '@/lib/auth/staffAuthorization'

export async function GET() {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const auth = await getStaffAuth({ roles: ['Administrator'] })
  if (!auth) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  const cookieStore = await cookies()

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
    },
    cookiesPresent: cookieStore.getAll().length > 0,
    envPresent: !!process.env.NEXT_PUBLIC_SUPABASE_URL
  })
}
