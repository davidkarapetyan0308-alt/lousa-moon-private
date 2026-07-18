import type { CycleDayObservation, PeriodRecord } from '../src/domain/models';
import { buildCycleSyncDiff } from '../src/services/cycleSyncDiff';

const period = (id: string, startDate = '2026-07-01'): PeriodRecord => ({
  id,
  startDate,
  endDate: null,
  confirmed: true,
  source: 'user',
  flowByDay: { [startDate]: 'medium' },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
});

const observation = (id: string, type: CycleDayObservation['type'] = 'period_start'): CycleDayObservation => ({
  id,
  date: '2026-07-01',
  type,
  source: 'user',
  periodRecordId: type === 'period_start' ? 'period-1' : null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
});

describe('buildCycleSyncDiff', () => {
  test('undoing a newly created entry deletes both server entities', () => {
    const operations = buildCycleSyncDiff(
      { periodRecords: [period('period-1')], cycleObservations: [observation('obs-1')] },
      { periodRecords: [], cycleObservations: [] },
      '2026-07-02T00:00:00.000Z',
    );
    expect(operations.map((item) => item.kind).sort()).toEqual(['delete_observation', 'delete_period']);
  });

  test('undoing a deletion restores the prior entities with upserts', () => {
    const operations = buildCycleSyncDiff(
      { periodRecords: [], cycleObservations: [] },
      { periodRecords: [period('period-1')], cycleObservations: [observation('obs-1')] },
      '2026-07-02T00:00:00.000Z',
    );
    expect(operations.map((item) => item.kind).sort()).toEqual(['upsert_observation', 'upsert_period']);
  });

  test('replacing an observation type deletes the old id and upserts the restored id', () => {
    const operations = buildCycleSyncDiff(
      { periodRecords: [], cycleObservations: [observation('obs-new', 'no_bleeding')] },
      { periodRecords: [period('period-1')], cycleObservations: [observation('obs-old', 'period_start')] },
      '2026-07-02T00:00:00.000Z',
    );
    expect(operations.map((item) => item.kind).sort()).toEqual([
      'delete_observation',
      'upsert_observation',
      'upsert_period',
    ]);
  });
});
