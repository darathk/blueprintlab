import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EXERCISE_DB } from '@/lib/exercise-db';

export const dynamic = 'force-dynamic';

// @ts-ignore - Prisma type schema discrepancy
export async function GET() {
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
    try {
        const body = await req.json();
        const { name, category, parent } = body;

        if (!name || !category) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
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
