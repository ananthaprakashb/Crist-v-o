import { describe, expect, it } from 'vitest';
import { compileJourney } from './journeyCompiler';
import { applyStructuredProfile, reconcileDocument, type DocumentAnalysis } from './reconciliation';

describe('profile and document reconciliation', () => {
  it('adds explicit structured dates without inventing missing values', () => {
    const twin = compileJourney('I am on H-1B with a dependent.');
    const next = applyStructuredProfile(twin, {
      method: 'deterministic-fallback',
      model: 'test',
      confidence: 1,
      primaryStatus: 'H-1B',
      petitionValidTo: '2026-09-30',
      missingCriticalFacts: ['Current I-94 expiration date'],
    });

    expect(next.facts.find((fact) => fact.id === 'petition-validity')?.value).toBe('2026-09-30');
    expect(next.facts.some((fact) => fact.id === 'i94-expiration')).toBe(false);
  });

  it('preserves both values and impacts only declared nodes when a document date differs', () => {
    const base = applyStructuredProfile(compileJourney('I am on H-1B.'), {
      method: 'deterministic-fallback',
      model: 'test',
      confidence: 1,
      primaryStatus: 'H-1B',
      petitionValidTo: '2026-09-30',
      missingCriticalFacts: [],
    });

    const analysis: DocumentAnalysis = {
      documentType: 'I-797',
      synthetic: true,
      method: 'deterministic-synthetic',
      model: 'test',
      fields: {
        receiptNumber: { value: 'IOE0912345678', confidence: 1 },
        classification: { value: 'H-1B', confidence: 1 },
        validTo: { value: '2027-09-30', confidence: 1 },
      },
      notes: [],
    };

    const result = reconcileDocument(base, analysis);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].profileValue).toBe('2026-09-30');
    expect(result.mismatches[0].documentValue).toBe('2027-09-30');
    expect(result.twin.facts.find((fact) => fact.id === 'petition-validity')?.value).toBe('2026-09-30');
    expect(result.twin.facts.find((fact) => fact.id === 'document-valid-to')?.value).toBe('2027-09-30');
    expect(result.changedNodeIds).toEqual(['document-readiness', 'verify-critical-dates', 'next-milestone']);
  });
});
