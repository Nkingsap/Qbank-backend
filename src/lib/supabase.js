import { createClient } from '@supabase/supabase-js';

/**
 * Initialize Supabase client with user's auth token (for RLS-scoped queries)
 */
export function getSupabaseClient(env, authHeader = null) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    let accessToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
    }

    const options = {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
        global: {
            headers: {},
        },
    };

    if (authHeader) {
        options.global.headers.Authorization = authHeader;
    }

    const client = createClient(supabaseUrl, supabaseKey, options);
    return { client, accessToken };
}

/**
 * Initialize Supabase admin client (bypasses RLS — server-side only)
 */
export function getSupabaseAdminClient(env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}

/**
 * Safely get admin client — returns null if service role key is not configured
 */
export function getSupabaseAdminClientSafe(env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not configured, admin client unavailable');
        return null;
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}
