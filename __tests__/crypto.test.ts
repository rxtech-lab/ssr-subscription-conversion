import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

describe('crypto', () => {
  describe('encrypt and decrypt', () => {
    it('should return the original plaintext after encrypt then decrypt', () => {
      const secret = 'my-secret-key';
      const plaintext = 'Hello, World!';

      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long plaintext', () => {
      const secret = 'test-secret';
      const plaintext = 'A'.repeat(10000);

      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const secret = 'unicode-secret';
      const plaintext = '🇭🇰 Hong Kong 你好世界 émojis ñ';

      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    it('should work with different secrets', () => {
      const plaintext = 'Same message, different keys';

      const encrypted1 = encrypt(plaintext, 'secret-one');
      const encrypted2 = encrypt(plaintext, 'secret-two');

      // Different secrets produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // Each can be decrypted with its own secret
      expect(decrypt(encrypted1, 'secret-one')).toBe(plaintext);
      expect(decrypt(encrypted2, 'secret-two')).toBe(plaintext);
    });

    it('should handle empty string plaintext', () => {
      const secret = 'empty-test';
      const plaintext = '';

      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encrypted output format', () => {
    it('should produce output in "hex:hex:hex" format', () => {
      const encrypted = encrypt('test', 'secret');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);

      // Each part should be valid hex
      const hexRegex = /^[0-9a-f]+$/;
      expect(parts[0]).toMatch(hexRegex); // IV
      expect(parts[1]).toMatch(hexRegex); // Auth tag
      expect(parts[2]).toMatch(hexRegex); // Ciphertext
    });

    it('should have a 24-character IV hex (12 bytes)', () => {
      const encrypted = encrypt('test', 'secret');
      const iv = encrypted.split(':')[0];

      // 12 bytes = 24 hex characters
      expect(iv).toHaveLength(24);
    });

    it('should have a 32-character auth tag hex (16 bytes)', () => {
      const encrypted = encrypt('test', 'secret');
      const authTag = encrypted.split(':')[1];

      // 16 bytes = 32 hex characters
      expect(authTag).toHaveLength(32);
    });

    it('should produce different ciphertexts for the same input due to random IV', () => {
      const encrypted1 = encrypt('test', 'secret');
      const encrypted2 = encrypt('test', 'secret');

      // Random IVs mean different outputs each time
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decryption with wrong secret', () => {
    it('should throw when decrypting with wrong secret', () => {
      const encrypted = encrypt('sensitive data', 'correct-secret');

      expect(() => {
        decrypt(encrypted, 'wrong-secret');
      }).toThrow();
    });

    it('should throw when ciphertext is tampered with', () => {
      const encrypted = encrypt('data', 'secret');
      const parts = encrypted.split(':');
      // Flip a character in the ciphertext
      const tampered = parts[0] + ':' + parts[1] + ':' + 'ff' + parts[2].substring(2);

      expect(() => {
        decrypt(tampered, 'secret');
      }).toThrow();
    });

    it('should throw when auth tag is tampered with', () => {
      const encrypted = encrypt('data', 'secret');
      const parts = encrypted.split(':');
      // Replace the auth tag with garbage
      const tampered = parts[0] + ':' + '0'.repeat(32) + ':' + parts[2];

      expect(() => {
        decrypt(tampered, 'secret');
      }).toThrow();
    });
  });
});
