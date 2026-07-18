import { CycleValidationError, validateAndNormalizePeriodRecord, validateCycleObservationDate } from '../src/domain/cycleValidation';

describe('cycle truth validation', () => {
  test('rejects future period dates', () => {
    expect(() => validateAndNormalizePeriodRecord({
      id: 'future',
      startDate: '2999-01-01',
      endDate: null,
      confirmed: true,
      source: 'user',
      needsReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, [])).toThrow(CycleValidationError);
  });

  test('rejects overlapping confirmed periods', () => {
    const existing = [{
      id: 'one', startDate: '2026-06-01', endDate: '2026-06-05', confirmed: true,
      source: 'user' as const, needsReview: false, flowByDay: {}, createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
    }];
    expect(() => validateAndNormalizePeriodRecord({
      ...existing[0], id: 'two', startDate: '2026-06-04', endDate: '2026-06-08',
    }, existing)).toThrow(CycleValidationError);
  });

  test('normalizes valid records without fabricating dates', () => {
    const record = validateAndNormalizePeriodRecord({
      id: 'valid', startDate: '2026-06-10', endDate: '2026-06-14', confirmed: true,
      source: 'user', needsReview: false, flowByDay: {}, createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z',
    }, []);
    expect(record.startDate).toBe('2026-06-10');
    expect(record.endDate).toBe('2026-06-14');
  });

  test('rejects future cycle observations', () => {
    expect(() => validateCycleObservationDate('2999-01-01')).toThrow(CycleValidationError);
  });
});
