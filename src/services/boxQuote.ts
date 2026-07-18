import { BoxPlan } from '../data/boxCatalog';

export const BOX_ADD_ON_PRICES_AMD = {
  heatPad: 1900,
  reusable: 3200,
  tea: 900,
  chocolate: 800,
} as const;

export interface BoxQuoteInput {
  plan: BoxPlan;
  selectedUnits: number;
  deliveryFeeAmd?: number;
  addOns: {
    heatPad: boolean;
    reusable: boolean;
    tea: boolean;
    chocolate: boolean;
  };
}

export interface BoxQuote {
  basePriceAmd: number;
  includedUnits: number;
  selectedUnits: number;
  extraUnits: number;
  sanitaryAddOnAmd: number;
  accessoryAddOnAmd: number;
  addOnTotalAmd: number;
  deliveryFeeAmd: number;
  totalAmd: number;
}

/**
 * Deterministic client preview. Production checkout must recalculate the same
 * quote on the backend before creating a payment intent.
 */
export function calculateBoxQuote(input: BoxQuoteInput): BoxQuote {
  const selectedUnits = Math.max(0, Math.floor(input.selectedUnits));
  const extraUnits = Math.max(0, selectedUnits - input.plan.includedUnits);
  const sanitaryAddOnAmd = extraUnits * input.plan.extraUnitPriceAmd;
  const accessoryAddOnAmd =
    (input.addOns.heatPad && !input.plan.includedAddOns.heatPad ? BOX_ADD_ON_PRICES_AMD.heatPad : 0) +
    (input.addOns.tea && !input.plan.includedAddOns.tea ? BOX_ADD_ON_PRICES_AMD.tea : 0) +
    (input.addOns.chocolate && !input.plan.includedAddOns.chocolate ? BOX_ADD_ON_PRICES_AMD.chocolate : 0) +
    (input.addOns.reusable && input.plan.id !== 'ritual' ? BOX_ADD_ON_PRICES_AMD.reusable : 0);
  const addOnTotalAmd = sanitaryAddOnAmd + accessoryAddOnAmd;
  // Delivery is included in every LOUSA plan. Keep the input for backwards
  // compatibility, but never let stale client/server data add a delivery charge.
  const deliveryFeeAmd = 0;
  return {
    basePriceAmd: input.plan.monthlyPriceAmd,
    includedUnits: input.plan.includedUnits,
    selectedUnits,
    extraUnits,
    sanitaryAddOnAmd,
    accessoryAddOnAmd,
    addOnTotalAmd,
    deliveryFeeAmd,
    totalAmd: input.plan.monthlyPriceAmd + addOnTotalAmd + deliveryFeeAmd,
  };
}
