import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EXERCISE_DB } from '@/lib/exercise-db';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// @ts-ignore - Prisma type schema discrepancy
export async function GET() {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const customExercisesRaw = await prisma.customExercise.findMany();

        // Transform static DB to array
        const staticExercises = Object.entries(EXERCISE_DB).map(([name, data]) => ({
            name,
            ...data
        }));

        return NextResponse.json({
            static: staticExercises,
            custom: customExercisesRaw
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const body = await req.json();
        const { name, category, parent } = body;

        if (!name || !category) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Validate input lengths
        if (typeof name !== 'string' || name.length > 100) {
            return NextResponse.json({ error: 'Invalid exercise name' }, { status: 400 });
        }
        if (typeof category !== 'string' || category.length > 50) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        // Check duplicates in static DB first
        if (EXERCISE_DB[name as keyof typeof EXERCISE_DB]) {
            return NextResponse.json({ error: 'Exercise already exists in core database' }, { status: 409 });
        }

        // @ts-ignore - Prisma type schema discrepancy
        const newExercise = await prisma.customExercise.create({
            data: {
                name,
                category,
                parent: parent || name,
                isCustom: true
            }
        });

        return NextResponse.json(newExercise);
    } catch (e: any) {
        if (e.code === 'P2002') {
            return NextResponse.json({ error: 'Exercise already exists' }, { status: 409 });
        }
        console.error(e);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

// @ts-ignore - Prisma type schema discrepancy
export async function DELETE(req: Request) {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json({ error: 'Missing exercise name' }, { status: 400 });
        }

        // Refuse to delete a static/core exercise — those come from code, not DB.
        if (EXERCISE_DB[name as keyof typeof EXERCISE_DB]) {
            return NextResponse.json({ error: 'Cannot delete built-in exercise' }, { status: 403 });
        }

        // @ts-ignore - Prisma type schema discrepancy
        const existing = await prisma.customExercise.findUnique({ where: { name } });
        if (!existing) {
            return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
        }

        // @ts-ignore - Prisma type schema discrepancy
        await prisma.customExercise.delete({ where: { name } });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
