import { BOX_PLANS } from '../src/data/boxCatalog';
import { calculateBoxQuote } from '../src/services/boxQuote';

describe('box quote', () => {
  test('included quantity does not increase the price', () => {
    const plan = BOX_PLANS.find((item) => item.id === 'essential')!;
    const quote = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits,
      addOns: { heatPad: false, reusable: false, tea: true, chocolate: true },
    });
    expect(quote.extraUnits).toBe(0);
    expect(quote.addOnTotalAmd).toBe(0);
    expect(quote.totalAmd).toBe(plan.monthlyPriceAmd);
  });

  test('units above plan allowance are priced immediately', () => {
    const plan = BOX_PLANS.find((item) => item.id === 'essential')!;
    const quote = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits + 8,
      addOns: { heatPad: false, reusable: false, tea: true, chocolate: true },
    });
    expect(quote.extraUnits).toBe(8);
    expect(quote.sanitaryAddOnAmd).toBe(8 * plan.extraUnitPriceAmd);
    expect(quote.totalAmd).toBe(plan.monthlyPriceAmd + 8 * plan.extraUnitPriceAmd);
  });

  test('only add-ons outside the plan are charged', () => {
    const plan = BOX_PLANS.find((item) => item.id === 'essential')!;
    const quote = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits,
      deliveryFeeAmd: 500,
      addOns: { heatPad: true, reusable: true, tea: true, chocolate: true },
    });
    expect(quote.accessoryAddOnAmd).toBe(1900 + 3200);
    expect(quote.deliveryFeeAmd).toBe(0);
    expect(quote.totalAmd).toBe(plan.monthlyPriceAmd + 1900 + 3200);
  });
});

describe('trust-first box pricing rules', () => {
  test('recommendation above allowance stays free until user explicitly raises quantity', () => {
    const plan = BOX_PLANS.find((item) => item.id === 'essential')!;
    const recommendedUnits = plan.includedUnits + 4;
    const beforeConsent = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits,
      addOns: { heatPad: false, reusable: false, tea: false, chocolate: false },
    });
    const afterConsent = calculateBoxQuote({
      plan,
      selectedUnits: recommendedUnits,
      addOns: { heatPad: false, reusable: false, tea: false, chocolate: false },
    });
    expect(beforeConsent.extraUnits).toBe(0);
    expect(beforeConsent.totalAmd).toBe(plan.monthlyPriceAmd);
    expect(afterConsent.extraUnits).toBe(4);
    expect(afterConsent.totalAmd).toBe(plan.monthlyPriceAmd + 4 * plan.extraUnitPriceAmd);
  });

  test('paid care extras are opt-in and do not affect price by default', () => {
    const plan = BOX_PLANS.find((item) => item.id === 'essential')!;
    const defaultQuote = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits,
      addOns: { heatPad: false, reusable: false, tea: false, chocolate: false },
    });
    const withExtras = calculateBoxQuote({
      plan,
      selectedUnits: plan.includedUnits,
      addOns: { heatPad: true, reusable: true, tea: true, chocolate: true },
    });
    expect(defaultQuote.addOnTotalAmd).toBe(0);
    expect(withExtras.addOnTotalAmd).toBeGreaterThan(0);
  });
});
