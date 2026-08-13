const stepKey = 'cristovao:presenter-step';
const sourceFlag = 'cristovao:synthetic-source-change';
const steps = [
  ['Build the current state', 'Click “Build my journey”.', 'Structured intake appears and unresolved facts stay explicit.', '0:20'],
  ['Save a baseline checkpoint', 'Open Journey memory and click “Save checkpoint”.', 'Checkpoint storage is confirmed; semantic memory shows submitted when configured.', '0:15'],
  ['Analyze the synthetic document', 'Click “Use synthetic I-797”.', 'The profile/document date mismatch appears and both values remain visible.', '0:30'],
  ['Show the timeline reaction', 'Open Timeline preview.', 'The mismatch leads; exact dates remain separate and missing dates stay unscheduled.', '0:20'],
  ['Explain the graph', 'Open Explain graph and inspect an affected node.', 'Dependency path, evidence lineage, and current node state are visible.', '0:20'],
  ['Simulate a source change', 'Open Source change demo and simulate the change.', 'Only declared dependent nodes move to review; interpretation remains pending verification.', '0:25'],
  ['Compare against the checkpoint', 'Open Journey memory and click “What changed?”.', 'A deterministic structural delta appears across the stored collections.', '0:20'],
];

let step = Number(sessionStorage.getItem(stepKey) || 0);
if (!Number.isInteger(step) || step < 0 || step >= steps.length) step = 0;

const style = document.createElement('style');
style.textContent = `.cg-launch{position:fixed;left:20px;bottom:20px;z-index:100;padding:11px 16px;border:1px solid #667;border-radius:999px;background:#173a31;color:#fff;font-weight:800;cursor:pointer}.cg-panel{position:fixed;left:20px;bottom:20px;z-index:110;width:370px;max-width:calc(100vw - 40px);padding:18px;border:1px solid #596660;border-radius:16px;background:#102b25;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.35);font-family:system-ui,sans-serif}.cg-head,.cg-progress,.cg-actions{display:flex;justify-content:space-between;gap:10px;align-items:center}.cg-head div{display:grid;gap:4px}.cg-kicker,.cg-panel small{font-size:11px;font-weight:800;letter-spacing:.08em}.cg-close{border:0;background:transparent;color:#fff;font-size:22px}.cg-progress{padding:12px 0}.cg-section{padding:12px 0;border-top:1px solid #43534d}.cg-section h3{margin:5px 0}.cg-section p{margin:0;line-height:1.45}.cg-actions button,.cg-reset{padding:9px 12px;border-radius:9px;border:1px solid #667;background:#1b493d;color:#fff;font-weight:700;cursor:pointer}.cg-reset{width:100%;margin-top:10px;background:transparent}.cg-note{display:block;margin-top:8px;opacity:.72}.cg-actions button:disabled{opacity:.4}`;
document.head.appendChild(style);

function render() {
  document.querySelector('.cg-launch')?.remove();
  document.querySelector('.cg-panel')?.remove();
  const button = document.createElement('button');
  button.className = 'cg-launch';
  button.textContent = 'Judge demo';
  button.onclick = openPanel;
  document.body.appendChild(button);
}

function openPanel() {
  document.querySelector('.cg-launch')?.remove();
  const current = steps[step];
  const panel = document.createElement('aside');
  panel.className = 'cg-panel';
  panel.innerHTML = `<div class="cg-head"><div><span class="cg-kicker">JUDGE MODE · 2–3 MINUTES</span><strong>One controlled path through the strongest product moments.</strong></div><button class="cg-close">×</button></div><div class="cg-progress"><span>Step ${step + 1} of ${steps.length}</span><b>${current[3]}</b></div><div class="cg-section"><small>PRESENTER CUE</small><h3>${current[0]}</h3><p>${current[1]}</p></div><div class="cg-section"><small>EXPECTED RESULT</small><p>${current[2]}</p></div><div class="cg-actions"><button class="cg-prev" ${step === 0 ? 'disabled' : ''}>← Previous</button><button class="cg-next">${step === steps.length - 1 ? 'Restart guide' : 'Next →'}</button></div><button class="cg-reset">Reset demo state</button><small class="cg-note">Reset clears the synthetic source-change browser flag and reloads the default synthetic case. Saved server checkpoints are retained.</small>`;
  panel.querySelector('.cg-close').onclick = render;
  panel.querySelector('.cg-prev').onclick = () => { step = Math.max(0, step - 1); sessionStorage.setItem(stepKey, String(step)); openPanel(); };
  panel.querySelector('.cg-next').onclick = () => { step = step === steps.length - 1 ? 0 : step + 1; sessionStorage.setItem(stepKey, String(step)); openPanel(); };
  panel.querySelector('.cg-reset').onclick = () => { localStorage.removeItem(sourceFlag); sessionStorage.setItem(stepKey, '0'); location.reload(); };
  document.body.appendChild(panel);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
