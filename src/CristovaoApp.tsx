import { useEffect, useMemo, useState } from 'react';
import { evidenceVerificationFor, nodeVerificationFor, verifyJourney } from './domain/evidenceEngine';
import { applyScenario, compileJourney, readiness } from './domain/journeyCompiler';
import { applyStructuredProfile, reconcileDocument, type DocumentAnalysis, type FieldMismatch, type StructuredProfile } from './domain/reconciliation';
import { applySourceIntelligence, type SourceIntelligenceFeed } from './domain/sourceIntelligence';
import type { JourneyNode, ScenarioId } from './domain/types';
import { publishTimelineTwin } from './timelineBridge';

const DEFAULT_CASE = `I'm on H-1B. My spouse and child are dependents. My employer started an employment-based green card process, and my child will start college soon. My latest approval is valid through September 30, 2026. Help me understand what I should prepare and what information you still need.`;

const SYNTHETIC_NOTICE = `CRISTOVAO SYNTHETIC I-797 DEMO NOTICE
Receipt Number: IOE0912345678
Classification: H-1B
Petitioner: Atlas Systems Inc.
Beneficiary: Demo User
Notice Date: August 1, 2026
Valid From: October 1, 2026
Valid To: September 30, 2027
`;

const scenarios: Array<{ id: ScenarioId; label: string }> = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'employer-change', label: 'Change employer' },
  { id: 'dependent-milestone', label: 'Dependent milestone' },
  { id: 'policy-update', label: 'Official source update' },
];

const kindLabel: Record<JourneyNode['kind'], string> = {
  current: 'CURRENT', requirement: 'REQUIREMENT', document: 'DOCUMENT', action: 'ACTION', risk: 'WHAT-IF', milestone: 'MILESTONE',
};

function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

