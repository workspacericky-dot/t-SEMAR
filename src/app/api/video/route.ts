import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'web-ready-logo-gas.mp4');
        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Video API error:', error);
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
}
