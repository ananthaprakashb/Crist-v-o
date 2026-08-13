import { useEffect, useState } from 'react';
import { setSourceImpactDemoActive } from './sourceDemoState';
import './judgeMode.css';

const STEP_KEY = 'cristovao:judge-demo-step';

const steps = [
  {
    title: 'Build the current state',
    cue: 'Click “Build my journey”.',
    expected: 'Structured intake appears and keeps unresolved facts explicit.',
    time: '0:20',
  },
  {
    title: 'Save a baseline checkpoint',
    cue: 'Open Journey memory and click “Save checkpoint”.',
    expected: 'Checkpoint storage is confirmed; semantic memory shows submitted when configured.',
    time: '0:15',
  },
  {
    title: 'Analyze the synthetic document',
    cue: 'Click “Use synthetic I-797”.',
    expected: 'A profile/document date mismatch is detected and both values remain visible.',
    time: '0:30',
  },
  {
    title: 'Show the timeline reaction',
    cue: 'Open Timeline preview.',
    expected: 'The mismatch is first, both exact dates are preserved, and missing dates remain unscheduled.',
    time: '0:20',
  },
  {
    title: 'Explain the graph',
    cue: 'Open Explain graph and inspect an affected node.',
    expected: 'Dependency path, evidence lineage, and current verification state are visible.',
    time: '0:20',
  },
  {
    title: 'Simulate a source change',
    cue: 'Open Source change demo and simulate the change.',
    expected: 'Only declared dependent nodes move to review; the source meaning remains pending verification.',
    time: '0:25',
  },
  {
    title: 'Compare against the checkpoint',
    cue: 'Open Journey memory and click “What changed?”.',
    expected: 'A deterministic structural delta is shown across facts, unknowns, graph nodes, and evidence.',
    time: '0:20',
  },
];

function readStep() {
  if (typeof window === 'undefined') return 0;
  const raw = window.sessionStorage.getItem(STEP_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isInteger(value) && value >= 0 && value < steps.length ? value : 0;
}

export default function JudgeModePanel() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(readStep);

  useEffect(() => {
    try { window.sessionStorage.setItem(STEP_KEY, String(step)); } catch { /* optional */ }
  }, [step]);

  const resetDemo = () => {
    setSourceImpactDemoActive(false);
    try {
      window.sessionStorage.setItem(STEP_KEY, '0');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch { /* optional */ }
    window.location.reload();
  };

  const current = steps[step];

  if (!open) {
    return <button className="judge-mode-launch" onClick={() => setOpen(true)}>Judge demo</button>;
  }

  return (
    <aside className="judge-mode-panel" aria-label="Judge demo guide">
      <header>
        <div><span>JUDGE MODE · 2–3 MINUTES</span><strong>One controlled path through the strongest product moments.</strong></div>
        <button onClick={() => setOpen(false)}>×</button>
      </header>

      <div className="judge-mode-progress">
        <span>Step {step + 1} of {steps.length}</span>
        <b>{current.time}</b>
      </div>

      <section>
        <small>PRESENTER CUE</small>
        <h3>{current.title}</h3>
        <p>{current.cue}</p>
      </section>

      <section>
        <small>EXPECTED RESULT</small>
        <p>{current.expected}</p>
      </section>

      <div className="judge-mode-actions">
        <button onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>← Previous</button>
        {step < steps.length - 1
          ? <button onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Next →</button>
          : <button onClick={() => setStep(0)}>Restart guide</button>}
      </div>

      <button className="judge-mode-reset" onClick={resetDemo}>Reset demo state</button>
      <small className="judge-mode-note">Reset clears the synthetic source-change browser flag and reloads the default synthetic case. Saved server checkpoints are intentionally retained.</small>
    </aside>
  );
}
