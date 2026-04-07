import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const KLIPY_API_KEY = process.env.KLIPY_API_KEY || '';
const KLIPY_CLIENT_KEY = 'blueprintlab';

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const trending = searchParams.get('trending');
    const limit = 20;

    if (!KLIPY_API_KEY) {
        return NextResponse.json({ results: [], error: 'KLIPY_API_KEY not configured' }, { status: 200 });
    }

    try {
        let url: string;
        if (trending || !query) {
            url = `https://api.klipy.com/v2/featured?key=${KLIPY_API_KEY}&client_key=${KLIPY_CLIENT_KEY}&limit=${limit}&media_filter=gif,tinygif`;
        } else {
            url = `https://api.klipy.com/v2/search?key=${KLIPY_API_KEY}&client_key=${KLIPY_CLIENT_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&media_filter=gif,tinygif`;
        }

        const res = await fetch(url, { next: { revalidate: 300 } });
        if (!res.ok) {
            throw new Error(`Klipy API error: ${res.status}`);
        }

        const data = await res.json();
        interface KlipyMediaFormat { url: string; dims?: number[] }
        interface KlipyResult { id: string; media_formats?: Record<string, KlipyMediaFormat> }
        const results = (data.results || []).map((item: KlipyResult) => ({
            id: item.id,
            previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
            url: item.media_formats?.gif?.url || '',
            width: item.media_formats?.gif?.dims?.[0] || 200,
            height: item.media_formats?.gif?.dims?.[1] || 200,
        }));

        return NextResponse.json({ results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to fetch GIFs';
        console.error('Klipy API error:', e);
        return NextResponse.json({ results: [], error: message }, { status: 200 });
    }
}
