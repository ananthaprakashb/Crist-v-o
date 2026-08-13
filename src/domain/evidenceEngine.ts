import type {
  DigitalTwin,
  EvidenceRecord,
  EvidenceVerification,
  NodeVerification,
  VerificationCheck,
  VerificationReport,
  VerificationStatus,
} from './types';

const OFFICIAL_PRIMARY_HOSTS = new Set(['uscis.gov', 'www.uscis.gov', 'travel.state.gov']);

function hostFor(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function verifyEvidence(record: EvidenceRecord): EvidenceVerification {
  const host = hostFor(record.url);
  const checks: VerificationCheck[] = [
    {
      id: 'https',
      label: 'HTTPS source',
      passed: record.url.startsWith('https://'),
      detail: record.url.startsWith('https://') ? 'Source is served over HTTPS.' : 'Source URL is not HTTPS.',
    },
    {
      id: 'authority',
      label: 'Authoritative domain',
      passed: record.authority !== 'official-primary' || OFFICIAL_PRIMARY_HOSTS.has(host),
      detail:
        record.authority === 'official-primary'
          ? OFFICIAL_PRIMARY_HOSTS.has(host)
            ? `${host} is in Cristóvão's official primary-source allowlist.`
            : `${host || 'Unknown host'} is not in the official primary-source allowlist.`
          : `Authority tier is ${record.authority}.`,
    },
    {
      id: 'match',
      label: 'Passage matched',
      passed: record.matchStatus === 'matched',
      detail:
        record.matchStatus === 'matched'
          ? 'A specific passage has been matched to the journey claim.'
          : 'The source is registered, but no specific passage has been matched yet.',
    },
    {
      id: 'snapshot',
      label: 'Versioned snapshot',
      passed: Boolean(record.retrievedAt && record.sourceVersion && record.contentHash),
      detail:
        record.retrievedAt && record.sourceVersion && record.contentHash
          ? `Snapshot ${record.sourceVersion} was retained with a content hash.`
          : 'Retrieved time, source version, and content hash are required before this evidence is durable.',
    },
    {
      id: 'passage',
      label: 'Evidence passage retained',
      passed: Boolean(record.passage?.trim()),
      detail: record.passage?.trim()
        ? 'The evidence passage is retained for inspection.'
        : 'No evidence passage is retained yet.',
    },
    {
      id: 'semantic',
      label: 'Independent claim verification',
      passed: record.semanticSupport === 'supported',
      detail:
        record.semanticSupport === 'supported'
          ? 'The required claims were independently verified against the retained evidence. Deterministic checks are used where the source structure makes correctness directly testable; semantic AI is reserved for prose that requires interpretation.'
          : record.semanticSupport === 'contradicted'
            ? 'Independent verification found a contradiction in a required claim.'
            : record.semanticSupport === 'uncertain'
              ? 'At least one required claim could not be established from the retained evidence.'
              : 'Independent claim verification has not completed for the current evidence bundle.',
    },
  ];

  let status: VerificationStatus = 'needs-review';
  if (record.semanticSupport === 'contradicted') status = 'rejected';
  else if (checks.every((check) => check.passed)) status = 'verified';

  return { evidenceId: record.id, status, checks };
}

function verifyNode(
  twin: DigitalTwin,
  evidenceById: Map<string, EvidenceVerification>,
  nodeId: string,
): NodeVerification {
  const node = twin.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return {
      nodeId,
      status: 'rejected',
      evidenceIds: [],
      reasons: ['Journey node does not exist.'],
    };
  }

  if (node.kind === 'current' && node.evidenceIds.length === 0) {
    return {
      nodeId,
      status: 'verified',
      evidenceIds: [],
      reasons: ['This root node only represents user-provided facts; it is not a legal or policy conclusion.'],
    };
  }

  if (node.evidenceIds.length === 0) {
    return {
      nodeId,
      status: 'unverified',
      evidenceIds: [],
      reasons: ['No authoritative evidence is attached to this consequential node yet.'],
    };
  }

  const missingIds = node.evidenceIds.filter((id) => !evidenceById.has(id));
  if (missingIds.length > 0) {
    return {
      nodeId,
      status: 'rejected',
      evidenceIds: node.evidenceIds,
      reasons: [`Missing evidence records: ${missingIds.join(', ')}.`],
    };
  }

  const verifications = node.evidenceIds.map((id) => evidenceById.get(id)!);
  if (verifications.some((item) => item.status === 'rejected')) {
    return {
      nodeId,
      status: 'rejected',
      evidenceIds: node.evidenceIds,
      reasons: ['At least one attached evidence record was rejected by the independent verifier.'],
    };
  }

  if (verifications.every((item) => item.status === 'verified')) {
    return {
      nodeId,
      status: 'verified',
      evidenceIds: node.evidenceIds,
      reasons: ['All attached evidence passed provenance, snapshot, passage, and independent claim-verification checks.'],
    };
  }

  return {
    nodeId,
    status: 'needs-review',
    evidenceIds: node.evidenceIds,
    reasons: ['Evidence is attached, but one or more verifier checks are still incomplete.'],
  };
}

export function verifyJourney(twin: DigitalTwin): { twin: DigitalTwin; report: VerificationReport } {
  const evidence = twin.evidence.map(verifyEvidence);
  const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  const nodes = twin.nodes.map((node) => verifyNode(twin, evidenceById, node.id));
  const nodeById = new Map(nodes.map((item) => [item.nodeId, item]));

  const nextTwin = structuredClone(twin);
  nextTwin.nodes = nextTwin.nodes.map((node) => {
    const result = nodeById.get(node.id);
    const status = result?.status ?? 'unverified';
    return {
      ...node,
      verificationStatus: status,
      evidenceStatus: status === 'verified' ? 'supported' : status === 'unverified' ? 'unknown' : 'needs-evidence',
    };
  });

  const verifiedNodes = nodes.filter((node) => node.status === 'verified').length;
  return {
    twin: nextTwin,
    report: {
      totalNodes: nodes.length,
      verifiedNodes,
      unresolvedNodeIds: nodes.filter((node) => node.status !== 'verified').map((node) => node.nodeId),
      evidence,
      nodes,
    },
  };
}

export function evidenceVerificationFor(report: VerificationReport, evidenceId: string) {
  return report.evidence.find((item) => item.evidenceId === evidenceId);
}

export function nodeVerificationFor(report: VerificationReport, nodeId: string) {
  return report.nodes.find((item) => item.nodeId === nodeId);
}
