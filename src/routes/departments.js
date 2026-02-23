import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle department routes
 * GET    /api/departments
 * GET    /api/departments/:id
 * POST   /api/departments
 * PUT    /api/departments/:id
 * DELETE /api/departments/:id
 */
export async function handleDepartmentsRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/departments — list all
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

    // GET /api/departments/:id
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

    // POST /api/departments — create
    if (pathname === '/api/departments' && method === 'POST') {
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

    // PUT /api/departments/:id — update
    const putMatch = pathname.match(/^\/api\/departments\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
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

    // DELETE /api/departments/:id — delete (cascades papers + users)
    const deleteMatch = pathname.match(/^\/api\/departments\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
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
