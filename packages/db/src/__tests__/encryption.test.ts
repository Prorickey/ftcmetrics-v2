import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, encryptTokenFields, decryptTokenFields } from '../encryption';

// Set encryption key before tests
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('encrypt / decrypt', () => {
  it('roundtrips plaintext correctly', () => {
    const plaintext = 'my-secret-token-value';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts per call (random IV)', () => {
    const plaintext = 'same-value';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // Both still decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('fails on tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext portion
    parts[2] = 'ff' + parts[2].slice(2);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on malformed format', () => {
    expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted token format');
  });
});

describe('encryptTokenFields', () => {
  it('encrypts only token fields', () => {
    const data = {
      access_token: 'at-123',
      refresh_token: 'rt-456',
      id_token: 'id-789',
      other_field: 'should-not-change',
    };
    const result = encryptTokenFields(data);

    // Token fields should be encrypted (colon-separated hex)
    expect(result.access_token).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(result.refresh_token).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(result.id_token).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    // Other fields untouched
    expect(result.other_field).toBe('should-not-change');
  });

  it('does not double-encrypt already encrypted values', () => {
    const data = { access_token: 'at-123', refresh_token: '', id_token: undefined as unknown as string };
    const once = encryptTokenFields(data);
    const twice = encryptTokenFields(once);
    // access_token should be same after second pass (already encrypted)
    expect(twice.access_token).toBe(once.access_token);
  });
});

describe('decryptTokenFields', () => {
  it('reverses encryptTokenFields', () => {
    const original = {
      access_token: 'at-secret',
      refresh_token: 'rt-secret',
      id_token: 'id-secret',
      provider: 'google',
    };
    const encrypted = encryptTokenFields(original);
    const decrypted = decryptTokenFields(encrypted);

    expect(decrypted.access_token).toBe('at-secret');
    expect(decrypted.refresh_token).toBe('rt-secret');
    expect(decrypted.id_token).toBe('id-secret');
    expect(decrypted.provider).toBe('google');
  });
});
