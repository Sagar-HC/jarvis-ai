const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Raw SQL query
    const rawResult = await prisma.$queryRaw`SELECT 1 as is_alive`;
    
    // 2. Query table counts
    const userCount = await prisma.user.count();
    const taskCount = await prisma.task.count();
    const stepCount = await prisma.taskStep.count();
    const memoryCount = await prisma.memoryRecord.count();
    const integrationCount = await prisma.integration.count();
    const deviceCount = await prisma.device.count();

    console.log(JSON.stringify({
      status: 'CONNECTED',
      database: 'SQLite (dev.db)',
      ping: 'SUCCESS (SELECT 1 returned ' + rawResult[0].is_alive + ')',
      records: {
        users: userCount,
        tasks: taskCount,
        steps: stepCount,
        memories: memoryCount,
        integrations: integrationCount,
        devices: deviceCount
      }
    }, null, 2));
  } catch (error) {
    console.error('DATABASE_CONNECTION_ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
