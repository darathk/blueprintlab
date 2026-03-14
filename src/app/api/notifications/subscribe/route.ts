import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = user.primaryEmailAddress?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 400 });

        const athlete = await prisma.athlete.findUnique({
            where: { email }
        });
        if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Push Subscription Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
