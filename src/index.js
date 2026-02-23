/**
 * QBankV2 Backend — Cloudflare Worker API
 * Routes incoming requests to appropriate handlers.
 */

import { getSupabaseClient, getSupabaseAdminClient, getSupabaseAdminClientSafe } from './lib/supabase.js';
import { corsPreflightResponse, errorResponse, jsonResponse } from './lib/response.js';
import { handleAuthRoute } from './routes/auth.js';
import { handleDepartmentsRoute } from './routes/departments.js';
import { handlePapersRoute } from './routes/papers.js';
import { handleUsersRoute } from './routes/users.js';
import { handleFavoritesRoute } from './routes/favorites.js';
import { handleActivityRoute } from './routes/activity.js';
import { handleStatsRoute } from './routes/stats.js';
import { handleUploadsRoute } from './routes/uploads.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return corsPreflightResponse(request);
        }

        // Health check
        if (pathname === '/api/health') {
            return jsonResponse({
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            }, 200, request);
        }

        try {
            // Initialize Supabase client
            const authHeader = request.headers.get('Authorization');
            const { client: supabase, accessToken } = getSupabaseClient(env, authHeader);
            const supabaseAdmin = getSupabaseAdminClientSafe(env);

            let response = null;

            // Route to handlers
            if (pathname.startsWith('/api/auth')) {
                response = await handleAuthRoute(request, supabase, pathname, env);
            }
            else if (pathname.startsWith('/api/departments')) {
                response = await handleDepartmentsRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname.startsWith('/api/papers')) {
                response = await handlePapersRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname.startsWith('/api/users')) {
                response = await handleUsersRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname.startsWith('/api/favorites')) {
                response = await handleFavoritesRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname.startsWith('/api/activity')) {
                response = await handleActivityRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname === '/api/stats') {
                response = await handleStatsRoute(request, supabase, pathname, supabaseAdmin, env);
            }
            else if (pathname.startsWith('/api/uploads')) {
                response = await handleUploadsRoute(request, supabaseAdmin, pathname, env);
            }

            if (response) return response;

            return errorResponse('Endpoint not found', 404, `${pathname} does not exist`, request);

        } catch (error) {
            console.error('Unhandled error:', error);
            return errorResponse('Internal server error', 500, error.message, request);
        }
    },
};
