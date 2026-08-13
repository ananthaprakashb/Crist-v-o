const stepKey = 'cristovao:presenter-step';
const panelPositionKey = 'cristovao:presenter-position';
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
style.textContent = `
.cg-launch{position:fixed;left:16px;bottom:18px;z-index:100;padding:11px 16px;border:1px solid #667;border-radius:999px;background:#173a31;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.18)}
.cg-panel{position:fixed;z-index:110;width:320px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow:auto;padding:16px;border:1px solid #596660;border-radius:16px;background:#102b25;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:system-ui,sans-serif;box-sizing:border-box}
.cg-panel.cg-docked{left:12px;top:78px}
.cg-head,.cg-progress,.cg-actions{display:flex;justify-content:space-between;gap:10px;align-items:center}.cg-head{cursor:grab;user-select:none}.cg-head:active{cursor:grabbing}.cg-head div:first-child{display:grid;gap:4px;min-width:0}.cg-head-buttons{display:flex;align-items:center;gap:4px}.cg-kicker,.cg-panel small{font-size:11px;font-weight:800;letter-spacing:.08em}.cg-close,.cg-dock{border:0;background:transparent;color:#fff;cursor:pointer}.cg-close{font-size:22px}.cg-dock{font-size:11px;opacity:.78}.cg-progress{padding:12px 0}.cg-section{padding:11px 0;border-top:1px solid #43534d}.cg-section h3{margin:5px 0}.cg-section p{margin:0;line-height:1.45}.cg-actions button,.cg-reset{padding:9px 12px;border-radius:9px;border:1px solid #667;background:#1b493d;color:#fff;font-weight:700;cursor:pointer}.cg-reset{width:100%;margin-top:10px;background:transparent}.cg-note{display:block;margin-top:8px;opacity:.72}.cg-actions button:disabled{opacity:.4}
@media(min-width:1180px){body.cg-guide-docked #root{margin-left:344px;transition:margin-left .18s ease;max-width:calc(100vw - 344px)}}
@media(max-width:620px){.cg-panel.cg-docked{left:8px;top:70px;width:calc(100vw - 16px)}.cg-launch{left:10px;bottom:10px}}
`;
document.head.appendChild(style);

const rightPanels = [
  ['.source-demo-drawer', '.source-demo-close'],
  ['.checkpoint-panel', '.checkpoint-panel header > button'],
  ['.timeline-preview', '.timeline-preview-head > button'],
  ['.graph-inspector', '.graph-inspector header > button'],
];
const rightLaunchSelector = '.source-demo-launch,.checkpoint-launch,.timeline-preview-launch,.graph-inspector-launch';

function closeRightPanels() {
  for (const [panelSelector, closeSelector] of rightPanels) {
    const panel = document.querySelector(panelSelector);
    const close = panel?.querySelector(closeSelector);
    if (close instanceof HTMLElement) close.click();
  }
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest(rightLaunchSelector) : null;
  if (target) closeRightPanels();
}, true);

function readPosition() {
  try {
    const raw = sessionStorage.getItem(panelPositionKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return Number.isFinite(value?.left) && Number.isFinite(value?.top) ? value : null;
  } catch {
    return null;
  }
}

function savePosition(left, top) {
  try { sessionStorage.setItem(panelPositionKey, JSON.stringify({ left, top })); } catch { /* optional */ }
}

function render() {
  document.querySelector('.cg-launch')?.remove();
  document.querySelector('.cg-panel')?.remove();
  document.body.classList.remove('cg-guide-docked');
  const button = document.createElement('button');
  button.className = 'cg-launch';
  button.textContent = 'Judge demo';
  button.onclick = openPanel;
  document.body.appendChild(button);
}

function makeDraggable(panel) {
  const handle = panel.querySelector('.cg-head');
  if (!(handle instanceof HTMLElement)) return;

  handle.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    panel.classList.remove('cg-docked');
    document.body.classList.remove('cg-guide-docked');
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';

    const move = (moveEvent) => {
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
      const left = Math.min(maxLeft, Math.max(8, moveEvent.clientX - offsetX));
      const top = Math.min(maxTop, Math.max(8, moveEvent.clientY - offsetY));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };
    const end = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      const finalRect = panel.getBoundingClientRect();
      savePosition(finalRect.left, finalRect.top);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end, { once: true });
  });
}

function openPanel() {
  document.querySelector('.cg-launch')?.remove();
  document.querySelector('.cg-panel')?.remove();
  document.body.classList.remove('cg-guide-docked');

  const current = steps[step];
  const panel = document.createElement('aside');
  const position = readPosition();
  panel.className = `cg-panel${position ? '' : ' cg-docked'}`;
  if (position) {
    panel.style.left = `${Math.max(8, Math.min(position.left, window.innerWidth - 328))}px`;
    panel.style.top = `${Math.max(8, Math.min(position.top, window.innerHeight - 120))}px`;
  } else {
    document.body.classList.add('cg-guide-docked');
  }

  panel.innerHTML = `<div class="cg-head"><div><span class="cg-kicker">JUDGE MODE · 2–3 MINUTES</span><strong>Guided walkthrough</strong></div><div class="cg-head-buttons"><button class="cg-dock" title="Dock guide on the left">Dock</button><button class="cg-close" title="Close guide">×</button></div></div><div class="cg-progress"><span>Step ${step + 1} of ${steps.length}</span><b>${current[3]}</b></div><div class="cg-section"><small>PRESENTER CUE</small><h3>${current[0]}</h3><p>${current[1]}</p></div><div class="cg-section"><small>EXPECTED RESULT</small><p>${current[2]}</p></div><div class="cg-actions"><button class="cg-prev" ${step === 0 ? 'disabled' : ''}>← Previous</button><button class="cg-next">${step === steps.length - 1 ? 'Restart guide' : 'Next →'}</button></div><button class="cg-reset">Reset demo state</button><small class="cg-note">Drag the header to move this guide. Reset clears the synthetic source-change browser flag; saved server checkpoints stay intact.</small>`;

  panel.querySelector('.cg-close').onclick = render;
  panel.querySelector('.cg-dock').onclick = () => { sessionStorage.removeItem(panelPositionKey); openPanel(); };
  panel.querySelector('.cg-prev').onclick = () => { step = Math.max(0, step - 1); sessionStorage.setItem(stepKey, String(step)); openPanel(); };
  panel.querySelector('.cg-next').onclick = () => { step = step === steps.length - 1 ? 0 : step + 1; sessionStorage.setItem(stepKey, String(step)); openPanel(); };
  panel.querySelector('.cg-reset').onclick = () => { localStorage.removeItem(sourceFlag); sessionStorage.setItem(stepKey, '0'); sessionStorage.removeItem(panelPositionKey); location.reload(); };
  document.body.appendChild(panel);
  makeDraggable(panel);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
