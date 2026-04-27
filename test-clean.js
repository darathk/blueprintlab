const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.athlete.update({
        where: { id: 'b22a629c-aa72-4bfa-ba39-5f3e8d4f8ccd' },
        data: { pastMeets: [] }
    });
}
main().finally(() => prisma.$disconnect());
