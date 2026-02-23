import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle auth routes
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */
export async function handleAuthRoute(request, supabase, pathname, env) {
    const method = request.method;

    // POST /api/auth/login
    if (pathname === '/api/auth/login' && method === 'POST') {
        try {
            const { email, password } = await request.json();

            if (!email || !password) {
                return errorResponse('Email and password are required', 400, null, request);
            }

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                return errorResponse('Invalid email or password', 401, error.message, request);
            }

            // Fetch user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            return jsonResponse({
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    ...profile,
                },
                session: {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                },
            }, 200, request);
        } catch (err) {
            return errorResponse('Login failed', 500, err.message, request);
        }
    }

    // POST /api/auth/logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
        try {
            await supabase.auth.signOut();
            return jsonResponse({ message: 'Logged out successfully' }, 200, request);
        } catch (err) {
            return errorResponse('Logout failed', 500, err.message, request);
        }
    }

    // GET /api/auth/me
    if (pathname === '/api/auth/me' && method === 'GET') {
        try {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) {
                return errorResponse('Not authenticated', 401, null, request);
            }

            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                return errorResponse('Invalid token', 401, error?.message, request);
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            return jsonResponse({
                user: {
                    id: user.id,
                    email: user.email,
                    ...profile,
                },
            }, 200, request);
        } catch (err) {
            return errorResponse('Failed to get user', 500, err.message, request);
        }
    }

    return null;
}
