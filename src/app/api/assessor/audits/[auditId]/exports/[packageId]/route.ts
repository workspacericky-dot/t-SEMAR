import { getAssessorExportDownload } from '@/lib/actions/assessor-actions';

export async function GET(_request: Request, { params }: { params: Promise<{ auditId: string; packageId: string }> }) {
    const { auditId, packageId } = await params;
    const result = await getAssessorExportDownload(auditId, packageId);
    if (result.error || !result.payload) {
        return Response.json({ error: result.error || 'Paket ekspor tidak tersedia.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const payload = result.payload;
    const filename = `tsemar-${payload.exam_type}-${payload.audit_id.slice(0, 8)}-${payload.package_id.slice(0, 8)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
