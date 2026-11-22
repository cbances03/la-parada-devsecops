import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/password.mjs';

describe('password hashing (real scrypt, no database)', () => {
  it('uses random salts and verifies only the matching password', async () => {
    const password = 'Only-for-unit-tests-2026';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('Incorrect-unit-test-password', first)).toBe(false);
  });

  it('rejects malformed hashes and unbounded inputs', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
    await expect(hashPassword('a'.repeat(129))).rejects.toThrow();
    expect(await verifyPassword('test', 'plaintext')).toBe(false);
    expect(await verifyPassword('test', 'scrypt$999999999$8$3$abc$def')).toBe(false);
  });
});
