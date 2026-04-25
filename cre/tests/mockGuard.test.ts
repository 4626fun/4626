import { describe, expect, it } from 'vitest';
import {
  assertMockDataAllowed,
  isLocalSimulationName,
  isMockDataAllowed,
} from '../cre-workflows/_shared/mockGuard.js';

/**
 * H-02 (audit 2026-04-25) regression coverage. CRE workflows that branch on
 * `mockGraphData` / `mockMatchedTransactions` / `mockResults` previously had
 * no in-code refusal to honor mock fields when run against a non-local
 * target. The guard now enforces a two-key gate:
 *   1. operator must explicitly set `allowMockData: true`
 *   2. workflowName must end in `-local-simulation`
 * Both must be true for the workflow to honor mock fields. These tests pin
 * each leg of that contract.
 */

describe('isLocalSimulationName', () => {
  it('matches names suffixed with `-local-simulation`', () => {
    expect(isLocalSimulationName('runtime-orchestrator-local-simulation')).toBe(true);
    expect(isLocalSimulationName('runtime-indexer-data-fetch-local-simulation')).toBe(true);
    expect(isLocalSimulationName('local-simulation')).toBe(true);
  });

  it('rejects production / staging / undefined names', () => {
    expect(isLocalSimulationName('runtime-orchestrator')).toBe(false);
    expect(isLocalSimulationName('runtime-orchestrator-staging')).toBe(false);
    expect(isLocalSimulationName('runtime-orchestrator-production')).toBe(false);
    expect(isLocalSimulationName(undefined)).toBe(false);
    expect(isLocalSimulationName('')).toBe(false);
  });
});

describe('isMockDataAllowed', () => {
  it('requires both allowMockData=true AND a local-simulation workflow name', () => {
    expect(
      isMockDataAllowed({ allowMockData: true, workflowName: 'foo-local-simulation' }),
    ).toBe(true);
    expect(
      isMockDataAllowed({ allowMockData: true, workflowName: 'foo-staging' }),
    ).toBe(false);
    expect(
      isMockDataAllowed({ allowMockData: true, workflowName: 'foo-production' }),
    ).toBe(false);
    expect(
      isMockDataAllowed({ allowMockData: false, workflowName: 'foo-local-simulation' }),
    ).toBe(false);
    expect(
      isMockDataAllowed({ allowMockData: undefined, workflowName: 'foo-local-simulation' }),
    ).toBe(false);
  });
});

describe('assertMockDataAllowed', () => {
  it('passes silently when no mock fields are present, regardless of env', () => {
    expect(() =>
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-production', allowMockData: false },
        { mockA: undefined, mockB: undefined },
      ),
    ).not.toThrow();
  });

  it('passes when mock fields are present AND the workflow is local-sim with opt-in', () => {
    expect(() =>
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-local-simulation', allowMockData: true },
        { mockLatestBlockNumber: 1 },
      ),
    ).not.toThrow();
  });

  it('throws when mock fields are present but allowMockData is missing', () => {
    expect(() =>
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-local-simulation' },
        { mockLatestBlockNumber: 1 },
      ),
    ).toThrow(/mock_data_not_permitted/);
  });

  it('throws when mock fields are present and the workflow is staging/production, even with allowMockData=true', () => {
    expect(() =>
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-staging', allowMockData: true },
        { mockLatestBlockNumber: 1 },
      ),
    ).toThrow(/mock_data_not_permitted/);
    expect(() =>
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-production', allowMockData: true },
        { mockLatestBlockNumber: 1 },
      ),
    ).toThrow(/mock_data_not_permitted/);
  });

  it('reports the offending field names in the error message', () => {
    try {
      assertMockDataAllowed(
        { workflowName: 'runtime-orchestrator-staging' },
        { mockLatestBlockNumber: 1, mockMatchedTransactions: 5 },
      );
      throw new Error('should have thrown');
    } catch (err) {
      expect(String(err)).toContain('mockLatestBlockNumber');
      expect(String(err)).toContain('mockMatchedTransactions');
    }
  });
});
