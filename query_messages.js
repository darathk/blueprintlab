const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const msgs = await prisma.message.findMany({
    where: {
      content: {
        contains: 'Feedback'
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(msgs);
}
run();
