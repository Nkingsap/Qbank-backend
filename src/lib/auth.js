import { createClient } from '@supabase/supabase-js';
import { errorResponse } from './response.js';

/**
 * Verify the Bearer JWT and return the Supabase user.
 * Returns { user } on success, or { error: Response } on failure.
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

    return { user };
}

/**
 * Check that the authenticated user has one of the allowed roles.
 * Roles are stored in user.user_metadata.role (set at signup / by admin).
 * Returns null if OK, or a 403 Response if the role is insufficient.
 */
export function requireRole(user, allowedRoles, request) {
    const role = user?.user_metadata?.role;
    if (!allowedRoles.includes(role)) {
        return errorResponse('Forbidden', 403, `Role '${role}' is not allowed. Required: ${allowedRoles.join(', ')}`, request);
    }
    return null;
}
