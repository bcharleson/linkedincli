import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptChromeCookieValue, deriveChromeCookieKey } from '../src/core/chrome-cookies.js';

function encryptV10(plaintext: Buffer, key: Buffer): Buffer {
  const iv = Buffer.alloc(16, 0x20);
  const cipher = createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([Buffer.from('v10'), cipher.update(plaintext), cipher.final()]);
}

describe('decryptChromeCookieValue', () => {
  const key = deriveChromeCookieKey('peanuts', 1);

  it('decrypts a v10 cookie without a host-hash prefix', () => {
    const encrypted = encryptV10(Buffer.from('ajax:unit-test-session'), key);
    expect(decryptChromeCookieValue(encrypted, key)).toBe('ajax:unit-test-session');
  });

  it('strips the Chrome M130 32-byte host-hash prefix', () => {
    const hostHash = randomBytes(32);
    const encrypted = encryptV10(Buffer.concat([hostHash, Buffer.from('unit-test-value')]), key);
    expect(decryptChromeCookieValue(encrypted, key)).toBe('unit-test-value');
  });

  it('returns legacy unencrypted bytes as utf8', () => {
    expect(decryptChromeCookieValue(Buffer.from('plain-cookie'), key)).toBe('plain-cookie');
  });

  it('returns empty string for empty input', () => {
    expect(decryptChromeCookieValue(Buffer.alloc(0), key)).toBe('');
  });
});
