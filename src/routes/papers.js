import { jsonResponse, errorResponse } from '../lib/response.js';
import { requireAuth, requireRole } from '../lib/auth.js';

/**
 * Handle paper routes
 * GET    /api/papers              — public
 * GET    /api/papers/:id          — public
 * POST   /api/papers/:id/views    — public (anonymous counter)
 * POST   /api/papers/:id/downloads — public (anonymous counter)
 * POST   /api/papers              — dept_admin or super_admin
 * PUT    /api/papers/:id          — dept_admin or super_admin
 * DELETE /api/papers/:id          — dept_admin or super_admin
 */
export async function handlePapersRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/papers — list with filters (public)
    if (pathname === '/api/papers' && method === 'GET') {
        try {
            const url = new URL(request.url);
            let query = db.from('papers').select('*');

            const departmentId = url.searchParams.get('department');
            const semester = url.searchParams.get('semester');
            const examType = url.searchParams.get('examType');
            const year = url.searchParams.get('year');
            const search = url.searchParams.get('search');
            const sortBy = url.searchParams.get('sortBy') || 'newest';

            if (departmentId) query = query.eq('department_id', departmentId);
            if (semester) query = query.eq('semester', Number(semester));
            if (examType) query = query.eq('exam_type', examType);
            if (year) query = query.eq('year', year);
            if (search) {
                query = query.or(`subject.ilike.%${search}%,subject_code.ilike.%${search}%,description.ilike.%${search}%`);
            }

            // Sorting
            if (sortBy === 'newest') {
                query = query.order('created_at', { ascending: false });
            } else if (sortBy === 'oldest') {
                query = query.order('created_at', { ascending: true });
            } else if (sortBy === 'name') {
                query = query.order('subject', { ascending: true });
            } else if (sortBy === 'downloads') {
                query = query.order('downloads', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch papers', 500, err.message, request);
        }
    }

    // POST /api/papers/:id/views — increment views (public — anonymous counter)
    const viewsMatch = pathname.match(/^\/api\/papers\/([^/]+)\/views$/);
    if (viewsMatch && method === 'POST') {
        try {
            const { data: paper } = await db
                .from('papers')
                .select('views')
                .eq('id', viewsMatch[1])
                .single();

            if (!paper) return errorResponse('Paper not found', 404, null, request);

            const { error } = await db
                .from('papers')
                .update({ views: (paper.views || 0) + 1 })
                .eq('id', viewsMatch[1]);

            if (error) throw error;
            return jsonResponse({ message: 'Views incremented' }, 200, request);
        } catch (err) {
            return errorResponse('Failed to increment views', 500, err.message, request);
        }
    }

    // POST /api/papers/:id/downloads — increment downloads (public — anonymous counter)
    const downloadsMatch = pathname.match(/^\/api\/papers\/([^/]+)\/downloads$/);
    if (downloadsMatch && method === 'POST') {
        try {
            const { data: paper } = await db
                .from('papers')
                .select('downloads')
                .eq('id', downloadsMatch[1])
                .single();

            if (!paper) return errorResponse('Paper not found', 404, null, request);

            const { error } = await db
                .from('papers')
                .update({ downloads: (paper.downloads || 0) + 1 })
                .eq('id', downloadsMatch[1]);

            if (error) throw error;
            return jsonResponse({ message: 'Downloads incremented' }, 200, request);
        } catch (err) {
            return errorResponse('Failed to increment downloads', 500, err.message, request);
        }
    }

    // GET /api/papers/:id — single paper (public)
    const getMatch = pathname.match(/^\/api\/papers\/([^/]+)$/);
    if (getMatch && method === 'GET') {
        try {
            const { data, error } = await db
                .from('papers')
                .select('*')
                .eq('id', getMatch[1])
                .single();

            if (error) throw error;
            if (!data) return errorResponse('Paper not found', 404, null, request);

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch paper', 500, err.message, request);
        }
    }

    // POST /api/papers — create (dept_admin or super_admin)
    if (pathname === '/api/papers' && method === 'POST') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['dept_admin', 'super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const body = await request.json();
            const { subject, subject_code, department_id, semester, exam_type, year, description, file_url, uploaded_by, uploaded_by_name } = body;

            if (!subject || !department_id || !semester || !exam_type || !year) {
                return errorResponse('Missing required fields', 400, null, request);
            }

            const { data, error } = await db
                .from('papers')
                .insert({
                    subject,
                    subject_code: subject_code || null,
                    department_id,
                    semester,
                    exam_type,
                    year,
                    description: description || null,
                    file_url: file_url || null,
                    uploaded_by: uploaded_by || null,
                    uploaded_by_name: uploaded_by_name || null,
                    views: 0,
                    downloads: 0,
                })
                .select()
                .single();

            if (error) throw error;
            return jsonResponse(data, 201, request);
        } catch (err) {
            return errorResponse('Failed to create paper', 500, err.message, request);
        }
    }

    // PUT /api/papers/:id — update (dept_admin or super_admin)
    const putMatch = pathname.match(/^\/api\/papers\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['dept_admin', 'super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const body = await request.json();
            const { data, error } = await db
                .from('papers')
                .update({ ...body, updated_at: new Date().toISOString() })
                .eq('id', putMatch[1])
                .select()
                .single();

            if (error) throw error;
            if (!data) return errorResponse('Paper not found', 404, null, request);

            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to update paper', 500, err.message, request);
        }
    }

    // DELETE /api/papers/:id — (dept_admin or super_admin)
    const deleteMatch = pathname.match(/^\/api\/papers\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['dept_admin', 'super_admin'], request);
        if (roleErr) return roleErr;

        try {
            const { error } = await db.from('papers').delete().eq('id', deleteMatch[1]);
            if (error) throw error;
            return jsonResponse({ message: 'Paper deleted' }, 200, request);
        } catch (err) {
            return errorResponse('Failed to delete paper', 500, err.message, request);
        }
    }

    return null;
}
