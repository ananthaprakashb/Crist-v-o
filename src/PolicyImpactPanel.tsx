import type { DigitalTwin } from './domain/types';
import type { SourceIntelligenceFeed } from './domain/sourceIntelligence';
import {
  buildPolicyImpacts,
  createSyntheticSourceChange,
  type PolicyImpactMode,
} from './domain/policyImpact';
import './policyImpact.css';

interface PolicyImpactPanelProps {
  twin: DigitalTwin;
  liveFeed: SourceIntelligenceFeed | null;
  activeFeed: SourceIntelligenceFeed | null;
  mode: PolicyImpactMode;
  onSimulate: (feed: SourceIntelligenceFeed) => void;
  onReset: () => void;
}

const shortHash = (value?: string) => value ? value.slice(0, 18) : 'not retained';

export default function PolicyImpactPanel({
  twin,
  liveFeed,
  activeFeed,
  mode,
  onSimulate,
  onReset,
}: PolicyImpactPanelProps) {
  const impacts = buildPolicyImpacts(twin, activeFeed, mode);

  return (
    <section className="policy-impact panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03B · CHANGE IMPACT</p>
          <h2>See exactly what a source change invalidates.</h2>
        </div>
        <div className="policy-impact-actions">
          <button className="secondary" onClick={() => onSimulate(createSyntheticSourceChange(liveFeed))}>
            Simulate source change →
          </button>
          {mode === 'synthetic-demo' && <button className="policy-reset" onClick={onReset}>Return to live feed</button>}
        </div>
      </div>

      <p className="policy-impact-intro">
        A changed snapshot is treated as a new input, not an automatic conclusion. Cristóvão invalidates every declared dependent node,
        preserves the new version, and requires the current evidence bundle to pass verification again.
      </p>

      {impacts.length === 0 ? (
        <div className="policy-empty">
          <strong>No source change is active.</strong>
          <span>Use the synthetic simulator for a reproducible demo, or let a live Workflow change activate this view.</span>
        </div>
      ) : impacts.map((impact) => (
        <article className="policy-impact-card" key={impact.sourceId}>
          <div className="policy-impact-topline">
            <span className={impact.mode === 'synthetic-demo' ? 'policy-mode synthetic' : 'policy-mode live'}>
              {impact.mode === 'synthetic-demo' ? 'SYNTHETIC CHANGE' : 'LIVE CHANGE'}
            </span>
            <span className={impact.reviewRequired ? 'policy-review required' : 'policy-review current'}>
              {impact.reviewRequired ? 'RE-VERIFICATION REQUIRED' : 'CURRENTLY VERIFIED'}
            </span>
          </div>

          <div className="policy-impact-title">
            <div><span>{impact.publisher}</span><h3>{impact.title}</h3></div>
            <a href={impact.url} target="_blank" rel="noreferrer">Open source ↗</a>
          </div>

          <div className="policy-snapshot-flow">
            <div><span>PRIOR SNAPSHOT</span><strong>{shortHash(impact.previousHash)}</strong></div>
            <b>→</b>
            <div><span>CURRENT SNAPSHOT</span><strong>{shortHash(impact.currentHash)}</strong></div>
            <b>→</b>
            <div><span>INTERPRETATION</span><strong>{impact.interpretationStatus === 'verified-current' ? 'Current' : 'Pending verifier'}</strong></div>
          </div>

          <div className="policy-trust-grid">
            <div className="policy-knows">
              <span>WHAT CRISTÓVÃO KNOWS</span>
              <strong>The retained source snapshot changed.</strong>
              <p>{impact.affectedNodes.length} declared JourneyGraph nodes consume or depend on this source and must be reviewed.</p>
            </div>
            <div className="policy-does-not-claim">
              <span>WHAT REMAINS UNRESOLVED</span>
              <strong>The meaning of the change is not assumed.</strong>
              <p>The system waits for passage matching and independent verification before treating the new interpretation as current.</p>
            </div>
          </div>

          <div className="policy-node-list">
            <div className="policy-subheading"><strong>Affected JourneyGraph nodes</strong><span>{impact.affectedNodes.length} invalidated</span></div>
            {impact.affectedNodes.map((node) => (
              <div className="policy-node" key={node.id}>
                <div><strong>{node.title}</strong><span>{node.relation === 'direct-evidence' ? 'Direct evidence consumer' : 'Declared downstream dependency'}</span></div>
                <span className={`verification-chip ${node.verificationStatus}`}>{node.verificationStatus}</span>
              </div>
            ))}
          </div>

          {impact.claims.length > 0 && (
            <div className="policy-claim-list">
              <div className="policy-subheading"><strong>Retained claims</strong><span>Verifier state after change</span></div>
              {impact.claims.map((claim) => (
                <div className="policy-claim" key={claim.claimId}>
                  <div><strong>{claim.label}</strong>{claim.value && <span>{claim.value}</span>}</div>
                  <span>{claim.verdict}{claim.confidence ? ` · ${claim.confidence}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {(impact.changeSummary.added.length > 0 || impact.changeSummary.removed.length > 0) && (
            <div className="policy-change-summary">
              {impact.changeSummary.added.map((item) => <span key={`add-${item}`}>+ {item}</span>)}
              {impact.changeSummary.removed.map((item) => <span key={`remove-${item}`}>− {item}</span>)}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
