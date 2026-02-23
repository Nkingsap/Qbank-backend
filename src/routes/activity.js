import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle activity log routes
 * GET  /api/activity
 * POST /api/activity
 */
export async function handleActivityRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/activity — get recent activity
    if (pathname === '/api/activity' && method === 'GET') {
        try {
            const url = new URL(request.url);
            const limit = parseInt(url.searchParams.get('limit')) || 50;
            const userId = url.searchParams.get('user_id');

            let query = db
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            // If user_id is provided, filter to only that user's activity
            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;

            if (error) throw error;
            return jsonResponse(data, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch activity', 500, err.message, request);
        }
    }

    // POST /api/activity — log activity
    if (pathname === '/api/activity' && method === 'POST') {
        try {
            const body = await request.json();
            const { type, message, user_id } = body;

            const { data, error } = await db
                .from('activity_logs')
                .insert({ type, message, user_id })
                .select()
                .single();

            if (error) throw error;
            return jsonResponse(data, 201, request);
        } catch (err) {
            return errorResponse('Failed to log activity', 500, err.message, request);
        }
    }

    return null;
}
