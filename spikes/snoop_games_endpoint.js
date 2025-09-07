// spikes/snoop_games_endpoint.js
// Alle BBL-Hauptrunden-Spiele einsammeln und als Fixture speichern.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👇 Nur die Basis ohne Query!
const BASE = 'https://api.basketball-bundesliga.de/games';

const SEASON_ID = 2025;
const COMPETITION = 'BBL';
const STAGES = ['MAIN_ROUND'];
const FIRST_TRY_PAGE_SIZE = 500; // Server capped evtl. kleiner

function bblHeaders() {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    'Origin': 'https://www.easycredit-bbl.de',
    'Referer': 'https://www.easycredit-bbl.de/',
    'x-api-key': 'publicWebUser',
    'x-api-secret':
      '8220f74917f69b4baddf2cdcd1f6d1a09f697e64abe5d6576bffff2631c3dea4',
  };
}

// Optionaler Filter: 'scheduled' nur Ansetzungen, ohne liefert der Server alle Stati
function buildUrl({ page = 1, pageSize = 100, gameType } = {}) {
  const qs = new URLSearchParams();
  qs.set('seasonId', String(SEASON_ID));
  qs.set('competition', COMPETITION);
  for (const s of STAGES) qs.append('stages[]', s);
  qs.set('currentPage', String(page));   // <— wichtig: currentPage!
  qs.set('pageSize', String(pageSize));
  if (gameType) qs.set('gameType', gameType); // z.B. 'scheduled'
  return `${BASE}?${qs.toString()}`;
}

async function fetchPage(page, pageSize, gameType) {
  const url = buildUrl({ page, pageSize, gameType });
  const res = await fetch(url, { headers: bblHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json(); // { items: [...], totalPages, currentPage, pageSize }
}

async function main() {
  // Erst groß probieren (der Server bestimmt das echte Limit)
  const first = await fetchPage(1, FIRST_TRY_PAGE_SIZE /*, 'scheduled' */);
  let items = Array.isArray(first.items) ? first.items : [];
  const totalPages = Number(first.totalPages ?? 1);
  const serverPageSize = Number(first.pageSize ?? FIRST_TRY_PAGE_SIZE);

  console.log(`Seite 1: pageSize=${serverPageSize}, totalPages=${totalPages}`);

  // Falls mehrere Seiten: durchpagen
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPage(page, serverPageSize /*, 'scheduled' */);
    if (Array.isArray(next.items)) items = items.concat(next.items);
    console.log(`Seite ${page}: items total = ${items.length}`);
  }

  // Speichern
  const outPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(items, null, 2), 'utf8');

  console.log(`✅ Spiele gespeichert: ${outPath}`);
  console.log(`ℹ️ Anzahl Spiele: ${items.length} (Ziel Hauptrunde ≈ 306)`);
}

main().catch((err) => {
  console.error('❌ Fehler:', err);
  process.exit(1);
});
