import { estimateBoxNeed, flowChoiceFromProfile } from '../src/services/boxNeedEstimator';

describe('box need estimator', () => {
  test('uses a gentle editable starting point when history is unavailable', () => {
    expect(estimateBoxNeed({ flow: 'light', periodLength: 5 })).toMatchObject({
      dailyItems: 3,
      suggestedItems: 15,
      safeMinimumItems: 10,
      source: 'starting_point',
      recommendedPlanId: 'essential',
    });
    expect(estimateBoxNeed({ flow: 'heavy', periodLength: 5 })).toMatchObject({
      dailyItems: 6,
      suggestedItems: 30,
      recommendedPlanId: 'ritual',
    });
  });

  test('uses completed product history only after two recorded cycles', () => {
    const oneRecord = estimateBoxNeed({ flow: 'medium', periodLength: 5, historicalCycleItems: [28] });
    const twoRecords = estimateBoxNeed({ flow: 'medium', periodLength: 5, historicalCycleItems: [18, 22] });
    expect(oneRecord.source).toBe('starting_point');
    expect(twoRecords).toMatchObject({ source: 'history', suggestedItems: 20, recommendedPlanId: 'comfort' });
  });

  test('maps existing profile values to a safe simple choice', () => {
    expect(flowChoiceFromProfile(['spotting'])).toBe('light');
    expect(flowChoiceFromProfile(['very_heavy'])).toBe('heavy');
    expect(flowChoiceFromProfile(['medium'])).toBe('medium');
  });
});
