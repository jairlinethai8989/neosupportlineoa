import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isPublicRequestPath } from '@/lib/auth/routeAccess';

type ProxyRequest = Request & {
  nextUrl: { pathname: string; search: string };
  cookies: {
    getAll: () => Array<{ name: string; value: string }>;
    set: (cookie: { name: string; value: string; [key: string]: unknown }) => void;
  };
};

/**
 * Next.js Proxy performs optimistic navigation checks only.
 * Server Actions and Route Handlers must enforce authorization independently.
 */
export async function proxy(request: ProxyRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublicRoute = isPublicRequestPath(pathname);
  const profileBypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.PROFILE_BYPASS_AUTH === '1';

  if (profileBypassAuth && !isPublicRoute) {
    return NextResponse.next();
  }

  if (isPublicRoute && pathname !== '/login') {
    return NextResponse.next();
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname === '/login') {
    return user ? NextResponse.redirect(new URL('/', request.url)) : response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)',
  ],
};
