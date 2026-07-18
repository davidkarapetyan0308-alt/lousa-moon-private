import { confirmLegacyRecord, migrateCycleStateToV6 } from '../src/services/migrations';
import { PeriodRecord } from '../src/domain/models';

const TODAY = new Date(2026, 6, 5, 12);

function record(startDate: string, patch: Partial<PeriodRecord> = {}): PeriodRecord {
  return {
    id: `p-${startDate}`,
    startDate,
    endDate: null,
    confirmed: true,
    source: 'user',
    flowByDay: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

describe('migrateCycleStateToV6', () => {
  test('imports legacy dates as unconfirmed review records', () => {
    const result = migrateCycleStateToV6({ periodHistory: ['2026-04-01', '2026-05-01'] }, TODAY);
    expect(result.periodRecords).toHaveLength(2);
    expect(result.periodRecords.every((item) => item.source === 'legacy')).toBe(true);
    expect(result.periodRecords.every((item) => !item.confirmed && item.needsReview)).toBe(true);
    expect(result.needsReview).toBe(true);
  });

  test('deduplicates records with the same start date', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-04-01'), record('2026-04-01', { id: 'second', flowByDay: { '2026-04-01': 'heavy' } })] }, TODAY);
    expect(result.periodRecords).toHaveLength(1);
    expect(result.issues).toContain('duplicate_record_merged');
    expect(result.periodRecords[0].flowByDay['2026-04-01']).toBe('heavy');
  });

  test.each([
    ['not-a-date'],
    ['2026-13-01'],
    ['2026-02-30'],
    ['2026/01/01'],
    [''],
  ])('removes invalid date %s', (startDate) => {
    const result = migrateCycleStateToV6({ periodRecords: [{ ...record('2026-01-01'), startDate }] }, TODAY);
    expect(result.periodRecords).toHaveLength(0);
    expect(result.issues).toContain('invalid_record_removed');
  });

  test.each(['2026-07-06', '2027-01-01', '2099-12-31'])('removes future date %s', (startDate) => {
    const result = migrateCycleStateToV6({ periodRecords: [record(startDate)] }, TODAY);
    expect(result.periodRecords).toHaveLength(0);
  });

  test('sorts dates ascending', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-05-01'), record('2026-03-01'), record('2026-04-01')] }, TODAY);
    expect(result.periodRecords.map((item) => item.startDate)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
  });

  test('keeps confirmed user records confirmed', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-05-01')] }, TODAY);
    expect(result.periodRecords[0].confirmed).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  test('forces legacy records into review', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-05-01', { source: 'legacy', confirmed: true, needsReview: false })] }, TODAY);
    expect(result.periodRecords[0].confirmed).toBe(false);
    expect(result.periodRecords[0].needsReview).toBe(true);
  });

  test('drops invalid end date before start date', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-05-10', { endDate: '2026-05-09' })] }, TODAY);
    expect(result.periodRecords[0].endDate).toBeNull();
  });

  test('keeps valid per-day details', () => {
    const result = migrateCycleStateToV6({ periodRecords: [record('2026-05-01', {
      flowByDay: { '2026-05-01': 'heavy' },
      painByDay: { '2026-05-01': 7 },
      productsUsedByDay: { '2026-05-01': 6 },
      nightLeakageByDay: { '2026-05-01': true },
      notesByDay: { '2026-05-01': 'note' },
    })] }, TODAY);
    expect(result.periodRecords[0].painByDay?.['2026-05-01']).toBe(7);
    expect(result.periodRecords[0].productsUsedByDay?.['2026-05-01']).toBe(6);
    expect(result.periodRecords[0].nightLeakageByDay?.['2026-05-01']).toBe(true);
  });

  test('is idempotent for already migrated records', () => {
    const first = migrateCycleStateToV6({ periodRecords: [record('2026-05-01')] }, TODAY);
    const second = migrateCycleStateToV6({ periodRecords: first.periodRecords }, TODAY);
    expect(second.periodRecords).toEqual(first.periodRecords);
  });

  test('confirmLegacyRecord removes review marker', () => {
    const legacy = record('2026-05-01', { source: 'legacy', confirmed: false, needsReview: true, migrationNote: 'review' });
    const confirmed = confirmLegacyRecord(legacy);
    expect(confirmed.confirmed).toBe(true);
    expect(confirmed.needsReview).toBe(false);
    expect(confirmed.migrationNote).toBeUndefined();
  });
});
