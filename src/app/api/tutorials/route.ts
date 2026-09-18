import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireCoach } from '@/lib/api-auth';

function detectPlatform(url: string): string {
    const lower = (url || '').toLowerCase();
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    return 'other';
}

export async function GET(request: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const query = (searchParams.get('q') || '').trim().toLowerCase();

        const whereClause: any = {};
        if (category && category.toLowerCase() !== 'all') {
            whereClause.category = {
                equals: category.toLowerCase(),
                mode: 'insensitive',
            };
        }

        const tutorials = await prisma.videoTutorial.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
        });

        // In-memory filter for flexible multi-field keyword search
        let filtered = tutorials;
        if (query) {
            filtered = tutorials.filter(t => {
                const inTitle = t.title.toLowerCase().includes(query);
                const inDesc = (t.description || '').toLowerCase().includes(query);
                const inCat = t.category.toLowerCase().includes(query);
                const inTags = Array.isArray(t.tags) && (t.tags as string[]).some(tag => String(tag).toLowerCase().includes(query));
                return inTitle || inDesc || inCat || inTags;
            });
        }

        return NextResponse.json({ tutorials: filtered });
    } catch (error) {
        console.error('Error fetching tutorials:', error);
        return NextResponse.json({ error: 'Failed to fetch tutorials' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireCoach();
    if ('error' in auth) return auth.error;

    try {
        const body = await request.json();
        const { title, videoUrl, category, description, tags } = body;

        if (!title || !videoUrl || !category) {
            return NextResponse.json({ error: 'Title, Video URL, and Category are required' }, { status: 400 });
        }

        const platform = detectPlatform(videoUrl);
        const normalizedCategory = category.trim().toLowerCase();

        const tutorial = await prisma.videoTutorial.create({
            data: {
                title: title.trim(),
                videoUrl: videoUrl.trim(),
                category: normalizedCategory,
                description: description?.trim() || null,
                platform,
                tags: Array.isArray(tags) ? tags : [],
                coachId: auth.user.id,
            },
        });

        return NextResponse.json({ success: true, tutorial });
    } catch (error) {
        console.error('Error creating tutorial:', error);
        return NextResponse.json({ error: 'Failed to create tutorial' }, { status: 500 });
    }
}
