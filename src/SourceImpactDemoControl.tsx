import { useEffect, useMemo, useState } from 'react';
import { createSyntheticSourceChange } from './domain/policyImpact';
import type { SourceFeedRecord, SourceIntelligenceFeed } from './domain/sourceIntelligence';
import { isSourceImpactDemoActive, setSourceImpactDemoActive } from './sourceDemoState';
import './sourceImpactDemo.css';

const shortHash = (value?: string) => value ? value.slice(0, 18) : 'not retained';

export default function SourceImpactDemoControl() {
  const [active] = useState(() => isSourceImpactDemoActive());
  const [feed, setFeed] = useState<SourceIntelligenceFeed | null>(null);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(active);

  useEffect(() => {
    let mounted = true;
    fetch('/source-intelligence.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SourceIntelligenceFeed>;
      })
      .then((result) => { if (mounted) setFeed(result); })
      .catch((error: unknown) => { if (mounted) setLoadError(error instanceof Error ? error.message : String(error)); });
    return () => { mounted = false; };
  }, []);

  const displayFeed = useMemo(() => active ? createSyntheticSourceChange(feed) : feed, [active, feed]);
  const changedSource = useMemo<SourceFeedRecord | undefined>(
    () => displayFeed?.sources.find((source) => source.status === 'changed'),
    [displayFeed],
  );
  const liveChange = !active && Boolean(changedSource);

  const activate = () => {
    setSourceImpactDemoActive(true);
    window.location.reload();
  };

  const reset = () => {
    setSourceImpactDemoActive(false);
    window.location.reload();
  };

  if (!open && !liveChange) {
    return <button className="source-demo-launch" onClick={() => setOpen(true)}>Source change demo</button>;
  }

  return (
    <aside className="source-demo-drawer" aria-label="Source change impact demo">
      <div className="source-demo-header">
        <div>
          <span className={active ? 'source-demo-mode synthetic' : 'source-demo-mode live'}>
            {active ? 'SYNTHETIC CHANGE DEMO' : liveChange ? 'LIVE SOURCE CHANGE' : 'SOURCE CHANGE DEMO'}
          </span>
          <strong>Change one source. Watch the graph react.</strong>
        </div>
        {!active && !liveChange && <button className="source-demo-close" onClick={() => setOpen(false)}>×</button>}
      </div>

      {!active && !liveChange ? (
        <div className="source-demo-empty">
          <p>
            Inject a clearly labeled synthetic snapshot delta into the same source-impact function used by the live feed.
            The graph recomputes and invalidates only declared dependent nodes.
          </p>
          <button onClick={activate}>Simulate source change →</button>
          {loadError && <small>Live feed preview unavailable: {loadError}</small>}
        </div>
      ) : changedSource ? (
        <>
          <div className="source-demo-source">
            <span>{changedSource.publisher}</span>
            <strong>{changedSource.title}</strong>
            <small>{active ? 'Synthetic comparison only — persisted source data is not modified.' : 'Observed by the live source feed.'}</small>
          </div>

          <div className="source-demo-flow">
            <div><span>PRIOR SNAPSHOT</span><strong>{shortHash(changedSource.previousHash)}</strong></div>
            <b>→</b>
            <div><span>CURRENT SNAPSHOT</span><strong>{shortHash(changedSource.contentHash)}</strong></div>
            <b>→</b>
            <div><span>INTERPRETATION</span><strong>{active || changedSource.semanticSupport !== 'supported' ? 'Pending verifier' : 'Current'}</strong></div>
          </div>

          <div className="source-demo-trust">
            <div><span>DETECTED</span><strong>The retained source snapshot changed.</strong></div>
            <div><span>NOT ASSUMED</span><strong>The meaning of the change remains unresolved until verification completes.</strong></div>
          </div>

          <div className="source-demo-nodes">
            <div className="source-demo-section-title"><strong>Affected graph nodes</strong><span>{changedSource.affectedNodeIds.length}</span></div>
            {changedSource.affectedNodeIds.map((nodeId) => (
              <div key={nodeId}><span>{nodeId}</span><b>REVIEW</b></div>
            ))}
          </div>

          {(changedSource.matchedClaims?.length ?? 0) > 0 && (
            <div className="source-demo-claims">
              <div className="source-demo-section-title"><strong>Retained claims</strong><span>re-check required</span></div>
              {changedSource.matchedClaims?.slice(0, 3).map((claim) => (
                <div key={claim.claimId}><span>{claim.label}</span><b>{claim.value ?? 'passage retained'}</b></div>
              ))}
            </div>
          )}

          {active && <button className="source-demo-reset" onClick={reset}>Return to live source feed</button>}
          <small className="source-demo-hint">Scroll to the graph to see the impacted nodes highlighted by the same source-impact engine.</small>
        </>
      ) : (
        <div className="source-demo-empty">
          <p>No changed source is available yet.</p>
          {active ? <button onClick={reset}>Return to live source feed</button> : <button onClick={activate}>Simulate source change →</button>}
        </div>
      )}
    </aside>
  );
}
