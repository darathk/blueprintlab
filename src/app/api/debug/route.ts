import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const athletes = await prisma.athlete.findMany();
        const programs = await prisma.program.findMany();
        const logs = await prisma.log.findMany();
        const custom = await prisma.customExercise.findMany();

        return NextResponse.json({
            status: "Connection Active",
            counts: {
                athletes: athletes.length,
                programs: programs.length,
                logs: logs.length,
                custom: custom.length
            },
            dataDump: { athletes, programs, logs }
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
