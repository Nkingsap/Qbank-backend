import { jsonResponse, errorResponse } from '../lib/response.js';
import { requireAuth, requireRole } from '../lib/auth.js';

/**
 * Handle file upload routes
 * POST /api/uploads — dept_admin or super_admin only
 */
export async function handleUploadsRoute(request, supabaseAdmin, pathname, env) {
    const method = request.method;

    // POST /api/uploads — upload a file to Supabase Storage
    if (pathname === '/api/uploads' && method === 'POST') {
        // Verify the caller is an authenticated admin before touching storage
        const { user, role, error: authErr } = await requireAuth(request, env);
        if (authErr) return authErr;
        const roleErr = requireRole(role, ['dept_admin', 'super_admin'], request);
        if (roleErr) return roleErr;

        try {
            if (!supabaseAdmin) {
                return errorResponse('Admin access required for uploads', 403, null, request);
            }

            const formData = await request.formData();
            const file = formData.get('file');

            if (!file) {
                return errorResponse('No file provided', 400, null, request);
            }

            // ── Validation layer 1: MIME type (client-reported, but still useful) ──
            const allowedMimeTypes = ['application/pdf'];
            if (!allowedMimeTypes.includes(file.type)) {
                return errorResponse('Invalid file type. Only PDF files are allowed.', 400, null, request);
            }

            // ── Validation layer 2: File extension ──
            const fileExt = file.name.split('.').pop().toLowerCase();
            if (fileExt !== 'pdf') {
                return errorResponse('Invalid file extension. Only .pdf files are allowed.', 400, null, request);
            }

            // ── Validation layer 3: Magic bytes (%PDF) ──
            // Read only the first 4 bytes to verify the real file signature
            const headerSlice = file.slice(0, 4);
            const headerBuffer = await headerSlice.arrayBuffer();
            const headerBytes = new Uint8Array(headerBuffer);
            const isPdf =
                headerBytes[0] === 0x25 && // %
                headerBytes[1] === 0x50 && // P
                headerBytes[2] === 0x44 && // D
                headerBytes[3] === 0x46;   // F
            if (!isPdf) {
                return errorResponse('File content is not a valid PDF.', 400, null, request);
            }

            // Generate a unique filename
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `papers/${timestamp}_${safeName}`;

            // Upload to Supabase Storage
            const arrayBuffer = await file.arrayBuffer();
            const { data, error } = await supabaseAdmin.storage
                .from('question_papers')
                .upload(filePath, arrayBuffer, {
                    contentType: file.type || 'application/pdf',
                    upsert: false,
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabaseAdmin.storage
                .from('question_papers')
                .getPublicUrl(filePath);

            return jsonResponse({
                url: urlData.publicUrl,
                path: filePath,
                fileName: file.name,
            }, 201, request);
        } catch (err) {
            return errorResponse('Failed to upload file', 500, err.message, request);
        }
    }

    return null;
}
