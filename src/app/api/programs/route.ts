import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const programs = await prisma.program.findMany();
        return NextResponse.json(programs);
    } catch (error) {
        console.error('API GET /programs error:', error);
        return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const program = await request.json();

        if (!program.name || !program.weeks || !program.athleteId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newProgram = await prisma.program.create({
            data: {
                id: program.id || undefined, // Prisma auto-generates uuid if undefined
                athleteId: program.athleteId,
                name: program.name,
                startDate: program.startDate || new Date().toISOString(),
                endDate: program.endDate || null,
                weeks: program.weeks,
                status: program.status || 'active'
            }
        });

        // Set all other programs for this athlete to completed if a new active one is pushed
        if (newProgram.status === 'active') {
            await prisma.program.updateMany({
                where: {
                    athleteId: program.athleteId,
                    id: { not: newProgram.id },
                    status: 'active'
                },
                data: { status: 'completed' }
            });
        }

        return NextResponse.json(newProgram, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const program = await request.json();

        if (!program.id) {
            return NextResponse.json({ error: 'Missing program ID' }, { status: 400 });
        }

        const updatedProgram = await prisma.program.update({
            where: { id: program.id },
            data: {
                name: program.name !== undefined ? program.name : undefined,
                startDate: program.startDate !== undefined ? program.startDate : undefined,
                endDate: program.endDate !== undefined ? program.endDate : undefined,
                weeks: program.weeks !== undefined ? program.weeks : undefined,
                status: program.status !== undefined ? program.status : undefined,
            }
        });

        return NextResponse.json(updatedProgram, { status: 200 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing program ID' }, { status: 400 });
    }

    try {
        // First delete associated logs due to foreign key constraints
        await prisma.log.deleteMany({ where: { programId: id } });

        // Then delete the program
        await prisma.program.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
