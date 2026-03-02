const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        try {
            await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "Message";`);
            console.log('Successfully added Message to supabase_realtime publication.');
        } catch (err) {
            if (err.message && err.message.includes('already exists')) {
                console.log('Message table is already in supabase_realtime publication.');
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error('Error enabling realtime:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
