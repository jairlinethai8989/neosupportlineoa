import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Standard Next.js 16 Middleware for Supabase Auth
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets and internal paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Define Public Routes (Sensitive)
  const PUBLIC_ROUTES = [
    '/login',
    '/portal',
    '/survey',
    '/api/line/webhook', 
    '/api/cron',        // Allow daily summaries and other crons
  ];
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    if (route === '/api/line/webhook') return pathname === route;
    return pathname.startsWith(route);
  });

  // 3. Setup Response & Supabase
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

  // 4. Authenticate User
  const { data: { user }, error } = await supabase.auth.getUser();

  // 5. Logic
  if (isPublicRoute) {
    if (user && pathname === '/login') {
       return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  if (!user || error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
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
