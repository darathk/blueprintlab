import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Ensure program exists before logging
        const programRecord = await prisma.program.findUnique({
            where: { id: body.programId }
        });

        if (!programRecord) {
            return NextResponse.json({ error: 'Linked program not found' }, { status: 404 });
        }

        // Check if log already exists for this session
        const existingLog = await prisma.log.findFirst({
            where: {
                sessionId: body.sessionId,
                programId: body.programId
            }
        });

        if (existingLog) {
            await prisma.log.update({
                where: { id: existingLog.id },
                data: {
                    date: body.date,
                    exercises: body.exercises,
                }
            });
        } else {
            await prisma.log.create({
                data: {
                    id: body.id || Math.random().toString(36).substring(7),
                    programId: body.programId,
                    sessionId: body.sessionId,
                    date: body.date,
                    exercises: body.exercises,
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get('athleteId');

    try {
        const logs = await prisma.log.findMany({
            where: athleteId ? {
                program: { athleteId: athleteId }
            } : undefined,
            include: {
                program: {
                    select: { athleteId: true }
                }
            }
        });

        const formattedLogs = logs.map(l => {
            const { program, ...rest } = l;
            return {
                ...rest,
                athleteId: program ? program.athleteId : null
            };
        });

        return NextResponse.json(formattedLogs);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
