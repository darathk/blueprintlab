import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    const rawFilename = searchParams.get('filename') || 'highlight.mp4';

    if (!videoUrl) {
        return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
    }

    try {
        const parsed = new URL(videoUrl);

        // Security check: only proxy from trusted Supabase storage host
        const isSupabase = parsed.hostname.endsWith('.supabase.co') || parsed.hostname.includes('supabase');
        if (!isSupabase) {
            return NextResponse.json({ error: 'Untrusted host' }, { status: 400 });
        }

        // Clean filename to prevent header injection
        const cleanFilename = rawFilename
            .replace(/[^\w\s.-]/gi, '_')
            .replace(/\s+/g, '_');

        const upstream = await fetch(videoUrl);
        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Failed to fetch file from storage (${upstream.status})` },
                { status: upstream.status }
            );
        }

        const contentType = upstream.headers.get('content-type') || (cleanFilename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
        const contentLength = upstream.headers.get('content-length');

        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Content-Disposition', `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`);
        if (contentLength) {
            headers.set('Content-Length', contentLength);
        }
        headers.set('Cache-Control', 'private, max-age=300');

        return new Response(upstream.body, {
            status: 200,
            headers,
        });
    } catch (err: any) {
        console.error('Highlights download proxy error:', err);
        return NextResponse.json({ error: 'Internal download error' }, { status: 500 });
    }
}
