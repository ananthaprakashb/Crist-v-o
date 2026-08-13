import { useEffect, useMemo, useState } from 'react';
import { buildJourneyTimeline, timelineInputFromTwin } from './domain/journeyTimeline';
import type { DigitalTwin } from './domain/types';
import { readTimelineTwin, subscribeTimelineTwin } from './timelineBridge';
import './timelinePreview.css';

export default function TimelinePreview() {
  const [open, setOpen] = useState(false);
  const [twin, setTwin] = useState<DigitalTwin | null>(() => readTimelineTwin());

  useEffect(() => subscribeTimelineTwin(setTwin), []);

  const timeline = useMemo(
    () => twin ? buildJourneyTimeline(timelineInputFromTwin(twin)) : [],
    [twin],
  );

  if (!open) return <button className="timeline-preview-launch" onClick={() => setOpen(true)}>Timeline preview</button>;

  return (
    <aside className="timeline-preview" aria-label="Timeline preview">
      <div className="timeline-preview-head">
        <div><span>TIMELINE · CURRENT DIGITAL TWIN</span><strong>Known dates stay exact. Unknown dates stay unscheduled.</strong></div>
        <button onClick={() => setOpen(false)}>×</button>
      </div>
      {!twin ? (
        <div className="timeline-preview-empty">Waiting for the current journey state…</div>
      ) : timeline.length ? (
        <div className="timeline-preview-list">
          {timeline.map((item) => (
            <article key={item.id} data-source={item.source}>
              <div><span>{item.dateKind === 'today' ? 'REVIEW NOW' : item.date ?? 'UNSCHEDULED'}</span><b>{item.urgency.toUpperCase()}</b></div>
              <strong>{item.title}</strong>
              <p>{item.explanation}</p>
              <small>{item.relatedNodeIds.length} related graph node{item.relatedNodeIds.length === 1 ? '' : 's'}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="timeline-preview-empty">No exact or missing date anchors are present in the current journey.</div>
      )}
      <small>Live chronology from the current Digital Twin. No estimated dates are added.</small>
    </aside>
  );
}
