import { describe, expect, it } from 'vitest';
import { verifyJourney } from './evidenceEngine';
import { compileJourney } from './journeyCompiler';

const syntheticCase = `I'm on H-1B. My spouse and child are dependents. My employer started an employment-based green card process.`;

function completeEvidence(twin: ReturnType<typeof compileJourney>) {
  const next = structuredClone(twin);
  next.evidence = next.evidence.map((record) => ({
    ...record,
    matchStatus: 'matched' as const,
    semanticSupport: 'supported' as const,
    retrievedAt: record.retrievedAt ?? '2026-08-12',
    sourceVersion: record.sourceVersion ?? 'demo-version-1',
    contentHash: `sha256:${record.id}`,
    passage: 'Synthetic retained passage used only to exercise the deterministic verifier in tests.',
  }));
  return next;
}

describe('Evidence Engine', () => {
  it('does not treat an official source registration as verified evidence', () => {
    const result = verifyJourney(compileJourney(syntheticCase));
    const evidenceNode = result.report.nodes.find((node) => node.nodeId === 'authoritative-evidence');

    expect(evidenceNode?.status).toBe('needs-review');
    expect(result.report.verifiedNodes).toBe(1);
  });

  it('verifies a node only after every attached evidence record passes all checks', () => {
    const result = verifyJourney(completeEvidence(compileJourney(syntheticCase)));
    const evidenceNode = result.report.nodes.find((node) => node.nodeId === 'authoritative-evidence');

    expect(evidenceNode?.status).toBe('verified');
    expect(result.twin.nodes.find((node) => node.id === 'authoritative-evidence')?.evidenceStatus).toBe('supported');
  });

  it('rejects a consequential node when attached evidence contradicts the claim', () => {
    const twin = completeEvidence(compileJourney(syntheticCase));
    twin.evidence = twin.evidence.map((record) =>
      record.id === 'visa-bulletin-2026-08'
        ? { ...record, semanticSupport: 'contradicted' as const }
        : record,
    );

    const result = verifyJourney(twin);
    expect(result.report.nodes.find((node) => node.nodeId === 'authoritative-evidence')?.status).toBe('rejected');
  });
});
