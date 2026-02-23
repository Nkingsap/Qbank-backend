import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle favorites routes
 * GET  /api/favorites
 * POST /api/favorites/:paperId
 */
export async function handleFavoritesRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    // GET /api/favorites — list user's favorites
    if (pathname === '/api/favorites' && method === 'GET') {
        try {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) {
                return errorResponse('Not authenticated', 401, null, request);
            }

            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);

            if (!user) return errorResponse('Not authenticated', 401, null, request);

            const { data, error } = await db
                .from('favorites')
                .select('paper_id')
                .eq('user_id', user.id);

            if (error) throw error;

            return jsonResponse(data.map(f => f.paper_id), 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch favorites', 500, err.message, request);
        }
    }

    // POST /api/favorites/:paperId — toggle favorite
    const toggleMatch = pathname.match(/^\/api\/favorites\/([^/]+)$/);
    if (toggleMatch && method === 'POST') {
        try {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) {
                return errorResponse('Not authenticated', 401, null, request);
            }

            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabase.auth.getUser(token);

            if (!user) return errorResponse('Not authenticated', 401, null, request);

            const paperId = toggleMatch[1];

            // Check if already favorited
            const { data: existing } = await db
                .from('favorites')
                .select('*')
                .eq('user_id', user.id)
                .eq('paper_id', paperId)
                .single();

            if (existing) {
                // Remove favorite
                await db.from('favorites').delete()
                    .eq('user_id', user.id)
                    .eq('paper_id', paperId);
                return jsonResponse({ favorited: false }, 200, request);
            } else {
                // Add favorite
                await db.from('favorites').insert({
                    user_id: user.id,
                    paper_id: paperId,
                });
                return jsonResponse({ favorited: true }, 200, request);
            }
        } catch (err) {
            return errorResponse('Failed to toggle favorite', 500, err.message, request);
        }
    }

    return null;
}
