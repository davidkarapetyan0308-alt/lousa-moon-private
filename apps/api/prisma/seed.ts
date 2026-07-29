import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/security/hash';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'demo@lousa.app' },
    update: {},
    create: {
      email: 'demo@lousa.app',
      emailVerifiedAt: new Date(),
      passwordHash: await hashSecret('Lousa2026'),
      name: 'Ани',
      language: 'ru',
      status: 'active',
    },
  });

  const zone = await (prisma as any).deliveryZone.upsert({
    where: { id: 'gyumri-main-zone' },
    update: { isActive: true, radiusKm: 15, baseFeeMinor: 0 },
    create: { id: 'gyumri-main-zone', name: 'Gyumri Standard', type: 'radius', centerLat: 40.7894, centerLng: 43.8475, radiusKm: 15, baseFeeMinor: 0, currency: 'AMD', isActive: true },
  });

  const productMetadata: Record<string, Record<string, unknown>> = {
    'pad-day': { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
    'pad-night': { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
    'tampon-regular': { allergens: [], materials: ['cotton'], fragranceFree: true },
    'tampon-non-applicator': { allergens: [], materials: ['cotton'], fragranceFree: true },
    'menstrual-cup': { allergens: [], materials: ['medical_grade_silicone'], fragranceFree: true },
    'menstrual-disc': { allergens: [], materials: ['medical_grade_silicone'], fragranceFree: true },
    liner: { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
    wipes: { allergens: [], materials: ['nonwoven'], fragranceFree: true },
    tea: { allergens: ['herbs'], ingredients: ['herbal_blend'] },
    chocolate: { allergens: ['milk', 'nuts'], ingredients: ['cocoa', 'milk'], requiresLabelReview: true },
    'heat-pad': { allergens: [], materials: ['iron_powder', 'activated_carbon'] },
  };

  const products = [
    ['pad-day', 'Дневные прокладки', 'Day pads', 'Ցերեկային միջադիրներ', 'menstrual', 25000, 500],
    ['pad-night', 'Ночные прокладки', 'Night pads', 'Գիշերային միջադիրներ', 'menstrual', 32000, 300],
    ['tampon-regular', 'Тампоны с аппликатором', 'Applicator tampons', 'Ապլիկատորով տամպոններ', 'menstrual', 36000, 300],
    ['tampon-non-applicator', 'Тампоны без аппликатора', 'Non-applicator tampons', 'Տամպոններ առանց ապլիկատորի', 'menstrual', 33000, 300],
    ['menstrual-cup', 'Менструальная чаша', 'Menstrual cup', 'Դաշտանային բաժակ', 'menstrual', 520000, 60],
    ['menstrual-disc', 'Менструальный диск', 'Menstrual disc', 'Դաշտանային սկավառակ', 'menstrual', 580000, 60],
    ['liner', 'Ежедневные прокладки', 'Liners', 'Ամենօրյա միջադիրներ', 'menstrual', 18000, 500],
    ['wipes', 'Деликатные салфетки', 'Gentle wipes', 'Նուրբ անձեռոցիկներ', 'care', 70000, 120],
    ['tea', 'Травяной чай', 'Herbal tea', 'Բուսական թեյ', 'wellness', 90000, 100],
    ['chocolate', 'Шоколад', 'Chocolate', 'Շոկոլադ', 'food', 80000, 100],
    ['heat-pad', 'Грелка', 'Heat pad', 'Տաքացնող փաթեթ', 'wellness', 190000, 80],
  ] as const;

  const productIds: Record<string, string> = {};
  for (const [sku, nameRu, nameEn, nameHy, category, amountMinor, stock] of products) {
    const product = await (prisma as any).productCatalogItem.upsert({
      where: { sku },
      update: { nameRu, nameEn, nameHy, category, isActive: true, metadata: productMetadata[sku] || {} },
      create: { sku, nameRu, nameEn, nameHy, category, isActive: true, metadata: productMetadata[sku] || {} },
    });
    productIds[sku] = product.id;
    const existingPrice = await (prisma as any).productPrice.findFirst({ where: { productId: product.id, currency: 'AMD', validUntil: null } });
    if (!existingPrice) await (prisma as any).productPrice.create({ data: { productId: product.id, amountMinor, currency: 'AMD', priceVersion: 1 } });
    await (prisma as any).inventoryItem.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: 'gyumri-main' } },
      update: { availableQuantity: stock },
      create: { productId: product.id, warehouseId: 'gyumri-main', availableQuantity: stock, reservedQuantity: 0 },
    });
  }

  const plans = [
    ['essential', 'Essential', 890000, 16, [['pad-day', 12], ['pad-night', 4], ['wipes', 1]]],
    ['comfort', 'Comfort', 1490000, 24, [['pad-day', 16], ['pad-night', 6], ['liner', 10], ['wipes', 1], ['tea', 1]]],
    ['ritual', 'Moon Ritual', 2290000, 32, [['pad-day', 18], ['pad-night', 8], ['liner', 14], ['wipes', 1], ['tea', 1], ['chocolate', 1], ['heat-pad', 1]]],
  ] as const;

  for (const [code, name, basePriceMinor, includedUnits, includes] of plans) {
    const plan = await (prisma as any).boxPlan.upsert({
      where: { code },
      update: { name, basePriceMinor, includedUnits, currency: 'AMD', isActive: true },
      create: { code, name, basePriceMinor, includedUnits, currency: 'AMD', isActive: true },
    });
    for (const [sku, includedQuantity] of includes) {
      await (prisma as any).boxPlanIncludedItem.upsert({
        where: { planId_productId: { planId: plan.id, productId: productIds[sku] } },
        update: { includedQuantity },
        create: { planId: plan.id, productId: productIds[sku], includedQuantity },
      });
    }
  }

  console.log('Seed complete', { zone: zone.id, products: Object.keys(productIds).length });
}

main().finally(() => prisma.$disconnect());
