import 'dotenv/config';
import { prisma } from './db/prisma';
import { loadApiEnv } from './config/env';

async function main() {
  console.log('🔍 LOUSA OWNER Diagnostics...');
  
  let dbStatus = 'Disconnected';
  let adminCount = 0;
  let ownerExists = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'Connected';
    
    adminCount = await (prisma as any).adminUser.count();
    const owner = await (prisma as any).adminUser.findFirst({ where: { role: 'OWNER' } });
    ownerExists = !!owner;
  } catch (_e) {
    dbStatus = 'Connection Failed';
    console.error('❌ Failed to connect to database.');
  }

  const env = loadApiEnv();

  console.log('\n==============================================');
  console.log(`Database Link Status : ${dbStatus}`);
  console.log(`Environment          : ${env.appEnv || 'development'}`);
  console.log(`API Port             : ${env.port || 4100}`);
  console.log(`Admin Users Count    : ${adminCount}`);
  console.log(`Owner Account Exists : ${ownerExists ? 'Yes ✅' : 'No ❌'}`);
  console.log('==============================================');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
