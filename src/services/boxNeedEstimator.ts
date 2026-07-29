import type { FlowLevel } from '../domain/models';
import type { BoxPlanId } from '../data/boxCatalog';

export type BoxFlowChoice = 'light' | 'medium' | 'heavy';

const DAILY_STARTING_POINT: Record<BoxFlowChoice, number> = {
  light: 3,
  medium: 4,
  heavy: 6,
};

export interface BoxNeedEstimate {
  dailyItems: number;
  suggestedItems: number;
  safeMinimumItems: number;
  source: 'history' | 'starting_point';
  recommendedPlanId: BoxPlanId;
}

/**
 * A transparent, editable packing starting point. It is not medical advice:
 * the customer can always choose the exact number that feels right for her.
 */
export function estimateBoxNeed(input: {
  flow: BoxFlowChoice;
  periodLength: number;
  historicalCycleItems?: number[];
}): BoxNeedEstimate {
  const days = clamp(Math.round(input.periodLength), 3, 8);
  const history = (input.historicalCycleItems || [])
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));
  const canUseHistory = history.length >= 2;
  const dailyItems = DAILY_STARTING_POINT[input.flow];
  const startingPoint = clamp(days * dailyItems, 8, 48);
  const suggestedItems = canUseHistory
    ? clamp(Math.round(history.reduce((sum, value) => sum + value, 0) / history.length), 8, 48)
    : startingPoint;
  const safeMinimumItems = clamp(days * Math.max(2, dailyItems - 1), 8, suggestedItems);
  return {
    dailyItems,
    suggestedItems,
    safeMinimumItems,
    source: canUseHistory ? 'history' : 'starting_point',
    recommendedPlanId: suggestedItems <= 16 ? 'essential' : suggestedItems <= 24 ? 'comfort' : 'ritual',
  };
}

export function flowChoiceFromProfile(flowProfile: FlowLevel[] | undefined): BoxFlowChoice {
  if (flowProfile?.includes('heavy') || flowProfile?.includes('very_heavy')) return 'heavy';
  if (flowProfile?.includes('light') || flowProfile?.includes('spotting')) return 'light';
  return 'medium';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
