import { describe, expect, it } from 'vitest';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import {
  assertManualTriggerHmac,
  assertManualTriggerAuthorizedV2,
  UNAUTHORIZED_MANUAL_TRIGGER,
} from '../cre-workflows/_shared/manualTriggerAuth.js';
import { stableJsonStringify } from '../cre-workflows/_shared/determinism.js';

/**
 * H-01 (audit 2026-04-25) regression coverage. The CRE workflow HTTP-trigger
 * auth previously used a plain string-equality compare against a secret named
 * CRE_RUNTIME_WEBHOOK_HMAC_SECRET. The fix mirrors the contract enforced by
 * frontend/server/_lib/cre/runtimeBridge.ts:authenticateRuntimeRequest:
 *   - hmac-sha256(secret, `${timestamp}.${nonce}.${canonicalBody}`)
 *   - ±5 minute timestamp skew window
 *   - constant-time hex compare
 *   - canonical body excludes authToken / timestamp / nonce so the signature
 *     is over the *meaningful* payload, not the wrapping envelope.
 *
 * These tests pin every leg of that contract so a regression that drops one
 * of the legs (timestamp window, nonce check, signature compare) fails CI.
 */

const SECRET = 'the-quick-brown-fox-jumps-over-the-lazy-dog';
const FROZEN_NOW = 1_715_000_000_000;

function sign(secret: string, timestamp: number, nonce: string, body: unknown): string {
  const canonical = stableJsonStringify(body);
  const signed = `${timestamp}.${nonce}.${canonical}`;
  return bytesToHex(
    hmac(sha256, new TextEncoder().encode(secret), new TextEncoder().encode(signed)),
  );
}

describe('assertManualTriggerHmac [H-01]', () => {
  it('accepts a well-formed HMAC envelope within the skew window', () => {
    const body = { foo: 'bar', n: 1 };
    const ts = FROZEN_NOW;
    const nonce = 'a'.repeat(32);
    const authToken = sign(SECRET, ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).not.toThrow();
  });

  it('accepts the optional sha256= prefix on authToken', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'b'.repeat(32);
    const authToken = `sha256=${sign(SECRET, ts, nonce, body)}`;

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).not.toThrow();
  });

  it('rejects when the HMAC signature is for the wrong secret', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'c'.repeat(32);
    const authToken = sign('wrong-secret', ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects when the body has been tampered with after signing', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'd'.repeat(32);
    const authToken = sign(SECRET, ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac(
        { foo: 'evil', authToken, timestamp: ts, nonce },
        SECRET,
        { nowMs: () => FROZEN_NOW },
      ),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects timestamps outside the ±5 minute skew window', () => {
    const body = { foo: 'bar' };
    const nonce = 'e'.repeat(32);
    const tsTooOld = FROZEN_NOW - 6 * 60 * 1000;
    const tsTooNew = FROZEN_NOW + 6 * 60 * 1000;

    expect(() =>
      assertManualTriggerHmac(
        {
          ...body,
          authToken: sign(SECRET, tsTooOld, nonce, body),
          timestamp: tsTooOld,
          nonce,
        },
        SECRET,
        { nowMs: () => FROZEN_NOW },
      ),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));

    expect(() =>
      assertManualTriggerHmac(
        {
          ...body,
          authToken: sign(SECRET, tsTooNew, nonce, body),
          timestamp: tsTooNew,
          nonce,
        },
        SECRET,
        { nowMs: () => FROZEN_NOW },
      ),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects payloads missing timestamp / nonce', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'f'.repeat(32);
    const authToken = sign(SECRET, ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects nonces shorter than the configured minimum', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'short';
    const authToken = sign(SECRET, ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects when the configured secret is empty', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'g'.repeat(32);
    const authToken = sign('', ts, nonce, body);

    expect(() =>
      assertManualTriggerHmac({ ...body, authToken, timestamp: ts, nonce }, '', {
        nowMs: () => FROZEN_NOW,
      }),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });

  it('rejects non-object payloads outright', () => {
    expect(() => assertManualTriggerHmac(null, SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
    expect(() => assertManualTriggerHmac('hello', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
    expect(() => assertManualTriggerHmac([1, 2, 3], SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('canonicalizes nested object keys before signing', () => {
    const ts = FROZEN_NOW;
    const nonce = 'h'.repeat(32);

    // Stable JSON sorts keys recursively, so two structurally identical
    // payloads with different in-memory key order MUST produce the same
    // signature. Both objects below have the same canonical form.
    const bodyA = { z: 1, a: { y: 2, x: 3 } };
    const bodyB = { a: { x: 3, y: 2 }, z: 1 };
    const authA = sign(SECRET, ts, nonce, bodyA);
    const authB = sign(SECRET, ts, nonce, bodyB);

    expect(authA).toBe(authB);
    expect(() =>
      assertManualTriggerHmac({ ...bodyB, authToken: authA, timestamp: ts, nonce }, SECRET, {
        nowMs: () => FROZEN_NOW,
      }),
    ).not.toThrow();
  });
});

describe('assertManualTriggerAuthorizedV2 [migration helper]', () => {
  it('takes the HMAC path when timestamp and nonce are present', () => {
    const body = { foo: 'bar' };
    const ts = FROZEN_NOW;
    const nonce = 'i'.repeat(32);
    const authToken = sign(SECRET, ts, nonce, body);

    const mode = assertManualTriggerAuthorizedV2(
      { ...body, authToken, timestamp: ts, nonce },
      SECRET,
      { nowMs: () => FROZEN_NOW },
    );
    expect(mode).toBe('hmac');
  });

  it('takes the legacy plain-token path when timestamp/nonce are absent', () => {
    const mode = assertManualTriggerAuthorizedV2({ authToken: SECRET }, SECRET);
    expect(mode).toBe('legacy');
  });

  it('rejects on legacy path when token does not match secret', () => {
    expect(() =>
      assertManualTriggerAuthorizedV2({ authToken: 'wrong' }, SECRET),
    ).toThrowError(new RegExp(UNAUTHORIZED_MANUAL_TRIGGER));
  });
});
