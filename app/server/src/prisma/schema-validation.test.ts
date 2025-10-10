import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

process.env.DATABASE_URL ??= 'file:./prisma/data.db';

describe('Prisma schema', () => {
  it('passes `prisma validate`', () => {
    let output: Buffer | string = Buffer.from('');
    expect(() => {
      output = execSync('npx prisma validate', {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    }).not.toThrow();

    const textOutput = output.toString();
    expect(textOutput).toContain('Prisma schema loaded');
    expect(textOutput).toContain('is valid');
  });
});
