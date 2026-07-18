import { getCalendarMonth, getCycleData } from '../src/utils/cycleEngine';
import { fromLocalDateString } from '../src/utils/date';
import { periodsFromIntervals } from './helpers';

describe('cycle engine trust boundary', () => {
  const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);

  test('does not wrap a missed cycle back to a believable low day number', () => {
    const result = getCycleData(
      fromLocalDateString('2026-03-26'),
      28,
      5,
      new Date(2026, 6, 5, 12),
      records.length,
      records,
    );

    expect(result.currentDay).toBe(102);
    expect(result.isCyclePositionKnown).toBe(false);
    expect(result.prediction.expectedWindowPassed).toBe(true);
  });

  test('does not repeat fertile or ovulation marks every cycle without confirmed starts', () => {
    const july = getCalendarMonth(
      2026,
      6,
      fromLocalDateString('2026-03-26'),
      28,
      5,
      records,
    );

    expect(july.some((day) => day.isFertile || day.isOvulation)).toBe(false);
    expect(july.find((day) => day.date === '2026-07-05')?.cycleDay).toBe(102);
  });

  test('does not label every future calendar day as a prediction', () => {
    const april = getCalendarMonth(
      2026,
      3,
      fromLocalDateString('2026-03-26'),
      28,
      5,
      records,
    );

    const plainFutureDay = april.find((day) => day.date === '2026-04-10');
    expect(plainFutureDay?.isPredicted).toBe(false);
  });

});
