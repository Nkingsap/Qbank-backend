import { jsonResponse, errorResponse } from '../lib/response.js';

/**
 * Handle stats routes
 * GET /api/stats
 */
export async function handleStatsRoute(request, supabase, pathname, supabaseAdmin, env) {
    const method = request.method;
    const db = supabaseAdmin || supabase;

    if (pathname === '/api/stats' && method === 'GET') {
        try {
            // Fetch all data in parallel
            const [papersRes, deptsRes, usersRes] = await Promise.all([
                db.from('papers').select('*'),
                db.from('departments').select('*'),
                db.from('profiles').select('*').eq('role', 'dept_admin'),
            ]);

            const papers = papersRes.data || [];
            const depts = deptsRes.data || [];
            const admins = usersRes.data || [];

            const totalPapers = papers.length;
            const totalDepartments = depts.length;
            const totalAdmins = admins.length;
            const totalDownloads = papers.reduce((sum, p) => sum + (p.downloads || 0), 0);
            const totalViews = papers.reduce((sum, p) => sum + (p.views || 0), 0);

            const papersByDept = depts.map(d => ({
                department: d.name,
                code: d.code,
                count: papers.filter(p => p.department_id === d.id).length,
            }));

            const examTypes = ['Weekly Test 1', 'Weekly Test 2', 'CIA 1', 'CIA 2', 'End Semester'];
            const papersByExam = examTypes.map(type => ({
                type,
                count: papers.filter(p => p.exam_type === type).length,
            }));

            const papersBySemester = Array.from({ length: 8 }, (_, i) => ({
                semester: i + 1,
                count: papers.filter(p => p.semester === i + 1).length,
            }));

            const recentUploads = papers
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10);

            return jsonResponse({
                totalPapers,
                totalDepartments,
                totalAdmins,
                totalDownloads,
                totalViews,
                papersByDept,
                papersByExam,
                papersBySemester,
                recentUploads,
            }, 200, request);
        } catch (err) {
            return errorResponse('Failed to fetch stats', 500, err.message, request);
        }
    }

    return null;
}
