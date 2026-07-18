import net from 'node:net';
import tls from 'node:tls';

export interface RedisConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  database: number;
}

export function parseRedisConnection(rawUrl: string): RedisConnectionConfig {
  const url = new URL(rawUrl);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(`Unsupported Redis protocol: ${url.protocol}`);
  }

  const databaseText = url.pathname.replace(/^\//, '') || '0';
  const database = Number(databaseText);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error(`Invalid Redis database: ${databaseText}`);
  }

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    secure: url.protocol === 'rediss:',
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function encodeCommand(parts: (string | number)[]) {
  return `*${parts.length}\r\n${parts.map((part) => {
    const value = String(part);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parseSimpleResp(buffer: Buffer): string | null {
  const text = buffer.toString('utf8');
  if (text.startsWith('$-1')) return null;
  if (text.startsWith('+')) return text.slice(1).split('\r\n')[0] || '';
  if (text.startsWith(':')) return text.slice(1).split('\r\n')[0] || '0';
  if (text.startsWith('$')) {
    const parts = text.split('\r\n');
    return parts[1] ?? null;
  }
  if (text.startsWith('-')) throw new Error(text.slice(1).split('\r\n')[0]);
  return text;
}

export class RedisLite {
  private readonly connection: RedisConnectionConfig;
  private readonly disabled: boolean;

  constructor(url: string | null) {
    this.disabled = !url;
    this.connection = parseRedisConnection(url || 'redis://localhost:6379/0');
  }

  async command(parts: (string | number)[]) {
    if (this.disabled) return null;
    const { host, port, secure, username, password, database } = this.connection;
    const commands: (string | number)[][] = [];
    if (password) commands.push(username ? ['AUTH', username, password] : ['AUTH', password]);
    if (database) commands.push(['SELECT', database]);
    commands.push(parts);
    return new Promise<string | null>((resolve, reject) => {
      const socket = secure
        ? tls.connect({ host, port, servername: host, rejectUnauthorized: true })
        : net.createConnection({ host, port });
      const readyEvent = secure ? 'secureConnect' : 'connect';
      let data = Buffer.alloc(0);
      let sent = 0;
      const sendNext = () => {
        if (sent >= commands.length) return;
        socket.write(encodeCommand(commands[sent++]));
      };
      socket.setTimeout(1500);
      socket.on(readyEvent, sendNext);
      socket.on('data', (chunk) => {
        data = Buffer.concat([data, Buffer.from(chunk)]);
        if (sent < commands.length) {
          data = Buffer.alloc(0);
          sendNext();
          return;
        }
        try {
          const parsed = parseSimpleResp(data);
          socket.end();
          resolve(parsed);
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Redis timeout'));
      });
      socket.on('error', reject);
    });
  }

  async get(key: string) { return this.command(['GET', key]); }
  async setEx(key: string, seconds: number, value: string) { return this.command(['SET', key, value, 'EX', seconds]); }
  async del(key: string) { return this.command(['DEL', key]); }
  async incrWithExpire(key: string, seconds: number) {
    const value = Number(await this.command(['INCR', key]) || 0);
    if (value === 1) await this.command(['EXPIRE', key, seconds]);
    return value;
  }
}
