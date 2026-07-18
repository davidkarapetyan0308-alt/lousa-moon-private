import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashSecret } from './security/hash';

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  if (isProduction) {
    console.error('❌ Dev seed is disabled in production.');
    process.exit(1);
  }

  console.log('🌱 Seeding development environment database...');

  // 1. Create 3 products
  const products = [
    { sku: 'dev-tea', nameRu: 'Dev Травяной чай', nameEn: 'Dev Herbal Tea', nameHy: 'Dev Բուսական Թեյ', category: 'wellness', price: 90000, stock: 50 },
    { sku: 'dev-chocolate', nameRu: 'Dev Шоколад', nameEn: 'Dev Chocolate', nameHy: 'Dev Շոկոլադ', category: 'food', price: 80000, stock: 100 },
    { sku: 'dev-heat-pad', nameRu: 'Dev Грелка', nameEn: 'Dev Heat Pad', nameHy: 'Dev Տաքացնող Փաթեթ', category: 'wellness', price: 190000, stock: 40 }
  ];

  const productIds: Record<string, string> = {};

  for (const p of products) {
    const product = await (prisma as any).productCatalogItem.upsert({
      where: { sku: p.sku },
      update: { nameRu: p.nameRu, nameEn: p.nameEn, nameHy: p.nameHy, category: p.category, isActive: true },
      create: { sku: p.sku, nameRu: p.nameRu, nameEn: p.nameEn, nameHy: p.nameHy, category: p.category, isActive: true }
    });
    productIds[p.sku] = product.id;

    // Price
    const price = await (prisma as any).productPrice.findFirst({ where: { productId: product.id, currency: 'AMD', validUntil: null } });
    if (!price) {
      await (prisma as any).productPrice.create({ data: { productId: product.id, amountMinor: p.price, currency: 'AMD', priceVersion: 1 } });
    }

    // Inventory
    await (prisma as any).inventoryItem.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: 'gyumri-main' } },
      update: { availableQuantity: p.stock },
      create: { productId: product.id, warehouseId: 'gyumri-main', availableQuantity: p.stock, reservedQuantity: 0 }
    });
  }

  // 2. Create 3 plans
  const plans = [
    { code: 'dev-essential', name: 'Dev Essential', price: 1290000, includedUnits: 16 },
    { code: 'dev-comfort', name: 'Dev Comfort', price: 1690000, includedUnits: 24 },
    { code: 'dev-ritual', name: 'Dev Moon Ritual', price: 2490000, includedUnits: 32 }
  ];

  const planIds: Record<string, string> = {};

  for (const pl of plans) {
    const plan = await (prisma as any).boxPlan.upsert({
      where: { code: pl.code },
      update: { name: pl.name, basePriceMinor: pl.price, includedUnits: pl.includedUnits, currency: 'AMD', isActive: true },
      create: { code: pl.code, name: pl.name, basePriceMinor: pl.price, includedUnits: pl.includedUnits, currency: 'AMD', isActive: true }
    });
    planIds[pl.code] = plan.id;
  }

  // 3. Create 2 users
  const user1 = await prisma.user.upsert({
    where: { email: 'dev-user-1@lousa.app' },
    update: {},
    create: {
      email: 'dev-user-1@lousa.app',
      emailVerifiedAt: new Date(),
      passwordHash: await hashSecret('UserPassword1'),
      name: 'Ани Dev',
      language: 'ru',
      status: 'active'
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'dev-user-2@lousa.app' },
    update: {},
    create: {
      email: 'dev-user-2@lousa.app',
      emailVerifiedAt: new Date(),
      passwordHash: await hashSecret('UserPassword2'),
      name: 'Мари Dev',
      language: 'ru',
      status: 'active'
    }
  });

  // Ensure delivery zone
  await (prisma as any).deliveryZone.upsert({
    where: { id: 'gyumri-main-zone' },
    update: {},
    create: { id: 'gyumri-main-zone', name: 'Gyumri Standard', type: 'radius', centerLat: 40.7894, centerLng: 43.8475, radiusKm: 15, baseFeeMinor: 0, currency: 'AMD', isActive: true }
  });

  // 4. Create 2 quotes & orders
  // Order 1
  const quote1 = await (prisma as any).orderQuote.create({
    data: {
      userId: user1.id,
      planId: planIds['dev-essential'],
      basePriceMinor: 1290000,
      totalMinor: 1290000,
      selectedSnapshot: {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  const order1 = await (prisma as any).order.create({
    data: {
      userId: user1.id,
      quoteId: quote1.id,
      status: 'PAID',
      paymentStatus: 'PAID',
      totalMinor: 1290000,
      currency: 'AMD',
      handoffSnapshot: { source: 'DEV_SEED' },
      recipientSnapshot: { recipientName: 'Ани Dev', phone: '+37499112233' }
    }
  });

  // Order Items
  const orderItem1 = await (prisma as any).orderItem.create({
    data: {
      orderId: order1.id,
      productId: productIds['dev-tea'],
      quantity: 1,
      unitPriceMinor: 90000,
      totalMinor: 90000
    }
  });

  // Packing Task for Order 1
  const packingTask = await (prisma as any).packingTask.create({
    data: {
      orderId: order1.id,
      status: 'OPEN'
    }
  });

  await (prisma as any).packingTaskItem.create({
    data: {
      packingTaskId: packingTask.id,
      orderItemId: orderItem1.id,
      quantity: 1,
      status: 'OPEN'
    }
  });

  // Order 2
  const quote2 = await (prisma as any).orderQuote.create({
    data: {
      userId: user2.id,
      planId: planIds['dev-comfort'],
      basePriceMinor: 1690000,
      totalMinor: 1690000,
      selectedSnapshot: {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  const order2 = await (prisma as any).order.create({
    data: {
      userId: user2.id,
      quoteId: quote2.id,
      status: 'READY_FOR_COURIER',
      paymentStatus: 'PAID',
      totalMinor: 1690000,
      currency: 'AMD',
      handoffSnapshot: { source: 'DEV_SEED' },
      recipientSnapshot: { recipientName: 'Мари Dev', phone: '+37499445566' }
    }
  });

  await (prisma as any).orderItem.create({
    data: {
      orderId: order2.id,
      productId: productIds['dev-chocolate'],
      quantity: 2,
      unitPriceMinor: 80000,
      totalMinor: 160000
    }
  });

  // Courier task for Order 2
  await (prisma as any).deliveryTask.create({
    data: {
      orderId: order2.id,
      status: 'CREATED',
      safePayload: {
        orderCode: order2.id.slice(0, 8),
        formattedAddress: 'Gyumri, Rustaveli St 10',
        recipientName: 'Мари Dev',
        phone: '+37499445566',
        handoff: { type: 'leave_at_door', exactPlace: 'Behind the gate' }
      }
    }
  });

  // Write audit log
  await (prisma as any).auditLog.create({
    data: {
      actorId: null,
      actorRole: 'SYSTEM',
      action: 'DEV_SEED_CREATED',
      entityType: 'Order',
      entityId: order1.id,
      metadata: { source: 'cli' }
    }
  });

  console.log('✅ Dev seed successfully completed.');
  console.log('Seeded products: 3, plans: 3, customers: 2, orders: 2, tasks: 2.');
}

main().finally(() => prisma.$disconnect());
