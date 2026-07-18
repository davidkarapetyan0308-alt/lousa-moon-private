import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  if (isProduction) {
    console.error('❌ Dev clear is disabled in production.');
    process.exit(1);
  }

  console.log('🧹 Clearing development dev-seed data from database...');

  // Find all dev orders
  // Since handoffSnapshot is JSON, we can query orders where handoffSnapshot has source === 'DEV_SEED'
  const devOrders = await (prisma as any).order.findMany({
    where: {
      handoffSnapshot: {
        path: ['source'],
        equals: 'DEV_SEED'
      }
    }
  });

  const orderIds = devOrders.map((o: any) => o.id);
  const quoteIds = devOrders.map((o: any) => o.quoteId);

  if (orderIds.length > 0) {
    console.log(`Found ${orderIds.length} dev orders to clear.`);
    
    // Delete in reverse dependency order to prevent FK violations
    await (prisma as any).courierAssignment.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).packingTaskItem.deleteMany({ where: { packingTask: { orderId: { in: orderIds } } } });
    await (prisma as any).packingTask.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).deliveryTask.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).supportNote.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).paymentEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).paymentIntent.deleteMany({ where: { orderId: { in: orderIds } } });
    await (prisma as any).order.deleteMany({ where: { id: { in: orderIds } } });
  }

  if (quoteIds.length > 0) {
    await (prisma as any).orderQuoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await (prisma as any).orderQuote.deleteMany({ where: { id: { in: quoteIds } } });
  }

  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: 'dev-user-',
        endsWith: '@lousa.app'
      }
    }
  });

  // Delete dev products
  // First delete inventory items and prices
  const devProducts = await (prisma as any).productCatalogItem.findMany({
    where: {
      sku: {
        startsWith: 'dev-'
      }
    }
  });
  const productIds = devProducts.map((p: any) => p.id);
  if (productIds.length > 0) {
    await (prisma as any).inventoryItem.deleteMany({ where: { productId: { in: productIds } } });
    await (prisma as any).productPrice.deleteMany({ where: { productId: { in: productIds } } });
    await (prisma as any).boxPlanIncludedItem.deleteMany({ where: { productId: { in: productIds } } });
    await (prisma as any).productCatalogItem.deleteMany({ where: { id: { in: productIds } } });
  }

  // Delete dev plans
  await (prisma as any).boxPlan.deleteMany({
    where: {
      code: {
        startsWith: 'dev-'
      }
    }
  });

  // Delete dev audit log entries
  await (prisma as any).auditLog.deleteMany({
    where: {
      action: 'DEV_SEED_CREATED'
    }
  });

  console.log('✅ Dev seed data cleared successfully.');
}

main().finally(() => prisma.$disconnect());
