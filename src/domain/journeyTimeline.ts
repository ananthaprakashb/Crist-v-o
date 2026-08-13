export type TimelineUrgency = 'overdue' | 'urgent' | 'soon' | 'later' | 'unknown';
export type TimelineDateKind = 'exact' | 'today' | 'unknown';

export interface TimelineInput {
  petitionValidTo?: string;
  i94Expiration?: string;
  priorityDate?: string;
  missingCriticalFacts?: string[];
  documentDiscrepancy?: boolean;
}

export interface TimelineItem {
  id: string;
  title: string;
  date?: string;
  dateKind: TimelineDateKind;
  urgency: TimelineUrgency;
  daysAway?: number;
  explanation: string;
  source: 'profile' | 'document-review' | 'missing-fact';
  relatedNodeIds: string[];
}

function parseIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dateOnlyUtc(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function daysBetween(anchor: Date, targetIso: string) {
  const target = parseIsoDate(targetIso);
  if (!target) return undefined;
  return Math.round((dateOnlyUtc(target) - dateOnlyUtc(anchor)) / 86_400_000);
}

export function urgencyForDate(anchor: Date, targetIso: string): TimelineUrgency {
  const days = daysBetween(anchor, targetIso);
  if (days === undefined) return 'unknown';
  if (days < 0) return 'overdue';
  if (days <= 30) return 'urgent';
  if (days <= 90) return 'soon';
  return 'later';
}

function exactItem(
  id: string,
  title: string,
  date: string,
  anchor: Date,
  explanation: string,
  relatedNodeIds: string[],
): TimelineItem {
  return {
    id,
    title,
    date,
    dateKind: 'exact',
    urgency: urgencyForDate(anchor, date),
    daysAway: daysBetween(anchor, date),
    explanation,
    source: 'profile',
    relatedNodeIds,
  };
}

export function buildJourneyTimeline(input: TimelineInput, anchor = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (input.documentDiscrepancy) {
    items.push({
      id: 'document-discrepancy-review',
      title: 'Resolve document/profile discrepancy',
      dateKind: 'today',
      urgency: 'urgent',
      daysAway: 0,
      explanation: 'Two retained values disagree. Cristóvão keeps both and places reconciliation ahead of dependent planning.',
      source: 'document-review',
      relatedNodeIds: ['verify-critical-dates', 'document-readiness', 'next-milestone'],
    });
  }

  if (input.petitionValidTo && parseIsoDate(input.petitionValidTo)) {
    items.push(exactItem(
      'petition-validity',
      'Approval validity date',
      input.petitionValidTo,
      anchor,
      'A user- or document-stated validity date. This is an observed date, not a generated filing deadline.',
      ['verify-critical-dates', 'document-readiness', 'next-milestone'],
    ));
  }

  if (input.i94Expiration && parseIsoDate(input.i94Expiration)) {
    items.push(exactItem(
      'i94-expiration',
      'I-94 expiration date',
      input.i94Expiration,
      anchor,
      'An explicitly provided expiration date used as a chronological anchor.',
      ['verify-critical-dates', 'next-milestone'],
    ));
  }

  if (input.priorityDate && parseIsoDate(input.priorityDate)) {
    items.push({
      ...exactItem(
        'priority-date',
        'Priority date recorded',
        input.priorityDate,
        anchor,
        'A historical journey anchor. It is shown for sequence context and is not treated as an upcoming deadline.',
        ['priority-monitoring'],
      ),
      urgency: 'later',
    });
  }

  const missing = input.missingCriticalFacts ?? [];
  for (const label of missing) {
    const normalized = label.toLowerCase();
    const relatedNodeIds = normalized.includes('i-94') || normalized.includes('validity')
      ? ['verify-critical-dates', 'next-milestone']
      : normalized.includes('priority')
        ? ['priority-monitoring', 'next-milestone']
        : ['next-milestone'];
    items.push({
      id: `missing-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      title: label,
      dateKind: 'unknown',
      urgency: 'unknown',
      explanation: 'No exact date is available, so Cristóvão keeps this item unscheduled instead of estimating it.',
      source: 'missing-fact',
      relatedNodeIds,
    });
  }

  const rank: Record<TimelineUrgency, number> = { overdue: 0, urgent: 1, soon: 2, later: 3, unknown: 4 };
  return items.sort((a, b) => {
    const urgencyDelta = rank[a.urgency] - rank[b.urgency];
    if (urgencyDelta) return urgencyDelta;
    if (a.daysAway === undefined && b.daysAway !== undefined) return 1;
    if (a.daysAway !== undefined && b.daysAway === undefined) return -1;
    return (a.daysAway ?? 0) - (b.daysAway ?? 0);
  });
}
