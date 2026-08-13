import { describe, expect, it } from 'vitest';
import { applyScenario, compileJourney } from './journeyCompiler';

const syntheticCase = `
  I am on H-1B. My spouse and child are dependents. My employer started an
  employment-based green card process and my child will start college soon.
`;

describe('Journey Compiler', () => {
  it('extracts provided facts without inventing critical dates', () => {
    const twin = compileJourney(syntheticCase);

    expect(twin.facts.some((fact) => fact.id === 'primary-status' && fact.value === 'H-1B')).toBe(true);
    expect(twin.facts.some((fact) => fact.id === 'spouse')).toBe(true);
    expect(twin.facts.some((fact) => fact.id === 'dependent')).toBe(true);
    expect(twin.unknowns.some((unknown) => unknown.id === 'i94-expiration')).toBe(true);
  });

  it('limits employer-change impact to connected demo nodes', () => {
    const twin = compileJourney(syntheticCase);
    const result = applyScenario(twin, 'employer-change');

    expect(result.changedNodeIds).toEqual(['employer-branch', 'document-readiness', 'next-milestone']);
    expect(result.twin.nodes.filter((node) => node.impact === 'changed')).toHaveLength(3);
  });

  it('does not mutate the baseline twin when simulating a scenario', () => {
    const twin = compileJourney(syntheticCase);
    applyScenario(twin, 'policy-update');

    expect(twin.nodes.every((node) => node.impact === 'unchanged')).toBe(true);
  });
});
