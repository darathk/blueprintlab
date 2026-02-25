import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/messages/inbox?coachId=X — lightweight: returns conversation list with unread counts only
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachId = searchParams.get('coachId');

        if (!coachId) {
            return NextResponse.json({ error: 'coachId is required' }, { status: 400 });
        }

        // Use a raw Postgres query to natively compute latest message grouping & unread sums
        const sql = `
            SELECT DISTINCT ON (partner_id)
                partner_id AS "athleteId",
                a.name AS "athleteName",
                m.content AS "lastMessage",
                m."createdAt" AS "lastMessageAt",
                (
                    SELECT COUNT(*)::int
                    FROM "Message" unread
                    WHERE unread."receiverId" = $1
                      AND unread."senderId" = partner_id
                      AND unread.read = false
                ) AS "unreadCount"
            FROM (
                SELECT 
                    "senderId", "receiverId", content, "createdAt",
                    CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS partner_id
                FROM "Message"
                WHERE "senderId" = $1 OR "receiverId" = $1
            ) m
            JOIN "Athlete" a ON a.id = m.partner_id
            ORDER BY partner_id, m."createdAt" DESC;
        `;

        const results = await prisma.$queryRawUnsafe<any[]>(sql, coachId);

        // Sort by last message time globally (DISTINCT ON only allows sorting by the DISTINCT key first)
        const sorted = results.sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );

        return NextResponse.json(sorted);
    } catch (error) {
        console.error('GET /api/messages/inbox error:', error);
        return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }
}
