import { parseRedisConnection } from '../apps/api/src/db/redis';

describe('Redis connection configuration', () => {
  test('uses TLS and ACL credentials for a rediss URL', () => {
    expect(parseRedisConnection('rediss://default:secret%20value@redis.example.com:6380/0')).toEqual({
      host: 'redis.example.com',
      port: 6380,
      secure: true,
      username: 'default',
      password: 'secret value',
      database: 0,
    });
  });

  test('keeps local redis connections unencrypted', () => {
    expect(parseRedisConnection('redis://localhost:6379/2')).toEqual({
      host: 'localhost',
      port: 6379,
      secure: false,
      username: '',
      password: '',
      database: 2,
    });
  });

  test('rejects unsupported protocols and invalid databases', () => {
    expect(() => parseRedisConnection('http://localhost:6379')).toThrow('Unsupported Redis protocol');
    expect(() => parseRedisConnection('redis://localhost:6379/not-a-number')).toThrow('Invalid Redis database');
  });
});
