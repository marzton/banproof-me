import { describe, it, expect, beforeAll } from 'vitest';
import { validateZeroEdgeJWT, extractClaims, enforceRBAC } from '../middleware/zeroEdgeSSO.js';

let publicKeyPem: string;
let privateKey: CryptoKey;

async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  privateKey = keyPair.privateKey;

  const exportedPublic = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const base64Public = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));
  publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${base64Public.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createMockJWT(payload: any, key: CryptoKey): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${headerEncoded}.${payloadEncoded}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);
  const signatureEncoded = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}

describe('zeroEdgeSSO', () => {
  beforeAll(async () => {
    await generateKeyPair();
  });

  describe('validateZeroEdgeJWT happy path', () => {
    it('validates a correct token and returns identity', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        aud: 'my-audience',
        exp,
        custom: {
          role: 'pro',
          tier_level: 'pro'
        }
      };

      const token = await createMockJWT(payload, privateKey);
      const identity = await validateZeroEdgeJWT(token, 'my-audience', publicKeyPem);

      expect(identity).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'pro',
        tierLevel: 'pro',
        expiresAt: exp
      });
    });

    it('prioritizes custom claims over top-level sub', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = {
        sub: 'wrong-id',
        aud: 'my-audience',
        exp,
        custom: {
          user_id: 'correct-id',
          role: 'agency',
          tier_level: 'agency'
        }
      };

      const token = await createMockJWT(payload, privateKey);
      const identity = await validateZeroEdgeJWT(token, 'my-audience', publicKeyPem);

      expect(identity.userId).toBe('correct-id');
      expect(identity.role).toBe('agency');
      expect(identity.tierLevel).toBe('agency');
    });

    it('falls back to com.banproof claims if custom is missing', async () => {
       const exp = Math.floor(Date.now() / 1000) + 3600;
       const payload = {
         sub: 'user-456',
         aud: 'my-audience',
         exp,
         'com.banproof': {
           role: 'admin',
           tier_level: 'agency'
         }
       };

       const token = await createMockJWT(payload, privateKey);
       const identity = await validateZeroEdgeJWT(token, 'my-audience', publicKeyPem);

       expect(identity.role).toBe('admin');
       expect(identity.tierLevel).toBe('agency');
    });

    it('defaults role to public and tierLevel to free', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = {
        sub: 'user-789',
        aud: 'my-audience',
        exp
      };

      const token = await createMockJWT(payload, privateKey);
      const identity = await validateZeroEdgeJWT(token, 'my-audience', publicKeyPem);

      expect(identity.role).toBe('public');
      expect(identity.tierLevel).toBe('free');
    });
  });

  describe('validateZeroEdgeJWT error handling', () => {
    it('throws on malformed token', async () => {
      await expect(validateZeroEdgeJWT('part1.part2', 'aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: malformed token (expected 3 parts)');
    });

    it('throws on invalid payload encoding', async () => {
      const token = `header.not-base64!.signature`;
      await expect(validateZeroEdgeJWT(token, 'aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: cannot decode payload');
    });

    it('throws on expired token', async () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const payload = { aud: 'aud', exp };
      const token = await createMockJWT(payload, privateKey);
      await expect(validateZeroEdgeJWT(token, 'aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: token has expired');
    });

    it('throws on missing audience configuration', async () => {
      const payload = { aud: 'aud', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = await createMockJWT(payload, privateKey);
      await expect(validateZeroEdgeJWT(token, '', publicKeyPem))
        .rejects.toThrow('Invalid JWT: missing audience configuration');
    });

    it('throws on audience mismatch', async () => {
      const payload = { aud: 'wrong-aud', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = await createMockJWT(payload, privateKey);
      await expect(validateZeroEdgeJWT(token, 'correct-aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: audience mismatch');
    });

    it('throws on signature verification failure', async () => {
      const payload = { aud: 'aud', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = await createMockJWT(payload, privateKey);
      const tamperedToken = token.substring(0, token.length - 5) + 'AAAAA';
      await expect(validateZeroEdgeJWT(tamperedToken, 'aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: signature verification failed');
    });

    it('throws when signed with a different key', async () => {
      const otherKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign']
      );
      const payload = { aud: 'aud', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = await createMockJWT(payload, otherKeyPair.privateKey);
      await expect(validateZeroEdgeJWT(token, 'aud', publicKeyPem))
        .rejects.toThrow('Invalid JWT: signature verification failed');
    });

    it('throws on invalid public key PEM', async () => {
      const payload = { aud: 'aud', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = await createMockJWT(payload, privateKey);
      await expect(validateZeroEdgeJWT(token, 'aud', 'not-a-pem'))
        .rejects.toThrow('Invalid JWT: cannot parse public key');
    });
  });

  describe('extractClaims', () => {
    it('correctly maps identity to context', () => {
      const identity = {
        userId: 'u1',
        email: 'e1',
        role: 'admin' as const,
        tierLevel: 'pro' as const,
        expiresAt: 12345
      };
      const context = extractClaims(identity);
      expect(context.identity).toEqual(identity);
      expect(context.method).toBe('zero-edge-sso');
      expect(context.ipAddress).toBe('');
      expect(typeof context.timestamp).toBe('number');
    });
  });

  describe('enforceRBAC', () => {
    const makeContext = (role: any, tier: any) => ({
      identity: { role, tierLevel: tier },
      method: 'zero-edge-sso' as const,
      ipAddress: '',
      timestamp: Date.now()
    });

    it('allows higher role to access lower required role', () => {
      const ctx = makeContext('admin', 'free');
      expect(enforceRBAC(ctx, 'pro')).toBe(true);
    });

    it('allows higher tier to access lower required role', () => {
      const ctx = makeContext('public', 'agency');
      expect(enforceRBAC(ctx, 'pro')).toBe(true);
    });

    it('denies lower role and tier to access higher required role', () => {
      const ctx = makeContext('pro', 'pro');
      expect(enforceRBAC(ctx, 'agency')).toBe(false);
    });

    it('allows exact match', () => {
      const ctx = makeContext('pro', 'free');
      expect(enforceRBAC(ctx, 'pro')).toBe(true);
    });

    it('denies unknown roles by defaulting to MAX_SAFE_INTEGER', () => {
      const ctx = makeContext('admin', 'agency');
      expect(enforceRBAC(ctx, 'super-admin' as any)).toBe(false);
    });
  });
});