export default function CristovaoApp() {
  const [input, setInput] = useState(DEFAULT_CASE);
  const [twin, setTwin] = useState(() => compileJourney(DEFAULT_CASE));
  const [scenarioId, setScenarioId] = useState<ScenarioId>('baseline');
  const [selectedNodeId, setSelectedNodeId] = useState('current-profile');
  const [sourceFeed, setSourceFeed] = useState<SourceIntelligenceFeed | null>(null);
  const [sourceFeedError, setSourceFeedError] = useState('');
  const [profile, setProfile] = useState<StructuredProfile | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState('');
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [mismatches, setMismatches] = useState<FieldMismatch[]>([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/source-intelligence.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Source feed HTTP ${response.status}`);
        return response.json() as Promise<SourceIntelligenceFeed>;
      })
      .then((feed) => { if (active) setSourceFeed(feed); })
      .catch((error: unknown) => { if (active) setSourceFeedError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; };
  }, []);

  const rawScenario = useMemo(() => applyScenario(twin, scenarioId), [twin, scenarioId]);
  const sourceImpact = useMemo(() => applySourceIntelligence(rawScenario.twin, sourceFeed), [rawScenario.twin, sourceFeed]);
  const verificationResult = useMemo(() => verifyJourney(sourceImpact.twin), [sourceImpact.twin]);
  const changedNodeIds = useMemo(() => {
    const impacted = sourceImpact.twin.nodes.filter((node) => node.impact === 'changed').map((node) => node.id);
    return [...new Set([...rawScenario.changedNodeIds, ...sourceImpact.changedNodeIds, ...impacted])];
  }, [rawScenario.changedNodeIds, sourceImpact.changedNodeIds, sourceImpact.twin.nodes]);
  const scenario = { ...rawScenario, twin: verificationResult.twin, changedNodeIds };

  useEffect(() => {
    publishTimelineTwin(scenario.twin);
  }, [scenario.twin]);

  const verification = verificationResult.report;
  const score = useMemo(() => readiness(scenario.twin), [scenario.twin]);
  const selectedNode = scenario.twin.nodes.find((item) => item.id === selectedNodeId) ?? scenario.twin.nodes[0];
  const selectedVerification = selectedNode ? nodeVerificationFor(verification, selectedNode.id) : undefined;

  const buildJourney = async () => {
    setIntakeLoading(true);
    setIntakeError('');
    setAnalysis(null);
    setMismatches([]);
    const base = compileJourney(input);
    try {
      const response = await fetch('/api/intake/structure', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }),
      });
      if (!response.ok) throw new Error(`Structured intake HTTP ${response.status}`);
      const structured = await response.json() as StructuredProfile;
      const next = applyStructuredProfile(base, structured);
      setProfile(structured);
      setTwin(next);
      setScenarioId('baseline');
      setSelectedNodeId(next.nodes[0]?.id ?? 'current-profile');
    } catch (error) {
      setProfile(null);
      setTwin(base);
      setIntakeError(error instanceof Error ? error.message : String(error));
    } finally {
      setIntakeLoading(false);
    }
  };

  const analyzeDocument = async (payload: Record<string, unknown>) => {
    setDocumentLoading(true);
    setDocumentError('');
    try {
      const response = await fetch('/api/document/extract', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ synthetic: true, ...payload }),
      });
      const result = await response.json() as DocumentAnalysis & { message?: string; error?: string };
      if (!response.ok) throw new Error(result.message ?? result.error ?? `Document extraction HTTP ${response.status}`);
      const reconciled = reconcileDocument(twin, result);
      setAnalysis(result);
      setMismatches(reconciled.mismatches);
      setTwin(reconciled.twin);
      setScenarioId('baseline');
      setSelectedNodeId('document-readiness');
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : String(error));
    } finally {
      setDocumentLoading(false);
    }
  };

  const uploadDocument = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return setDocumentError('Keep the synthetic demo file under 8 MB.');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setDocumentError('Use a synthetic PDF, JPEG, PNG, or WebP file.');
    await analyzeDocument({ fileName: file.name, mimeType: file.type, data: await fileAsBase64(file) });
  };

  const documentFields = analysis ? [
    ['Receipt number', analysis.fields.receiptNumber], ['Classification', analysis.fields.classification],
    ['Petitioner', analysis.fields.petitioner], ['Beneficiary', analysis.fields.beneficiary],
    ['Notice date', analysis.fields.noticeDate], ['Valid from', analysis.fields.validFrom], ['Valid through', analysis.fields.validTo],
  ] as const : [];

  return (
    <main className="shell">
      <header className="topbar">
        <div><div className="brand-mark">C</div><div><strong>Cristóvão</strong><span>the Caregiver</span></div></div>
        <div className="prototype-pill">Synthetic-data prototype · Immigration & Mobility</div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">IMMIGRATION DIGITAL TWIN</p><h1>See what depends on what.</h1><p className="hero-copy">Cristóvão builds a living journey, keeps unknowns visible, and shows which nodes change when a life event, document fact, or official source changes.</p></div>
        <div className="principle-card"><span>DESIGN PRINCIPLE</span><strong>Generative where interpretation is needed.</strong><strong>Deterministic where correctness is possible.</strong></div>
      </section>

      <section className="intake panel">
        <div className="section-heading"><div><p className="eyebrow">01 · STRUCTURED INTAKE</p><h2>Tell Cristóvão what’s happening.</h2></div><span className="safe-label">Synthetic data only</span></div>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} aria-label="Synthetic scenario" />
        <div className="intake-actions"><p>Exact dates are extracted only when explicitly stated.</p><button onClick={buildJourney} disabled={intakeLoading}>{intakeLoading ? 'Structuring…' : 'Build my journey →'}</button></div>
        {profile && <div className="intake-result"><span>{profile.method}</span><span>{Math.round(profile.confidence * 100)}% confidence</span>{profile.primaryStatus && <span>Status: {profile.primaryStatus}</span>}{profile.petitionValidTo && <span>Approval through: {profile.petitionValidTo}</span>}<span>{profile.missingCriticalFacts.length} critical facts missing</span></div>}
        {intakeError && <div className="document-error">Structured API unavailable; base journey preserved. {intakeError}</div>}
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>Known facts</span><strong>{scenario.twin.facts.length}</strong><small>Provided + explicitly derived</small></article>
        <article className="stat-card warning"><span>Unknown facts</span><strong>{scenario.twin.unknowns.length}</strong><small>Visible instead of guessed</small></article>
        <article className="stat-card"><span>Affected nodes</span><strong>{scenario.changedNodeIds.length}</strong><small>{mismatches.length ? 'Document discrepancy active' : sourceImpact.changedSourceIds.length ? 'Live source change detected' : scenarioId === 'baseline' ? 'No change active' : scenario.label}</small></article>
        <article className="stat-card score"><span>Independent verifier</span><strong>{verification.verifiedNodes}/{verification.totalNodes}</strong><small>Journey readiness {score.journeyReadiness}%</small></article>
      </section>

      <section className="simulator panel">
        <div className="section-heading"><div><p className="eyebrow">02 · WHAT-IF ENGINE</p><h2>Change one fact. Recompute the journey.</h2></div></div>
        <div className="scenario-tabs">{scenarios.map((item) => <button className={item.id === scenarioId ? 'active' : ''} key={item.id} onClick={() => setScenarioId(item.id)}>{item.label}</button>)}</div>
        <p className="scenario-summary">{scenario.summary}</p>
        {scenario.questionsRaised.length > 0 && <div className="questions-raised"><strong>{scenario.questionsRaised.length} new questions before Cristóvão can conclude:</strong><ul>{scenario.questionsRaised.map((question) => <li key={question}>{question}</li>)}</ul></div>}
      </section>

      <section className="source-intelligence panel">
        <div className="section-heading"><div><p className="eyebrow">03 · SOURCE INTELLIGENCE</p><h2>Official pages become versioned inputs.</h2></div><span className="safe-label">{sourceFeed?.generatedAt ? `Observed ${new Date(sourceFeed.generatedAt).toLocaleString()}` : 'Snapshot pipeline not run yet'}</span></div>
        <p className="source-intro">Render Workflows snapshots registered sources, retains hashes and matched passages, and publishes only declared JourneyGraph impact.</p>
        {sourceFeedError && <div className="source-error">Could not load source feed: {sourceFeedError}</div>}
        <div className="source-grid">{sourceFeed?.sources.map((source) => <article key={source.id} className={source.status === 'changed' ? 'source-changed' : ''}><div className="source-card-top"><span>{source.publisher}</span><strong className={`source-status ${source.status}`}>{source.status}</strong></div><h3>{source.title}</h3><dl className="source-details"><div><dt>Version</dt><dd>{source.sourceVersion ?? 'Not observed'}</dd></div><div><dt>Hash</dt><dd>{source.contentHash ? source.contentHash.slice(0, 12) : '—'}</dd></div><div><dt>Affects</dt><dd>{source.affectedNodeIds.length} nodes</dd></div></dl>{source.status === 'changed' && <p className="source-impact-callout">Source changed → {source.affectedNodeIds.length} declared nodes require re-verification.</p>}<a href={source.url} target="_blank" rel="noreferrer">Open official source ↗</a></article>)}</div>
      </section>

      <section className="document-intelligence panel">
        <div className="section-heading"><div><p className="eyebrow">04 · DOCUMENT INTELLIGENCE</p><h2>Extract facts. Never silently overwrite them.</h2></div>{analysis && <span className="document-status">{analysis.method} · {analysis.model}</span>}</div>
        <p className="document-intro">Use the deterministic fixture for a reproducible demo. Synthetic PDF/image uploads use Gemini multimodal extraction when a Gemini API key is configured.</p>
        <div className="document-actions"><button className="secondary" onClick={() => analyzeDocument({ syntheticText: SYNTHETIC_NOTICE })} disabled={documentLoading}>{documentLoading ? 'Analyzing…' : 'Use synthetic I-797 →'}</button><label className="document-upload">Upload synthetic PDF / image<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => uploadDocument(event.target.files?.[0])} /></label></div>
        {documentError && <div className="document-error">{documentError}</div>}
        {analysis && <><div className="document-fields">{documentFields.map(([label, value]) => <div className="document-field" key={label}><span>{label}</span><strong>{value?.value ?? 'Not extracted'}</strong><small>{Math.round((value?.confidence ?? 0) * 100)}% confidence</small></div>)}</div>{mismatches.length ? <div className="discrepancy-panel"><strong>{mismatches.length} discrepancy detected — Cristóvão needs clarification</strong>{mismatches.map((mismatch) => <div className="discrepancy-item" key={mismatch.id}><b>{mismatch.field}</b><div className="discrepancy-values"><span><b>Structured profile</b>{mismatch.profileValue}</span><span><b>Document</b>{mismatch.documentValue}</span></div><p>{mismatch.explanation}</p></div>)}</div> : <div className="no-discrepancy">No direct profile/document mismatch detected.</div>}</>}
      </section>

      <section className="workspace">
        <div className="journey panel"><div className="section-heading compact"><div><p className="eyebrow">05 · JOURNEYGRAPH</p><h2>Your dependency-aware journey</h2></div><span className="verified-count">{verification.verifiedNodes}/{verification.totalNodes} independently verified</span></div><div className="graph-list">{scenario.twin.nodes.map((item, index) => <div className="graph-row" key={item.id}><div className="rail" aria-hidden="true"><span>{index + 1}</span>{index < scenario.twin.nodes.length - 1 && <i />}</div><button className={`node-card ${item.impact === 'changed' ? 'changed' : ''} ${selectedNode?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedNodeId(item.id)}><div className="node-meta"><span>{kindLabel[item.kind]}</span><span className={`evidence-state ${item.evidenceStatus}`}>{item.evidenceStatus}</span></div><h3>{item.title}</h3><p>{item.summary}</p><div className="node-footer"><span>{item.dependsOn.length} dependencies</span><span>{item.affectedPeople.join(', ')}</span><span className={`verification-chip ${item.verificationStatus}`}>{item.verificationStatus}</span>{item.impact === 'changed' && <strong>IMPACTED</strong>}</div></button></div>)}</div></div>
        <aside className="inspector panel"><p className="eyebrow">WHY IS THIS HERE?</p>{selectedNode && <><h2>{selectedNode.title}</h2><p>{selectedNode.summary}</p><dl><div><dt>Evidence state</dt><dd>{selectedNode.evidenceStatus}</dd></div><div><dt>Verifier</dt><dd>{selectedNode.verificationStatus}</dd></div><div><dt>Dependencies</dt><dd>{selectedNode.dependsOn.length || 'Root node'}</dd></div><div><dt>Impact state</dt><dd>{selectedNode.impact}</dd></div></dl>{selectedVerification && <div className="verifier-reasons"><strong>Verifier reasoning</strong>{selectedVerification.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>}</>}<div className="divider" /><p className="eyebrow">MISSING INFORMATION</p><div className="unknown-list">{scenario.twin.unknowns.map((unknown) => <div key={unknown.id}><strong>{unknown.label}</strong><span>{unknown.whyItMatters}</span></div>)}</div></aside>
      </section>

      <section className="evidence panel">
        <div className="section-heading"><div><p className="eyebrow">06 · EVIDENCE LEDGER</p><h2>Registration is not verification.</h2></div></div>
        <div className="verifier-summary"><div><span>INDEPENDENT VERIFIER</span><strong>{verification.verifiedNodes} of {verification.totalNodes} journey nodes verified</strong></div><p>Consequential source claims stay unresolved until the retained source, passage, version, and independent verification checks are present.</p></div>
        <div className="evidence-grid">{scenario.twin.evidence.map((record) => { const result = evidenceVerificationFor(verification, record.id); const passed = result?.checks.filter((check) => check.passed).length ?? 0; const total = result?.checks.length ?? 0; return <article key={record.id}><div><span className="source-type">{record.authority.replace('-', ' ').toUpperCase()}</span><span className={`verification-chip ${result?.status ?? 'unverified'}`}>{result?.status ?? 'unverified'}</span></div><h3>{record.title}</h3><p>{record.publisher}</p><div className="evidence-meta"><span><b>Claim</b>{record.claimType}</span><span><b>Match</b>{record.matchStatus}</span><span><b>Semantic</b>{record.semanticSupport}</span><span><b>Checks</b>{passed}/{total}</span></div><ul className="check-list">{result?.checks.map((check) => <li className={check.passed ? 'pass' : 'fail'} key={check.id} title={check.detail}><span>{check.passed ? '✓' : '○'}</span>{check.label}</li>)}</ul><a href={record.url} target="_blank" rel="noreferrer">Open source ↗</a></article>; })}</div>
      </section>

      <footer><strong>Cristóvão the Caregiver</strong><span>Informational navigation, not legal advice. High-impact conclusions require authoritative evidence and independent verification.</span></footer>
    </main>
  );
}