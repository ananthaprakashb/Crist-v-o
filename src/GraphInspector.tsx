import { useEffect, useMemo, useState } from 'react';
import type { DigitalTwin } from './domain/types';
import { readTimelineTwin, subscribeTimelineTwin } from './timelineBridge';
import { collectTraceIds } from './traceGraph';

export default function GraphInspector() {
  const [open, setOpen] = useState(false);
  const [twin, setTwin] = useState<DigitalTwin | null>(() => readTimelineTwin());
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => subscribeTimelineTwin((next) => {
    setTwin(next);
    setSelectedId((current) => current && next.nodes.some((node) => node.id === current) ? current : next.nodes[0]?.id ?? '');
  }), []);

  const selected = twin?.nodes.find((node) => node.id === selectedId) ?? twin?.nodes[0];
  const dependencyIds = useMemo(() => twin && selected ? collectTraceIds(twin.nodes, selected.id) : [], [twin, selected]);
  const dependencies = dependencyIds.map((id) => twin?.nodes.find((node) => node.id === id)).filter(Boolean);
  const relatedIds = new Set([...dependencyIds, selected?.id].filter(Boolean) as string[]);
  const evidence = twin?.evidence.filter((record) => record.supports.some((id) => relatedIds.has(id)) || selected?.evidenceIds.includes(record.id)) ?? [];

  if (!open) return <button className="graph-inspector-launch" onClick={() => setOpen(true)}>Explain graph</button>;

  return (
    <aside className="graph-inspector">
      <header><div><span>GRAPH TRACE</span><strong>Inspect dependencies and evidence.</strong></div><button onClick={() => setOpen(false)}>×</button></header>
      {!twin || !selected ? <p>Waiting for graph state…</p> : <>
        <label>Node<select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{twin.nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
        <section><h3>Dependency path</h3>{dependencies.length ? dependencies.map((node) => node && <div key={node.id}><strong>{node.title}</strong><span>{node.verificationStatus}</span></div>) : <p>No upstream dependency.</p>}<div><strong>{selected.title}</strong><span>{selected.verificationStatus}</span></div></section>
        <section><h3>Evidence lineage</h3>{evidence.length ? evidence.map((record) => <div key={record.id}><strong>{record.title}</strong><span>{record.matchStatus} · {record.semanticSupport}</span><a href={record.url} target="_blank" rel="noreferrer">Source ↗</a></div>) : <p>No linked evidence yet.</p>}</section>
        <section><h3>Current state</h3><div><strong>{selected.verificationStatus}</strong><span>{selected.impact}</span></div></section>
      </>}
    </aside>
  );
}
