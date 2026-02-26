import { jsonResponse, errorResponse } from '../lib/response.js';
import { requireAuth, requireRole } from '../lib/auth.js';

/**
 * Handle department routes
 * GET    /api/departments         — public
 * GET    /api/departments/:id     — public
 * POST   /api/departments         — super_admin only
 * PUT    /api/departments/:id     — super_admin only
 * DELETE /api/departments/:id     — super_admin only
 */
export async function handleDepartmentsRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/departments — list all (public)
    if (pathname === '/api/departments' && method === 'GET') {
        try {
            const { data, error } = await db
                .from('departments')
                .select('*')
                .order('name');

            if (error) throw error;
            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch departments', 500, err.message, request);
        }
    }

    // GET /api/departments/:id (public)
    const getMatch = pathname.match(/^\/api\/departments\/([^/]+)$/);
    if (getMatch && method === 'GET') {
        try {
            const { data, error } = await db
                .from('departments')
                .select('*')
                .eq('id', getMatch[1])
                .single();

            if (error) throw error;
            if (!data) return errorResponse('Department not found', 404, null, request);

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch department', 500, err.message, request);
        }
    }

    // POST /api/departments — create (super_admin only)
    if (pathname === '/api/departments' && method === 'POST') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const body = await request.json();
            const { name, code } = body;

            if (!name || !code) {
                return errorResponse('Name and code are required', 400, null, request);
            }

            // Check for duplicate code
            const { data: existing } = await db
                .from('departments')
                .select('id')
                .ilike('code', code)
                .single();

            if (existing) {
                return errorResponse('Department code already exists', 400, null, request);
            }

            const { data, error } = await db
                .from('departments')
                .insert({ name, code })
                .select()
                .single();

            if (error) throw error;
            return jsonResponse(data, 201, request);
        } catch (err) {
            return errorResponse('Failed to create department', 500, err.message, request);
        }
    }

    // PUT /api/departments/:id — update (super_admin only)
    const putMatch = pathname.match(/^\/api\/departments\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const body = await request.json();
            const { data, error } = await db
                .from('departments')
                .update({ ...body, updated_at: new Date().toISOString() })
                .eq('id', putMatch[1])
                .select()
                .single();

            if (error) throw error;
            if (!data) return errorResponse('Department not found', 404, null, request);

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to update department', 500, err.message, request);
        }
    }

    // DELETE /api/departments/:id — delete (super_admin only, cascades papers + users)
    const deleteMatch = pathname.match(/^\/api\/departments\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const deptId = deleteMatch[1];

            // Delete papers in this department
            await db.from('papers').delete().eq('department_id', deptId);

            // Delete admins of this department
            await db.from('profiles').delete().eq('department_id', deptId).eq('role', 'dept_admin');

            // Delete the department
            const { error } = await db.from('departments').delete().eq('id', deptId);
            if (error) throw error;

            return jsonResponse({ message: 'Department deleted' }, 200, request);
        } catch (err) {
            return errorResponse('Failed to delete department', 500, err.message, request);
        }
    }

    return null;
}
