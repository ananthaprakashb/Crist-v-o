import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const registry = [
  {
    id: 'uscis-policy-manual',
    title: 'USCIS Policy Manual',
    publisher: 'U.S. Citizenship and Immigration Services',
    url: 'https://www.uscis.gov/policy-manual',
    affectedNodeIds: ['authoritative-evidence', 'employer-branch', 'dependent-milestone', 'next-milestone'],
  },
  {
    id: 'visa-bulletin-2026-08',
    title: 'Visa Bulletin for August 2026',
    publisher: 'U.S. Department of State',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
  },
];

const stateDir = process.env.SOURCE_STATE_DIR ?? path.resolve('data/source-snapshots');
const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');

function decodeEntities(text) {
  return text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeHtml(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  return decodeEntities(
    main
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex');
}

function versionFor(sourceId, text, contentHash) {
  if (sourceId.startsWith('visa-bulletin-')) {
    const match = text.match(/Visa Bulletin(?: For| for)?\s+([A-Za-z]+)\s+(\d{4})/i);
    if (match) return `${match[1]} ${match[2]}`;
  }
  return `sha256:${contentHash.slice(0, 12)}`;
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40 && part.length <= 500);
}

function diffSummary(previousText = '', currentText = '') {
  const before = new Set(sentences(previousText));
  const after = new Set(sentences(currentText));
  return {
    added: [...after].filter((item) => !before.has(item)).slice(0, 4),
    removed: [...before].filter((item) => !after.has(item)).slice(0, 4),
  };
}

async function readPrevious(id) {
  try {
    return JSON.parse(await readFile(path.join(stateDir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function snapshot(source) {
  const previous = await readPrevious(source.id);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: {
        'user-agent': 'Cristovao-Caregiver-Hackathon/0.1 (+source provenance monitor)',
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const text = normalizeHtml(await response.text());
    if (text.length < 200) throw new Error('Fetched page did not contain enough normalized text to snapshot safely.');

    const contentHash = hash(text);
    const retrievedAt = new Date().toISOString();
    const changed = Boolean(previous?.contentHash && previous.contentHash !== contentHash);
    const status = !previous?.contentHash ? 'first-snapshot' : changed ? 'changed' : 'unchanged';
    const state = {
      id: source.id,
      retrievedAt,
      sourceVersion: versionFor(source.id, text, contentHash),
      contentHash,
      normalizedText: text.slice(0, 250000),
    };

    await writeFile(path.join(stateDir, `${source.id}.json`), JSON.stringify(state, null, 2));

    return {
      ...source,
      status,
      retrievedAt,
      sourceVersion: state.sourceVersion,
      contentHash,
      previousHash: previous?.contentHash,
      affectedNodeIds: source.affectedNodeIds,
      changeSummary: changed ? diffSummary(previous?.normalizedText, text) : { added: [], removed: [] },
    };
  } catch (error) {
    return {
      ...source,
      status: 'error',
      affectedNodeIds: source.affectedNodeIds,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

await mkdir(stateDir, { recursive: true });
await mkdir(path.dirname(feedPath), { recursive: true });

const sources = [];
for (const source of registry) sources.push(await snapshot(source));

const feed = { generatedAt: new Date().toISOString(), sources };
await writeFile(feedPath, JSON.stringify(feed, null, 2));

for (const source of sources) {
  const suffix = source.status === 'error' ? `: ${source.error}` : ` ${source.sourceVersion ?? ''}`;
  console.log(`${source.id}: ${source.status}${suffix}`);
}
