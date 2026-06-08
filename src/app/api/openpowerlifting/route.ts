import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { analyzeCompetitor } from '@/lib/openpowerlifting';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get('slug');

        if (!slug) {
            return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
        }

        // Clean slug: lowercase, remove spaces and special characters just in case
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');

        // OpenPowerlifting public CSV API endpoint
        const url = `https://www.openpowerlifting.org/api/liftercsv/${encodeURIComponent(cleanSlug)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AthleteAnalyticsTool/1.0)',
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json({ error: 'Lifter not found on OpenPowerlifting. Make sure the spelling is correct.' }, { status: 404 });
            }
            throw new Error(`OpenPowerlifting API responded with status: ${response.status}`);
        }

        const csvText = await response.text();
        
        // Check if it returned actual CSV or an error HTML page
        if (csvText.includes('<html')) {
             return NextResponse.json({ error: 'Invalid response from OpenPowerlifting' }, { status: 500 });
        }

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        if (parsed.errors.length && parsed.data.length === 0) {
            return NextResponse.json({ error: 'Failed to parse CSV data' }, { status: 500 });
        }

        const meets = parsed.data as any[];
        const profile = analyzeCompetitor(cleanSlug, meets);

        return NextResponse.json({ meets, profile });
    } catch (error: any) {
        console.error('OpenPowerlifting API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
