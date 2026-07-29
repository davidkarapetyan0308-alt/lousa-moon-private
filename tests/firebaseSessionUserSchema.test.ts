import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Firebase session user persistence', () => {
  it('does not write an avatar field that the User schema does not contain', () => {
    const server = read('apps/api/src/server.ts');
    const schema = read('apps/api/prisma/schema.prisma');
    const userModel = schema.match(/model User \{([\s\S]*?)\n\}/)?.[1] || '';

    expect(userModel).not.toMatch(/\bavatarUri\b/);
    expect(server).not.toMatch(/avatarUri,\n\s*language:/);
    expect(server).not.toMatch(/updates\.avatarUri/);
  });
});
