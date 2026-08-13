import type { DigitalTwin, JourneyFact } from './types';

export type StructuredProfile = {
  method: string;
  model: string;
  confidence: number;
  primaryStatus?: string;
  priorityDate?: string;
  petitionValidTo?: string;
  i94Expiration?: string;
  missingCriticalFacts: string[];
};

export type ExtractedField = { value?: string; confidence: number };

export type DocumentAnalysis = {
  documentType: string;
  synthetic: true;
  method: string;
  model: string;
  fields: Record<string, ExtractedField>;
  notes: string[];
};

export type FieldMismatch = {
  id: string;
  field: string;
  profileValue: string;
  documentValue: string;
  explanation: string;
};

function upsertFact(twin: DigitalTwin, fact: JourneyFact) {
  const index = twin.facts.findIndex((item) => item.id === fact.id);
  if (index >= 0) twin.facts[index] = fact;
  else twin.facts.push(fact);
}

export function applyStructuredProfile(twin: DigitalTwin, profile: StructuredProfile) {
  const next = structuredClone(twin);
  const add = (id: string, label: string, value?: string) => {
    if (!value) return;
    upsertFact(next, { id, label, value, status: 'provided', source: 'user' });
    next.unknowns = next.unknowns.filter((item) => item.id !== id);
  };

  add('primary-status', 'Primary status', profile.primaryStatus);
  add('priority-date', 'Priority date', profile.priorityDate);
  add('petition-validity', 'User-stated approval valid through', profile.petitionValidTo);
  add('i94-expiration', 'I-94 expiration date', profile.i94Expiration);
  return next;
}

export function reconcileDocument(twin: DigitalTwin, analysis: DocumentAnalysis) {
  const next = structuredClone(twin);
  const mismatches: FieldMismatch[] = [];
  const profileValidity = next.facts.find((fact) => fact.id === 'petition-validity')?.value;
  const documentValidity = analysis.fields.validTo?.value;

  if (profileValidity && documentValidity && profileValidity !== documentValidity) {
    mismatches.push({
      id: 'validity-mismatch',
      field: 'Validity end date',
      profileValue: profileValidity,
      documentValue: documentValidity,
      explanation: 'The profile and document contain different values. Both remain visible until reviewed.',
    });
  }

  const extractedFacts: Array<[string, string, string | undefined]> = [
    ['document-receipt-number', 'Document receipt number', analysis.fields.receiptNumber?.value],
    ['document-classification', 'Document classification', analysis.fields.classification?.value],
    ['document-petitioner', 'Document petitioner', analysis.fields.petitioner?.value],
    ['document-beneficiary', 'Document beneficiary', analysis.fields.beneficiary?.value],
    ['document-notice-date', 'Document notice date', analysis.fields.noticeDate?.value],
    ['document-valid-from', 'Document valid from', analysis.fields.validFrom?.value],
    ['document-valid-to', 'Document valid through', documentValidity],
  ];

  for (const [id, label, value] of extractedFacts) {
    if (value) upsertFact(next, { id, label, value, status: 'provided', source: 'document' });
  }

  next.unknowns = next.unknowns.filter((item) => item.id !== 'document-discrepancy');
  if (mismatches.length) {
    next.unknowns.push({
      id: 'document-discrepancy',
      label: 'Document / profile discrepancy requires review',
      whyItMatters: 'Both values are preserved until the mismatch is resolved.',
    });
  }

  const changedNodeIds = ['document-readiness', 'verify-critical-dates', 'next-milestone'].filter((id) => next.nodes.some((node) => node.id === id));
  next.nodes = next.nodes.map((node) => changedNodeIds.includes(node.id) ? { ...node, impact: 'changed' } : node);
  return { twin: next, mismatches, changedNodeIds };
}
