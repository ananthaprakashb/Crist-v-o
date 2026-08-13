export type FactStatus = 'provided' | 'derived' | 'unknown';
export type NodeKind = 'current' | 'requirement' | 'document' | 'action' | 'risk' | 'milestone';
export type NodeEvidenceStatus = 'supported' | 'needs-evidence' | 'unknown';
export type ImpactState = 'unchanged' | 'changed' | 'new';
export type ScenarioId = 'baseline' | 'employer-change' | 'dependent-milestone' | 'policy-update';

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
  status: 'matched' | 'pending-match';
  retrievedAt?: string;
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
