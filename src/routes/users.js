import { jsonResponse, errorResponse } from '../lib/response.js';
import { requireAuth, requireRole } from '../lib/auth.js';

/**
 * Handle user (admin) routes
 * GET    /api/users
 * POST   /api/users
 * PUT    /api/users/:id
 * DELETE /api/users/:id
 */
export async function handleUsersRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/users — list all admin users (requires auth)
    if (pathname === '/api/users' && method === 'GET') {
        const { user, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(user, ['super_admin', 'dept_admin'], request);
        if (roleErr) return roleErr;

        try {
            const url = new URL(request.url);
            const deptId = url.searchParams.get('department');
            const role = url.searchParams.get('role');

            let query = db.from('profiles').select('*');

            if (deptId) query = query.eq('department_id', deptId);
            if (role) query = query.eq('role', role);

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch users', 500, err.message, request);
        }
    }

    // POST /api/users — create a new dept admin
    if (pathname === '/api/users' && method === 'POST') {
        try {
            if (!supabaseAdmin) {
                return errorResponse('Admin access required', 403, null, request);
            }

            const body = await request.json();
            const { email, password, name, role, department_id } = body;

            if (!email || !password || !name || !role) {
                return errorResponse('Missing required fields', 400, null, request);
            }

            // Create auth user via admin client
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });

            if (authError) {
                return errorResponse('Failed to create user account', 400, authError.message, request);
            }

            // Create profile
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    name,
                    role,
                    department_id: department_id || null,
                    email,
                })
                .select()
                .single();

            if (profileError) {
                // Cleanup: delete auth user if profile creation fails
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                throw profileError;
            }

            return jsonResponse(profile, 201, request);
        } catch (err) {
            return errorResponse('Failed to create user', 500, err.message, request);
        }
    }

    // PUT /api/users/:id — update user (requires auth)
    const putMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
        const { user, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(user, ['super_admin', 'dept_admin'], request);
        if (roleErr) return roleErr;

        try {
            const body = await request.json();
            const userId = putMatch[1];

            // Update profile
            const updateData = {};
            if (body.name) updateData.name = body.name;
            if (body.role) updateData.role = body.role;
            if (body.department_id !== undefined) updateData.department_id = body.department_id;
            updateData.updated_at = new Date().toISOString();

            const { data, error } = await db
                .from('profiles')
                .update(updateData)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            if (!data) return errorResponse('User not found', 404, null, request);

            // If password is being changed
            if (body.password) {
                if (supabaseAdmin) {
                    // Admin client can update any user's password
                    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                        password: body.password,
                    });
                    if (pwError) throw pwError;
                } else {
                    // Fallback: user updating their own password via the regular client
                    const { error: pwError } = await supabase.auth.updateUser({
                        password: body.password,
                    });
                    if (pwError) throw pwError;
                }
            }

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to update user', 500, err.message, request);
        }
    }

    // DELETE /api/users/:id — delete user
    const deleteMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
        try {
            if (!supabaseAdmin) {
                return errorResponse('Admin access required', 403, null, request);
            }

            const userId = deleteMatch[1];

            // Check if super admin
            const { data: profile } = await db
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (profile?.role === 'super_admin') {
                return errorResponse('Cannot delete super admin', 403, null, request);
            }

            // Delete profile
            await db.from('profiles').delete().eq('id', userId);

            // Delete auth user
            await supabaseAdmin.auth.admin.deleteUser(userId);

            return jsonResponse({ message: 'User deleted' }, 200, request);
        } catch (err) {
            return errorResponse('Failed to delete user', 500, err.message, request);
        }
    }

    return null;
}
