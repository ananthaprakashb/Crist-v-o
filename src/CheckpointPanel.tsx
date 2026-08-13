import { useEffect, useMemo, useState } from 'react';
import type { DigitalTwin } from './domain/types';
import { readTimelineTwin, subscribeTimelineTwin } from './timelineBridge';
import './checkpointPanel.css';

type Delta = { added: string[]; removed: string[]; changed: string[] };
type Comparison = Record<string, Delta>;

function getContainerId() {
  if (typeof window === 'undefined') return 'demo_checkpoint_0001';
  const key = 'cristovao:checkpoint-container';
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const next = `demo_${crypto.randomUUID().replace(/-/g, '_')}`;
  window.localStorage.setItem(key, next);
  return next;
}

function countChanges(value: Comparison | null) {
  if (!value) return 0;
  return Object.values(value).reduce((sum, delta) => sum + delta.added.length + delta.removed.length + delta.changed.length, 0);
}

export default function CheckpointPanel() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DigitalTwin | null>(() => readTimelineTwin());
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [storage, setStorage] = useState('');
  const [semantic, setSemantic] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useMemo(getContainerId, []);

  useEffect(() => subscribeTimelineTwin(setSnapshot), []);

  async function call(path: string) {
    if (!snapshot) return null;
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ containerId: id, snapshot }),
    });
    const result = await response.json() as Record<string, any>;
    if (!response.ok) throw new Error(String(result.error ?? `HTTP ${response.status}`));
    return result;
  }

  async function save() {
    setBusy(true);
    setStatus('');
    try {
      const result = await call('/api/memory/checkpoint');
      if (!result) return;
      setSavedAt(String(result.savedAt ?? ''));
      setStorage(String(result.persistence ?? ''));
      setSemantic(String(result.semantic?.status ?? ''));
      setComparison(null);
      setStatus('Checkpoint saved. Modify the current state, then compare.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    setBusy(true);
    setStatus('');
    try {
      const result = await call('/api/memory/compare');
      if (!result) return;
      setSavedAt(String(result.savedAt ?? savedAt));
      setComparison((result.comparison ?? null) as Comparison | null);
      setStatus('Comparison completed from the saved checkpoint.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button className="checkpoint-launch" onClick={() => setOpen(true)}>Journey memory</button>;

  return <aside className="checkpoint-panel">
    <header><div><span>JOURNEY MEMORY</span><strong>Save state. See exactly what changed.</strong></div><button onClick={() => setOpen(false)}>×</button></header>
    <p>A saved checkpoint is used for deterministic comparison. Semantic history is stored separately when configured.</p>
    <div className="checkpoint-actions"><button disabled={!snapshot || busy} onClick={save}>{busy ? 'Working…' : 'Save checkpoint'}</button><button disabled={!snapshot || busy} onClick={compare}>What changed?</button></div>
    {(savedAt || storage || semantic) && <div className="checkpoint-meta">{savedAt && <span><b>Saved</b>{new Date(savedAt).toLocaleString()}</span>}{storage && <span><b>Storage</b>{storage}</span>}{semantic && <span><b>Semantic memory</b>{semantic}</span>}</div>}
    {comparison && <div className="checkpoint-results"><div className="checkpoint-total"><span>STRUCTURAL CHANGES</span><strong>{countChanges(comparison)}</strong></div>{Object.entries(comparison).map(([name, delta]) => <section key={name}><h3>{name}</h3>{delta.added.length > 0 && <div><b>Added</b><span>{delta.added.join(', ')}</span></div>}{delta.removed.length > 0 && <div><b>Removed</b><span>{delta.removed.join(', ')}</span></div>}{delta.changed.length > 0 && <div><b>Changed</b><span>{delta.changed.join(', ')}</span></div>}{!delta.added.length && !delta.removed.length && !delta.changed.length && <small>No changes</small>}</section>)}</div>}
    {status && <small className="checkpoint-status">{status}</small>}
  </aside>;
}
