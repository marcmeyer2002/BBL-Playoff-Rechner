// Schreibt ./public/probabilities.json mit Platz-Histogrammen aller Teams.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { standingsBaseFromRows } from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';
import { getUpcomingMatchday } from '../src/core/matchday.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITERS = 20000; // stelle frei ein

function toPercentages(byRank, iterations) {
  const out = {};
  for (const [rank, count] of Object.entries(byRank)) {
    out[rank] = +(100 * (count / iterations)).toFixed(1); // z. B. 12.3
  }
  return out;
}

async function main() {
  const standingsPath = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standingsPath, 'utf8')));
  const games = mapGames(JSON.parse(await fs.readFile(gamesPath, 'utf8')));
  const base = standingsBaseFromRows(standRows);

  const remaining = games.filter(g => g.status === 'PRE');
  const nextMd = getUpcomingMatchday(games, Date.now());

  const hists = histogramsForAllTeams(base, remaining, { iterations: ITERS, topK: 8, bottomR: 2 });

  // GUI-freundliches Format
  const payload = {
    generatedAt: new Date().toISOString(),
    seasonId: standRows[0]?.seasonId ?? 2025,
    nextMatchday: nextMd,
    iterations: ITERS,
    teams: Object.fromEntries(
      Object.entries(hists).map(([tlc, rec]) => [
        tlc,
        {
          top8Pct: +(100 * rec.topKCount / rec.iterations).toFixed(1),
          bottom2Pct: +(100 * rec.bottomRCount / rec.iterations).toFixed(1),
          rankPct: toPercentages(rec.byRank, rec.iterations), // { "1": %, ..., "18": % }
        },
      ])
    ),
  };

  const outDir = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'probabilities.json');
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`✅ Export: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
