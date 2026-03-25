import { NextRequest, NextResponse } from 'next/server';

const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const TENOR_CLIENT_KEY = 'blueprintlab';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const trending = searchParams.get('trending');
    const limit = 20;

    if (!TENOR_API_KEY) {
        return NextResponse.json({ results: [], error: 'TENOR_API_KEY not configured' }, { status: 200 });
    }

    try {
        let url: string;
        if (trending || !query) {
            url = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=${limit}&media_filter=gif,tinygif`;
        } else {
            url = `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&media_filter=gif,tinygif`;
        }

        const res = await fetch(url, { next: { revalidate: 300 } });
        if (!res.ok) {
            throw new Error(`Tenor API error: ${res.status}`);
        }

        const data = await res.json();
        interface TenorMediaFormat { url: string; dims?: number[] }
        interface TenorResult { id: string; media_formats?: Record<string, TenorMediaFormat> }
        const results = (data.results || []).map((item: TenorResult) => ({
            id: item.id,
            previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
            url: item.media_formats?.gif?.url || '',
            width: item.media_formats?.gif?.dims?.[0] || 200,
            height: item.media_formats?.gif?.dims?.[1] || 200,
        }));

        return NextResponse.json({ results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to fetch GIFs';
        console.error('Tenor API error:', e);
        return NextResponse.json({ results: [], error: message }, { status: 200 });
    }
}
