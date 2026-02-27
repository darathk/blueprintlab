const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config({ path: '.env.local' });

async function migrateCoaches() {
    console.log('🔄 Starting Multi-Coach Migration...');

    // 1. Find the admin coach email from env
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;

    if (!adminEmail) {
        console.error('❌ Could not find NEXT_PUBLIC_ADMIN_EMAIL in environment.');
        process.exit(1);
    }

    // 2. Find or create the admin Coach record
    let coach = await prisma.athlete.findUnique({
        where: { email: adminEmail }
    });

    if (!coach) {
        console.log(`⚠️  Admin coach record not found. Creating one for ${adminEmail}...`);
        coach = await prisma.athlete.create({
            data: {
                name: 'Head Coach',
                email: adminEmail,
                role: 'coach'
            }
        });
    } else {
        // Ensure they have the correct role
        if (coach.role !== 'coach') {
            console.log(`✅ Updating admin record (${adminEmail}) role to 'coach'.`);
            coach = await prisma.athlete.update({
                where: { id: coach.id },
                data: { role: 'coach' }
            });
        } else {
            console.log(`✅ Admin record (${adminEmail}) is already a coach.`);
        }
    }

    console.log(`\n📌 Found Admin Coach: ${coach.name} (${coach.id})`);

    // 3. Re-assign all existing "athletes" to this coach
    //    (We only update athletes who don't already have a coach, and aren't themselves coaches)
    const updateResult = await prisma.athlete.updateMany({
        where: {
            role: 'athlete',
            coachId: null
        },
        data: {
            coachId: coach.id
        }
    });

    console.log(`\n🎉 Migration Complete! Successfully linked ${updateResult.count} existing athletes to your account.`);

    // Verify final count
    const myAthletes = await prisma.athlete.count({
        where: { coachId: coach.id }
    });
    console.log(`📊 You now manage ${myAthletes} total athletes.`);
}

migrateCoaches()
    .catch(e => {
        console.error('❌ Migration failed:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
