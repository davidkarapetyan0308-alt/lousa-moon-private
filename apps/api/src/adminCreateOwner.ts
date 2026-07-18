import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { prisma } from './db/prisma';
import { hashSecret } from './security/hash';

async function main() {
  // 1. Connection check
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error('❌ Database connection failed. Is PostgreSQL running?');
    if (e instanceof Error) console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  // Check if owner already exists
  const existingOwner = await (prisma as any).adminUser.findFirst({ where: { role: 'OWNER' } });
  const forceMode = process.argv.includes('--force');
  
  if (existingOwner && !forceMode) {
    console.error('❌ An OWNER admin user already exists. To create another or update, run with --force.');
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin as any, output: process.stdout as any });
  
  try {
    const emailInput = await rl.question('Owner email: ');
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format.');
    }

    const nameInput = await rl.question('Owner name: ');
    const name = nameInput.trim() || 'LOUSA Owner';

    const password = await rl.question('Owner password: ');
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters.');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new Error('Password must contain at least one letter and one number.');
    }

    const confirmPassword = await rl.question('Confirm password: ');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const passwordHash = await hashSecret(password);
    
    // Upsert the OWNER
    const owner = await (prisma as any).adminUser.upsert({
      where: { email },
      update: { name, passwordHash, role: 'OWNER', isActive: true },
      create: { email, name, passwordHash, role: 'OWNER', isActive: true }
    });

    // Write to audit log
    await (prisma as any).auditLog.create({
      data: {
        actorId: owner.id,
        actorRole: 'OWNER',
        action: 'OWNER_CREATED',
        entityType: 'AdminUser',
        entityId: owner.id,
        metadata: { source: 'cli', email: owner.email }
      }
    });

    console.log('\n==============================================');
    console.log('✅ Owner created successfully.');
    console.log('Now run to start dev environment:');
    console.log('   npm run dev:api');
    console.log('   npm run admin:dev');
    console.log('\nOpen in browser:');
    console.log('   http://localhost:3000');
    console.log('Log in using the email and password you just entered.');
    console.log('==============================================');

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error('\n❌ An unknown error occurred.');
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
