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
            SELECT 
                a.id AS "athleteId",
                a.name AS "athleteName",
                latest_msg.content AS "lastMessage",
                COALESCE(latest_msg."createdAt", '1970-01-01T00:00:00Z') AS "lastMessageAt",
                COALESCE(unread_count.count, 0)::int AS "unreadCount"
            FROM "Athlete" a
            LEFT JOIN (
                SELECT DISTINCT ON (partner_id)
                    partner_id,
                    content,
                    "createdAt"
                FROM (
                    SELECT 
                        "senderId", "receiverId", content, "createdAt",
                        CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS partner_id
                    FROM "Message"
                    WHERE "senderId" = $1 OR "receiverId" = $1
                ) m
                ORDER BY partner_id, "createdAt" DESC
            ) latest_msg ON latest_msg.partner_id = a.id
            LEFT JOIN (
                SELECT "senderId", COUNT(*) as count
                FROM "Message"
                WHERE "receiverId" = $1 AND read = false
                GROUP BY "senderId"
            ) unread_count ON unread_count."senderId" = a.id
            WHERE a.id != $1
            ORDER BY "lastMessageAt" DESC;
        `;

        const results = await prisma.$queryRawUnsafe<any[]>(sql, coachId);
        return NextResponse.json(results);
    } catch (error) {
        console.error('GET /api/messages/inbox error:', error);
        return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
    }
}
