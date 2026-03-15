
import { prisma } from './src/lib/prisma.ts';

async function main() {
    console.log('--- Prisma Model Keys ---');
    console.log(Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));

    console.log('\n--- Checking Message Table ---');
    try {
        const columns: any = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Message'
    `;
        console.log('Columns in Message table:');
        columns.forEach((c: any) => console.log(` - ${c.column_name}: ${c.data_type}`));
    } catch (e) {
        console.log('Error querying information_schema:', e.message);
    }

    console.log('\n--- Checking PushSubscription Table ---');
    try {
        const columns: any = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'PushSubscription'
    `;
        console.log('Columns in PushSubscription table:');
        columns.forEach((c: any) => console.log(` - ${c.column_name}: ${c.data_type}`));
    } catch (e) {
        console.log('Error querying information_schema:', e.message);
    }

    process.exit(0);
}

main();
