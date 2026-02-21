import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';



export async function GET() {
    try {
        const athletes = await prisma.athlete.findMany();
        const programs = await prisma.program.findMany();
        const logs = await prisma.log.findMany();
        // @ts-ignore - Prisma type schema discrepancy
        const customExercises = await prisma.customExercise.findMany();

        return NextResponse.json({
            status: "Connection Active",
            counts: {
                athletes: athletes.length,
                programs: programs.length,
                logs: logs.length,
                customExercises: customExercises.length
            },
            dataDump: { athletes, programs, logs }
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
