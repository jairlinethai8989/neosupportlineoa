import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Routes ที่ไม่ต้อง login (Public routes)
const PUBLIC_ROUTES = [
  '/login',
  '/portal',
  '/survey',
  '/api/line',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function middleware(request: any) {
  const { pathname } = request.nextUrl;

  // ข้าม static files และ Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Public routes — ไม่ต้องตรวจ auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // สร้าง response ตั้งต้น
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // ใช้ getUser() แทน getSession() — ปลอดภัยกว่าเพราะ validate JWT บน server
  const { data: { user } } = await supabase.auth.getUser();

  // ถ้ายังไม่ login → redirect ไป /login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ถ้า login แล้ว แต่เข้าหน้า /login → redirect ไป dashboard
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
