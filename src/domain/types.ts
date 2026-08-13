export type FactStatus = 'provided' | 'derived' | 'unknown';
export type NodeKind = 'current' | 'requirement' | 'document' | 'action' | 'risk' | 'milestone';
export type NodeEvidenceStatus = 'supported' | 'needs-evidence' | 'unknown';
export type ImpactState = 'unchanged' | 'changed' | 'new';
export type ScenarioId = 'baseline' | 'employer-change' | 'dependent-milestone' | 'policy-update';
export type EvidenceMatchStatus = 'registered' | 'matched' | 'superseded';
export type EvidenceAuthority = 'official-primary' | 'official-secondary' | 'community';
export type ClaimType = 'fact' | 'rule' | 'inference' | 'unknown';
export type SemanticSupport = 'supported' | 'contradicted' | 'uncertain' | 'not-run';
export type VerificationStatus = 'verified' | 'needs-review' | 'rejected' | 'unverified';

export interface JourneyFact {
  id: string;
  label: string;
  value: string;
  status: FactStatus;
  source: 'user' | 'compiler' | 'document';
}

export interface UnknownFact {
  id: string;
  label: string;
  whyItMatters: string;
}

export interface JourneyNode {
  id: string;
  title: string;
  summary: string;
  kind: NodeKind;
  evidenceStatus: NodeEvidenceStatus;
  verificationStatus: VerificationStatus;
  impact: ImpactState;
  dependsOn: string[];
  affectedPeople: string[];
  evidenceIds: string[];
}

export interface EvidenceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  authority: EvidenceAuthority;
  claimType: ClaimType;
  matchStatus: EvidenceMatchStatus;
  semanticSupport: SemanticSupport;
  retrievedAt?: string;
  sourceVersion?: string;
  contentHash?: string;
  passage?: string;
  supports: string[];
}

export interface DigitalTwin {
  id: string;
  synthetic: true;
  goal: string;
  people: Array<{ id: string; role: string; status?: string }>;
  facts: JourneyFact[];
  unknowns: UnknownFact[];
  nodes: JourneyNode[];
  evidence: EvidenceRecord[];
}

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  summary: string;
  twin: DigitalTwin;
  changedNodeIds: string[];
  questionsRaised: string[];
}

export interface VerificationCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface EvidenceVerification {
  evidenceId: string;
  status: VerificationStatus;
  checks: VerificationCheck[];
}

export interface NodeVerification {
  nodeId: string;
  status: VerificationStatus;
  evidenceIds: string[];
  reasons: string[];
}

export interface VerificationReport {
  totalNodes: number;
  verifiedNodes: number;
  unresolvedNodeIds: string[];
  evidence: EvidenceVerification[];
  nodes: NodeVerification[];
}
