import { useMemo, useState } from 'react';
import { buildJourneyTimeline } from './domain/journeyTimeline';
import './timelinePreview.css';

export default function TimelinePreview() {
  const [open, setOpen] = useState(false);
  const timeline = useMemo(() => buildJourneyTimeline({
    petitionValidTo: '2026-09-30',
    missingCriticalFacts: ['Exact date not available'],
  }), []);

  if (!open) return <button className="timeline-preview-launch" onClick={() => setOpen(true)}>Timeline preview</button>;

  return (
    <aside className="timeline-preview" aria-label="Timeline preview">
      <div className="timeline-preview-head">
        <div><span>TIMELINE PREVIEW</span><strong>Known dates stay exact. Unknown dates stay unscheduled.</strong></div>
        <button onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="timeline-preview-list">
        {timeline.map((item) => (
          <article key={item.id}>
            <div><span>{item.date ?? 'UNSCHEDULED'}</span><b>{item.urgency.toUpperCase()}</b></div>
            <strong>{item.title}</strong>
            <p>{item.explanation}</p>
          </article>
        ))}
      </div>
      <small>Chronology only. No estimated dates are added.</small>
    </aside>
  );
}
