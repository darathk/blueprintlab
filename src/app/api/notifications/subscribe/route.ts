import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 400 });

        // Find the athlete/coach record by email
        const athlete = await prisma.athlete.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { id: true, role: true, name: true }
        });

        if (!athlete) {
            console.error(`[Push Subscribe] No athlete record found for email: ${email}`);
            return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
        }

        const { subscription } = await req.json();
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        // Upsert the subscription
        await prisma.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                athleteId: athlete.id,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            },
            create: {
                athleteId: athlete.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            }
        });

        console.log(`[Push Subscribe] Saved subscription for ${athlete.name} (${athlete.role}) — ${athlete.id}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Push Subscribe] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
