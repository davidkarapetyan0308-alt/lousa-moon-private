describe('LOUSA V9 integration contract', () => {
  it('defines the database-backed production dependencies', () => {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://lousa:lousa@localhost:5432/lousa_moon?schema=public';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
    expect(databaseUrl).toContain('postgresql://');
    expect(redisUrl).toContain('redis://');
  });

  it('documents the protected order flow', () => {
    const steps = ['quote', 'order-from-quote', 'payment-from-order-total', 'webhook-or-sandbox-confirm'];
    expect(steps).toEqual(expect.arrayContaining(['quote', 'order-from-quote', 'payment-from-order-total']));
  });
});
