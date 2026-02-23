/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:5174',   // Vite alt port
    'http://localhost:3000',   // Alt dev server
    'https://qbank.vercel.app',
];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin) {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    // Allow any *.vercel.app subdomain (preview deployments, etc.)
    if (origin.endsWith('.vercel.app') && origin.startsWith('https://')) return true;
    return false;
}

/**
 * Get CORS headers with validated origin
 */
export function getCorsHeaders(request) {
    const origin = request?.headers?.get('Origin') || '';
    const isAllowed = isOriginAllowed(origin);
    const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
}

/**
 * Handle CORS preflight requests
 */
export function corsPreflightResponse(request) {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
    });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data, status = 200, request = null) {
    const headers = request ? getCorsHeaders(request) : getCorsHeaders({ headers: { get: () => null } });
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Create an error response (details logged server-side only)
 */
export function errorResponse(message, status = 500, details = null, request = null) {
    if (details) {
        console.error(`[Error ${status}] ${message}:`, details);
    }
    return jsonResponse({ error: message }, status, request);
}
