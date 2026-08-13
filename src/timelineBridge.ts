import type { DigitalTwin } from './domain/types';

const EVENT_NAME = 'cristovao:timeline-state';
let latestTwin: DigitalTwin | null = null;

export function publishTimelineTwin(twin: DigitalTwin) {
  latestTwin = structuredClone(twin);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<DigitalTwin>(EVENT_NAME, { detail: structuredClone(twin) }));
  }
}

export function readTimelineTwin() {
  return latestTwin ? structuredClone(latestTwin) : null;
}

export function subscribeTimelineTwin(listener: (twin: DigitalTwin) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<DigitalTwin>).detail;
    if (detail) listener(structuredClone(detail));
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
