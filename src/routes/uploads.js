import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle file upload routes
 * POST /api/uploads
 */
export async function handleUploadsRoute(request, supabaseAdmin, pathname, env) {
    const method = request.method;

    // POST /api/uploads — upload a file to Supabase Storage
    if (pathname === '/api/uploads' && method === 'POST') {
        try {
            if (!supabaseAdmin) {
                return errorResponse('Admin access required for uploads', 403, null, request);
            }

            const formData = await request.formData();
            const file = formData.get('file');

            if (!file) {
                return errorResponse('No file provided', 400, null, request);
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
