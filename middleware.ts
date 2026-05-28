import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

type MiddlewareRequest = Request & {
  nextUrl: { pathname: string };
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    set: (cookie: { name: string; value: string; [key: string]: unknown }) => void;
  };
};

/**
 * Standard Next.js 16 Middleware for Supabase Auth
 */
export async function middleware(request: MiddlewareRequest) {
  const { pathname } = request.nextUrl;
  const profileBypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.PROFILE_BYPASS_AUTH === '1';

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
    '/line/imagemap-portal-menu',
    '/api/line/webhook', 
    '/api/cron',        // Allow daily summaries and other crons
  ];
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    if (route === '/api/line/webhook') return pathname === route;
    return pathname.startsWith(route);
  });

  // Local profiling bypass: skip auth checks to capture route performance cleanly.
  if (profileBypassAuth && !isPublicRoute) {
    return NextResponse.next();
  }

  // Early return for non-login public routes to bypass Supabase client creation and session query
  if (isPublicRoute && pathname !== '/login') {
    return NextResponse.next();
  }

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
  const { data: { session }, error } = await supabase.auth.getSession();
  const user = session?.user;

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

