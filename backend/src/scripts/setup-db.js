import { prisma } from '../lib/prisma.js';

async function setup() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(191) NOT NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        taskId VARCHAR(191) NOT NULL,
        taskName VARCHAR(191) NOT NULL,
        assigneeName VARCHAR(191) NOT NULL,
        deadline DATETIME(3) NOT NULL,
        type VARCHAR(191) NOT NULL,
        userId VARCHAR(191) NOT NULL,
        isSeen TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('Table created or already exists.');
  } catch (e) {
    console.error('Error creating table:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

setup();
