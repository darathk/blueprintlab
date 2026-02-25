const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const coachId = '2a3fa461-12f0-4df2-aa45-e110c9502b48'; // Or any UUID

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

    try {
        const result = await prisma.$queryRawUnsafe(sql, coachId);
        console.log(result);
    } catch (e) {
        console.error(e);
    }
    
    await prisma.$disconnect();
}
main();
