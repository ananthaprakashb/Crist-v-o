import type {
  DigitalTwin,
  JourneyFact,
  JourneyNode,
  ScenarioId,
  ScenarioResult,
  UnknownFact,
} from './types';

const DEFAULT_GOAL = 'Understand the next actions, dependencies, and missing information in this immigration journey.';

const has = (input: string, pattern: RegExp) => pattern.test(input);

const extractPriorityDate = (input: string) => {
  const match = input.match(/priority\s+date\s*(?:is|:)?\s*([a-z]{3,9}\s+\d{1,2},?\s+\d{4}|[a-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  return match?.[1];
};

function buildFacts(input: string): JourneyFact[] {
  const facts: JourneyFact[] = [
    {
      id: 'goal',
      label: 'Goal',
      value: DEFAULT_GOAL,
      status: 'derived',
      source: 'compiler',
    },
  ];

  if (has(input, /\bh-?1b\b/i)) {
    facts.push({ id: 'primary-status', label: 'Primary status', value: 'H-1B', status: 'provided', source: 'user' });
  }

  if (has(input, /spouse/i)) {
    facts.push({ id: 'spouse', label: 'Family member', value: 'Spouse included in journey', status: 'provided', source: 'user' });
  }

  if (has(input, /child|daughter|son|dependent/i)) {
    facts.push({ id: 'dependent', label: 'Dependent', value: 'Dependent included in journey', status: 'provided', source: 'user' });
  }

  if (has(input, /green\s*card|employment[- ]based|i-?140|permanent residence/i)) {
    facts.push({ id: 'employment-path', label: 'Long-term goal', value: 'Employment-based permanent residence journey mentioned', status: 'provided', source: 'user' });
  }

  if (has(input, /college|university|school/i)) {
    facts.push({ id: 'education-milestone', label: 'Family milestone', value: 'Education milestone may affect planning priorities', status: 'provided', source: 'user' });
  }

  const priorityDate = extractPriorityDate(input);
  if (priorityDate) {
    facts.push({ id: 'priority-date', label: 'Priority date', value: priorityDate, status: 'provided', source: 'user' });
  }

  return facts;
}

function buildUnknowns(facts: JourneyFact[]): UnknownFact[] {
  const known = new Set(facts.map((fact) => fact.id));
  const unknowns: UnknownFact[] = [
    {
      id: 'i94-expiration',
      label: 'Current I-94 expiration date',
      whyItMatters: 'Critical dates should be verified before Cristóvão calculates time-sensitive actions.',
    },
    {
      id: 'petition-validity',
      label: 'Latest petition / approval validity dates',
      whyItMatters: 'Document dates can change which journey nodes need attention.',
    },
  ];

  if (!known.has('priority-date') && known.has('employment-path')) {
    unknowns.push({
      id: 'priority-date',
      label: 'Employment-based priority date',
      whyItMatters: 'This is required before comparing the journey against an applicable Visa Bulletin.',
    });
  }

  if (known.has('dependent')) {
    unknowns.push({
      id: 'dependent-dob',
      label: 'Dependent date of birth / age milestone',
      whyItMatters: 'Cristóvão should not infer age-sensitive consequences without the exact date.',
    });
  }

  return unknowns;
}

function node(
  value: Omit<JourneyNode, 'verificationStatus'> & { verificationStatus?: JourneyNode['verificationStatus'] },
): JourneyNode {
  return { verificationStatus: 'unverified', ...value };
}

function buildNodes(facts: JourneyFact[]): JourneyNode[] {
  const hasDependent = facts.some((fact) => fact.id === 'dependent');
  const hasEmploymentPath = facts.some((fact) => fact.id === 'employment-path');

  const nodes: JourneyNode[] = [
    node({
      id: 'current-profile',
      title: 'Current immigration profile',
      summary: 'User-provided facts become the root of the digital twin. No unstated facts are assumed.',
      kind: 'current',
      evidenceStatus: 'supported',
      verificationStatus: 'verified',
      impact: 'unchanged',
      dependsOn: [],
      affectedPeople: ['Primary'],
      evidenceIds: [],
    }),
    node({
      id: 'verify-critical-dates',
      title: 'Verify critical dates',
      summary: 'Collect exact validity and status dates before producing time-sensitive recommendations.',
      kind: 'requirement',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['current-profile'],
      affectedPeople: ['Primary'],
      evidenceIds: [],
    }),
    node({
      id: 'document-readiness',
      title: 'Build document readiness record',
      summary: 'Connect extracted document facts to the journey and flag disagreements instead of silently choosing a value.',
      kind: 'document',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['verify-critical-dates'],
      affectedPeople: ['Primary'],
      evidenceIds: [],
    }),
    node({
      id: 'authoritative-evidence',
      title: 'Match authoritative evidence',
      summary: 'Every consequential rule must point to a current authoritative passage before it is treated as verified.',
      kind: 'action',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['current-profile'],
      affectedPeople: ['Primary'],
      evidenceIds: ['uscis-policy-manual', 'visa-bulletin-2026-08'],
    }),
    node({
      id: 'employer-branch',
      title: 'Employment-change branch',
      summary: 'A what-if branch isolates which nodes would require review if the employment situation changes.',
      kind: 'risk',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['verify-critical-dates', 'authoritative-evidence'],
      affectedPeople: ['Primary'],
      evidenceIds: [],
    }),
    node({
      id: 'next-milestone',
      title: 'Next verified milestone',
      summary: 'Cristóvão advances only after required facts and evidence reach the configured verification threshold.',
      kind: 'milestone',
      evidenceStatus: 'unknown',
      impact: 'unchanged',
      dependsOn: ['document-readiness', 'authoritative-evidence'],
      affectedPeople: ['Primary'],
      evidenceIds: [],
    }),
  ];

  if (hasEmploymentPath) {
    nodes.splice(4, 0, node({
      id: 'priority-monitoring',
      title: 'Priority-date / bulletin monitoring',
      summary: 'Compare a verified priority date only against the applicable official bulletin and retain the exact source version used.',
      kind: 'action',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['authoritative-evidence'],
      affectedPeople: ['Primary'],
      evidenceIds: ['visa-bulletin-2026-08'],
    }));
  }

  if (hasDependent) {
    nodes.splice(nodes.length - 1, 0, node({
      id: 'dependent-milestone',
      title: 'Dependent milestone review',
      summary: 'Keep dependent age and education milestones explicit; do not infer age-sensitive outcomes from approximate information.',
      kind: 'milestone',
      evidenceStatus: 'needs-evidence',
      impact: 'unchanged',
      dependsOn: ['verify-critical-dates', 'authoritative-evidence'],
      affectedPeople: ['Dependent'],
      evidenceIds: [],
    }));
  }

  return nodes;
}

export function compileJourney(input: string): DigitalTwin {
  const facts = buildFacts(input);
  const people: DigitalTwin['people'] = [{ id: 'primary', role: 'Primary', status: facts.find((fact) => fact.id === 'primary-status')?.value }];

  if (facts.some((fact) => fact.id === 'spouse')) people.push({ id: 'spouse', role: 'Spouse' });
  if (facts.some((fact) => fact.id === 'dependent')) people.push({ id: 'dependent', role: 'Dependent' });

  return {
    id: `synthetic-${Date.now()}`,
    synthetic: true,
    goal: DEFAULT_GOAL,
    people,
    facts,
    unknowns: buildUnknowns(facts),
    nodes: buildNodes(facts),
    evidence: [
      {
        id: 'uscis-policy-manual',
        title: 'USCIS Policy Manual',
        publisher: 'U.S. Citizenship and Immigration Services',
        url: 'https://www.uscis.gov/policy-manual',
        authority: 'official-primary',
        claimType: 'rule',
        matchStatus: 'registered',
        semanticSupport: 'not-run',
        supports: ['authoritative-evidence'],
      },
      {
        id: 'visa-bulletin-2026-08',
        title: 'Visa Bulletin for August 2026',
        publisher: 'U.S. Department of State',
        url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
        authority: 'official-primary',
        claimType: 'rule',
        matchStatus: 'registered',
        semanticSupport: 'not-run',
        retrievedAt: '2026-08-12',
        sourceVersion: 'August 2026 · Publication 9514 · published July 15, 2026',
        supports: ['authoritative-evidence', 'priority-monitoring'],
      },
    ],
  };
}

const scenarioMeta: Record<Exclude<ScenarioId, 'baseline'>, { label: string; summary: string; changed: string[]; questions: string[] }> = {
  'employer-change': {
    label: 'Change employer',
    summary: 'Recompute only the journey nodes connected to the employment-change dependency.',
    changed: ['employer-branch', 'document-readiness', 'next-milestone'],
    questions: ['What is the effective date of the employment change?', 'Which petition / approval documents correspond to the new employment?'],
  },
  'dependent-milestone': {
    label: 'Dependent milestone',
    summary: 'Expose dependent-specific nodes and request exact dates before calculating consequences.',
    changed: ['dependent-milestone', 'verify-critical-dates', 'next-milestone'],
    questions: ['What is the dependent’s exact date of birth?', 'Which upcoming education or status milestone should be modeled?'],
  },
  'policy-update': {
    label: 'Official source update',
    summary: 'Simulate a source-version change and mark only nodes that consume that evidence for re-verification.',
    changed: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
    questions: ['Which source version changed?', 'Does the changed passage support, contradict, or invalidate the existing rule?'],
  },
};

export function applyScenario(twin: DigitalTwin, scenario: ScenarioId): ScenarioResult {
  if (scenario === 'baseline') {
    return {
      id: 'baseline',
      label: 'Baseline',
      summary: 'Current synthetic journey with no simulated changes.',
      twin: structuredClone(twin),
      changedNodeIds: [],
      questionsRaised: [],
    };
  }

  const meta = scenarioMeta[scenario];
  const nextTwin = structuredClone(twin);
  const existingIds = new Set(nextTwin.nodes.map((item) => item.id));
  const changedNodeIds = meta.changed.filter((id) => existingIds.has(id));

  nextTwin.nodes = nextTwin.nodes.map((item) =>
    changedNodeIds.includes(item.id)
      ? {
          ...item,
          impact: 'changed',
          verificationStatus: item.id === 'current-profile' ? 'verified' : 'needs-review',
          evidenceStatus: item.evidenceStatus === 'supported' ? 'supported' : 'needs-evidence',
        }
      : { ...item, impact: 'unchanged' },
  );

  if (scenario === 'policy-update') {
    nextTwin.evidence = nextTwin.evidence.map((record) =>
      record.id === 'visa-bulletin-2026-08'
        ? { ...record, semanticSupport: 'not-run', matchStatus: 'registered' }
        : record,
    );
  }

  return {
    id: scenario,
    label: meta.label,
    summary: meta.summary,
    twin: nextTwin,
    changedNodeIds,
    questionsRaised: meta.questions,
  };
}

export function readiness(twin: DigitalTwin) {
  const total = Math.max(twin.nodes.length, 1);
  const verified = twin.nodes.filter((item) => item.verificationStatus === 'verified').length;
  const evidenceCoverage = Math.round((verified / total) * 100);
  const knownFacts = twin.facts.length;
  const factCompleteness = Math.round((knownFacts / (knownFacts + twin.unknowns.length)) * 100);

  return {
    journeyReadiness: Math.round(evidenceCoverage * 0.55 + factCompleteness * 0.45),
    evidenceCoverage,
    factCompleteness,
    unknownCount: twin.unknowns.length,
  };
}
