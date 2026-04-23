import { describe, expect, it } from 'vitest';
import {
  assertManualTriggerAuthorized,
  UNAUTHORIZED_MANUAL_TRIGGER,
} from '../cre-workflows/_shared/manualTriggerAuth.js';

/**
 * Regression test for ex-SEV-010 (4626-418).
 *
 * Audit context: the runtime-orchestrator's HTTPCapability trigger can
 * enqueueAction into the runtime decision sink. The audit finding was that
 * the documented auth fix existed in runbooks but not in code. The fix
 * shipped in PR #318 (commit 847fee0) inside
 * `cre/cre-workflows/runtime-orchestrator/main.ts` and now calls into the
 * shared `assertManualTriggerAuthorized` helper.
 *
 * These tests pin the helper's contract, so a silent removal of the check
 * (or a regression that accepts empty/wrong tokens) fails CI before merge.
 *
 * The shared helper is also tested from the charm workflow's test suite
 * (ex-SEV-001); duplicating the coverage here keeps the trace to ex-SEV-010
 * explicit and means deleting either workflow's call site still leaves a
 * failing test pinned to the right audit finding.
 */
describe('manual trigger auth gate [ex-SEV-010 runtime-orchestrator]', () => {
  const SECRET = 'orchestrator-keepr-api-key-v1';

  it('throws unauthorized_manual_trigger when authToken is undefined', () => {
    expect(() => assertManualTriggerAuthorized(undefined, SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('throws unauthorized_manual_trigger when authToken is an empty string', () => {
    expect(() => assertManualTriggerAuthorized('', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('throws unauthorized_manual_trigger when authToken does not match the secret', () => {
    expect(() => assertManualTriggerAuthorized('some-other-value', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('rejects a token that is a prefix or suffix of the configured secret', () => {
    expect(() => assertManualTriggerAuthorized(SECRET.slice(0, 5), SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
    expect(() => assertManualTriggerAuthorized(SECRET + 'x', SECRET)).toThrowError(
      new RegExp(UNAUTHORIZED_MANUAL_TRIGGER),
    );
  });

  it('accepts only an exact match of the configured secret', () => {
    expect(() => assertManualTriggerAuthorized(SECRET, SECRET)).not.toThrow();
  });
});
