import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
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
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Define public paths that don't require auth
    const publicPaths = ['/login', '/register', '/auth/callback'];
    const isPublicPath = publicPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    );

    if (!user && !isPublicPath) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (user) {
        // If user is logged in, check if they need onboarding
        // We only do this check for dashboard routes to avoid infinite loops on static assets
        const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
        const isOnboardingRoute = request.nextUrl.pathname === '/onboarding';

        if (isDashboardRoute || isOnboardingRoute) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, training_group')
                .eq('id', user.id)
                .single();

            // Logic:
            // 1. If NO profile -> MUST go to /onboarding (to create one)
            // 2. If NOT superadmin AND NO training_group -> MUST go to /onboarding
            // 3. If (Superadmin OR HAS training_group) AND IS /onboarding -> MUST go to /dashboard

            let needsOnboarding = false;

            if (!profile) {
                needsOnboarding = true;
            } else {
                needsOnboarding = profile.role !== 'superadmin' && !profile.training_group;
            }

            if (needsOnboarding && !isOnboardingRoute) {
                const url = request.nextUrl.clone();
                url.pathname = '/onboarding';
                return NextResponse.redirect(url);
            }

            if (!needsOnboarding && isOnboardingRoute) {
                const url = request.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url);
            }
        }

        if (isPublicPath) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}
