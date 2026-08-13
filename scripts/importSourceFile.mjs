import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const registry = {
  'visa-bulletin-2026-08': {
    id: 'visa-bulletin-2026-08',
    title: 'Visa Bulletin for August 2026',
    publisher: 'U.S. Department of State',
    url: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-august-2026.html',
    officialDownloadUrl: 'https://travel.state.gov/content/dam/visas/Bulletins/visabulletin_August2026.pdf',
    sourceVersion: 'August 2026',
    affectedNodeIds: ['authoritative-evidence', 'priority-monitoring', 'next-milestone'],
  },
};

const [, , sourceId, fileArg] = process.argv;
if (!sourceId || !fileArg || !registry[sourceId]) {
  console.error('Usage: npm run sources:import -- visa-bulletin-2026-08 "C:\\path\\to\\visabulletin_August2026.pdf"');
  process.exit(1);
}

const source = registry[sourceId];
const stateDir = process.env.SOURCE_STATE_DIR ?? path.resolve('data/source-snapshots');
const feedPath = process.env.SOURCE_FEED_PATH ?? path.resolve('public/source-intelligence.json');
const filePath = path.resolve(fileArg);

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function validateOfficialFile(bytes, extension) {
  if (extension === '.pdf') {
    const header = bytes.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') throw new Error('Selected file is not a valid PDF.');
    return 'application/pdf';
  }

  if (extension === '.html' || extension === '.htm' || extension === '.txt') {
    const text = bytes.toString('utf8');
    if (!/Visa Bulletin/i.test(text) || !/August\s+2026/i.test(text)) {
      throw new Error('Selected text/HTML file does not look like the August 2026 Visa Bulletin.');
    }
    return extension === '.txt' ? 'text/plain' : 'text/html';
  }

  throw new Error('Supported import formats are PDF, HTML, HTM, and TXT.');
}

await mkdir(stateDir, { recursive: true });
await mkdir(path.dirname(feedPath), { recursive: true });

const bytes = await readFile(filePath);
const extension = path.extname(filePath).toLowerCase();
const contentType = validateOfficialFile(bytes, extension);
const contentHash = hash(bytes);
const retrievedAt = new Date().toISOString();
const previous = await readJson(path.join(stateDir, `${source.id}.json`), null);
const changed = Boolean(previous?.contentHash && previous.contentHash !== contentHash);
const status = !previous?.contentHash ? 'first-snapshot' : changed ? 'changed' : 'unchanged';

const state = {
  id: source.id,
  retrievedAt,
  sourceVersion: source.sourceVersion,
  contentHash,
  observedUrl: source.officialDownloadUrl,
  retrievalMode: 'manual-official-file',
  contentType,
  localFileName: path.basename(filePath),
  provenanceNote: 'File was manually downloaded from the official Department of State source because automated retrieval was blocked.',
};
await writeFile(path.join(stateDir, `${source.id}.json`), JSON.stringify(state, null, 2));

const feed = await readJson(feedPath, { generatedAt: null, sources: [] });
const record = {
  ...source,
  status,
  retrievedAt,
  sourceVersion: source.sourceVersion,
  contentHash,
  previousHash: previous?.contentHash,
  observedUrl: source.officialDownloadUrl,
  retrievalMode: 'manual-official-file',
  contentType,
  localFileName: path.basename(filePath),
  provenanceNote: state.provenanceNote,
  affectedNodeIds: source.affectedNodeIds,
  changeSummary: { added: [], removed: [] },
};

const sources = Array.isArray(feed.sources) ? [...feed.sources] : [];
const index = sources.findIndex((item) => item.id === source.id);
if (index >= 0) sources[index] = record;
else sources.push(record);

await writeFile(feedPath, JSON.stringify({ generatedAt: retrievedAt, sources }, null, 2));

console.log(`${source.id}: ${status} ${source.sourceVersion} (browser-assisted official import)`);
console.log(`hash: ${contentHash}`);
console.log(`file: ${filePath}`);
