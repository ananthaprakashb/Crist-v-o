import { useMemo, useState } from 'react';
import { applyScenario, compileJourney, readiness } from './domain/journeyCompiler';
import type { JourneyNode, ScenarioId } from './domain/types';

const DEFAULT_CASE = `I'm on H-1B. My spouse and child are dependents. My employer started an employment-based green card process, and my child will start college soon. Help me understand what I should prepare and what information you still need.`;

const scenarios: Array<{ id: ScenarioId; label: string }> = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'employer-change', label: 'Change employer' },
  { id: 'dependent-milestone', label: 'Dependent milestone' },
  { id: 'policy-update', label: 'Official source update' },
];

const kindLabel: Record<JourneyNode['kind'], string> = {
  current: 'CURRENT',
  requirement: 'REQUIREMENT',
  document: 'DOCUMENT',
  action: 'ACTION',
  risk: 'WHAT-IF',
  milestone: 'MILESTONE',
};

export default function App() {
  const [input, setInput] = useState(DEFAULT_CASE);
  const [twin, setTwin] = useState(() => compileJourney(DEFAULT_CASE));
  const [scenarioId, setScenarioId] = useState<ScenarioId>('baseline');
  const [selectedNodeId, setSelectedNodeId] = useState('current-profile');

  const scenario = useMemo(() => applyScenario(twin, scenarioId), [twin, scenarioId]);
  const score = useMemo(() => readiness(scenario.twin), [scenario.twin]);
  const selectedNode = scenario.twin.nodes.find((node) => node.id === selectedNodeId) ?? scenario.twin.nodes[0];

  const buildJourney = () => {
    const nextTwin = compileJourney(input);
    setTwin(nextTwin);
    setScenarioId('baseline');
    setSelectedNodeId(nextTwin.nodes[0]?.id ?? 'current-profile');
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">C</div>
          <div>
            <strong>Cristóvão</strong>
            <span>the Caregiver</span>
          </div>
        </div>
        <div className="prototype-pill">Synthetic-data prototype · Immigration & Mobility</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">IMMIGRATION DIGITAL TWIN</p>
          <h1>See what depends on what.</h1>
          <p className="hero-copy">
            Most immigration AI answers a question. Cristóvão builds a living journey, makes unknowns visible,
            and shows which nodes change when a life event or official source changes.
          </p>
        </div>
        <div className="principle-card">
          <span>DESIGN PRINCIPLE</span>
          <strong>Generative where interpretation is needed.</strong>
          <strong>Deterministic where correctness is possible.</strong>
        </div>
      </section>

      <section className="intake panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 · INTAKE</p>
            <h2>Tell Cristóvão what’s happening.</h2>
          </div>
          <span className="safe-label">Use synthetic data for the hackathon demo</span>
        </div>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} aria-label="Synthetic immigration scenario" />
        <div className="intake-actions">
          <p>Critical dates are never inferred from approximate language.</p>
          <button onClick={buildJourney}>Build my journey →</button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Known facts</span>
          <strong>{scenario.twin.facts.length}</strong>
          <small>Provided + explicitly derived</small>
        </article>
        <article className="stat-card warning">
          <span>Unknown facts</span>
          <strong>{scenario.twin.unknowns.length}</strong>
          <small>Visible instead of guessed</small>
        </article>
        <article className="stat-card">
          <span>Affected nodes</span>
          <strong>{scenario.changedNodeIds.length}</strong>
          <small>{scenarioId === 'baseline' ? 'No simulation active' : scenario.label}</small>
        </article>
        <article className="stat-card score">
          <span>Journey readiness</span>
          <strong>{score.journeyReadiness}%</strong>
          <small>Deterministic demo score</small>
        </article>
      </section>

      <section className="simulator panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 · WHAT-IF ENGINE</p>
            <h2>Change one fact. Recompute the journey.</h2>
          </div>
        </div>
        <div className="scenario-tabs">
          {scenarios.map((item) => (
            <button
              className={item.id === scenarioId ? 'active' : ''}
              key={item.id}
              onClick={() => setScenarioId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="scenario-summary">{scenario.summary}</p>
        {scenario.questionsRaised.length > 0 && (
          <div className="questions-raised">
            <strong>{scenario.questionsRaised.length} new questions before Cristóvão can conclude:</strong>
            <ul>
              {scenario.questionsRaised.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="workspace">
        <div className="journey panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">03 · JOURNEYGRAPH</p>
              <h2>Your dependency-aware journey</h2>
            </div>
            <span className="verified-count">{scenario.twin.nodes.filter((node) => node.evidenceStatus === 'supported').length}/{scenario.twin.nodes.length} supported</span>
          </div>

          <div className="graph-list">
            {scenario.twin.nodes.map((node, index) => (
              <div className="graph-row" key={node.id}>
                <div className="rail" aria-hidden="true">
                  <span>{index + 1}</span>
                  {index < scenario.twin.nodes.length - 1 && <i />}
                </div>
                <button
                  className={`node-card ${node.impact === 'changed' ? 'changed' : ''} ${selectedNode?.id === node.id ? 'selected' : ''}`}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <div className="node-meta">
                    <span>{kindLabel[node.kind]}</span>
                    <span className={`evidence-state ${node.evidenceStatus}`}>{node.evidenceStatus}</span>
                  </div>
                  <h3>{node.title}</h3>
                  <p>{node.summary}</p>
                  <div className="node-footer">
                    <span>{node.dependsOn.length} dependencies</span>
                    <span>{node.affectedPeople.join(', ')}</span>
                    {node.impact === 'changed' && <strong>IMPACTED</strong>}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="inspector panel">
          <p className="eyebrow">WHY IS THIS HERE?</p>
          {selectedNode && (
            <>
              <h2>{selectedNode.title}</h2>
              <p>{selectedNode.summary}</p>
              <dl>
                <div><dt>Evidence</dt><dd>{selectedNode.evidenceStatus}</dd></div>
                <div><dt>Dependencies</dt><dd>{selectedNode.dependsOn.length || 'Root node'}</dd></div>
                <div><dt>AI inference</dt><dd>{selectedNode.kind === 'current' ? 'No' : 'Not verified yet'}</dd></div>
                <div><dt>Impact state</dt><dd>{selectedNode.impact}</dd></div>
              </dl>
            </>
          )}

          <div className="divider" />
          <p className="eyebrow">MISSING INFORMATION</p>
          <div className="unknown-list">
            {scenario.twin.unknowns.map((unknown) => (
              <div key={unknown.id}>
                <strong>{unknown.label}</strong>
                <span>{unknown.whyItMatters}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="evidence panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">04 · EVIDENCE LEDGER</p>
            <h2>Facts, rules, inferences, and unknowns stay separate.</h2>
          </div>
        </div>
        <div className="evidence-grid">
          {scenario.twin.evidence.map((record) => (
            <article key={record.id}>
              <div>
                <span className="source-type">OFFICIAL SOURCE</span>
                <span className="pending">{record.status}</span>
              </div>
              <h3>{record.title}</h3>
              <p>{record.publisher}</p>
              <a href={record.url} target="_blank" rel="noreferrer">Open source ↗</a>
            </article>
          ))}
        </div>
        <p className="evidence-note">
          Day 1 intentionally marks these records as <strong>pending-match</strong>. A later evidence service must match a current passage and source version before a consequential node is treated as verified.
        </p>
      </section>

      <footer>
        <strong>Cristóvão the Caregiver</strong>
        <span>Informational navigation, not legal advice. High-impact conclusions require authoritative evidence and verification.</span>
      </footer>
    </main>
  );
}
