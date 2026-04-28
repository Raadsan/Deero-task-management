import { prisma } from '../lib/prisma.js';

async function check() {
  try {
    const res = await prisma.$queryRaw`SHOW TABLES`;
    console.log('Tables:', JSON.stringify(res, null, 2));
    const desc = await prisma.$queryRaw`DESCRIBE notifications`;
    console.log('Notifications Table:', JSON.stringify(desc, null, 2));
  } catch (e) {
    console.error('Error checking DB:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

check();
