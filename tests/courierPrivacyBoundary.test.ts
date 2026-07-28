import { COURIER_DTO_FIELDS, courierTaskDto } from '../apps/api/src/courier/dto';

describe('courier privacy boundary', () => {
  test('exposes only delivery fields', () => {
    const dto = courierTaskDto({
      id: 'task-1',
      status: 'READY',
      safePayload: {
        recipientName: 'Ani',
        phone: '+37400000000',
        formattedAddress: 'Gyumri',
        instructions: 'Call on arrival',
        cycleRecords: [{ date: '2026-07-01' }],
        symptoms: ['pain'],
      },
      order: {
        id: 'order-secret',
        quote: { selectedSnapshot: { preferences: { menstrualProducts: ['pads'] } } },
      },
    }, () => 'LM-ORDER');
    expect(Object.keys(dto).sort()).toEqual([...COURIER_DTO_FIELDS].sort());
    expect(JSON.stringify(dto)).not.toContain('cycleRecords');
    expect(JSON.stringify(dto)).not.toContain('symptoms');
    expect(JSON.stringify(dto)).not.toContain('menstrualProducts');
  });

  test('redacts health and card-like content from free-text delivery instructions', () => {
    const dto = courierTaskDto({
      id: 'task-1',
      status: 'READY',
      safePayload: {
        instructions: 'У меня месячные, оставьте у двери. Карта 4111 1111 1111 1111',
      },
    }, () => 'LM-ORDER');
    expect(dto.instructions).not.toContain('месячные');
    expect(dto.instructions).not.toContain('4111');
    expect(dto.instructions).toContain('оставьте у двери');
  });
});
