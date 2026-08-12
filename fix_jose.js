const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.program.update({
    where: { id: 'dacd8790-dfa7-4c72-8828-2c5ddadc0e29' },
    data: { status: 'active' }
  });
  console.log("Fixed Jose Vargas's program");
}
run();
