import { createClient } from '@supabase/supabase-js';
import { errorResponse } from './response.js';

/**
 * Verify the Bearer JWT and return the Supabase user + their profile role.
 * Returns { user, role } on success, or { error: Response } on failure.
 *
 * NOTE: roles are stored in the `profiles` table, NOT in user_metadata,
 * because users are created via supabaseAdmin.auth.admin.createUser() which
 * does not set user_metadata automatically.
 */
export async function requireAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: errorResponse('Unauthorized', 401, 'Missing or invalid Authorization header', request) };
    }

    const token = authHeader.substring(7);

    // Use the admin client to validate the token cryptographically — this calls
    // Supabase's auth.getUser() which verifies the JWT signature server-side.
    const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: { user }, error } = await adminClient.auth.getUser(token);

    if (error || !user) {
        return { error: errorResponse('Unauthorized', 401, error?.message || 'Invalid token', request) };
    }

    // Fetch the role from the profiles table (source of truth for roles)
    const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const role = profile?.role ?? null;

    return { user, role };
}

/**
 * Check that the authenticated user has one of the allowed roles.
 * Pass the `role` string returned by requireAuth (not the user object).
 * Returns null if OK, or a 403 Response if the role is insufficient.
 */
export function requireRole(role, allowedRoles, request) {
    if (!allowedRoles.includes(role)) {
        return errorResponse('Forbidden', 403, `Role '${role}' is not allowed. Required: ${allowedRoles.join(', ')}`, request);
    }
    return null;
}
