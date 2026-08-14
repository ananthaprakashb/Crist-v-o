import { seedReferenceStateIfNeeded } from './seedState.js';

const nativeFetch = globalThis.fetch.bind(globalThis);

function officialSourceHeaders(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  try {
    const url = new URL(input);
    if (url.hostname === 'travel.state.gov') {
      headers.set(
        'user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      );
      headers.set('accept-language', 'en-US,en;q=0.9');
      headers.set('cache-control', 'no-cache');
      headers.set('pragma', 'no-cache');
      headers.set('referer', 'https://travel.state.gov/');
    }
  } catch {
    // Leave non-URL fetch inputs unchanged.
  }
  return headers;
}

globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
  const inputUrl = input instanceof Request ? input.url : String(input);
  return nativeFetch(input, { ...init, headers: officialSourceHeaders(inputUrl, init) });
}) as typeof fetch;

await seedReferenceStateIfNeeded();
await import('./index.js');
