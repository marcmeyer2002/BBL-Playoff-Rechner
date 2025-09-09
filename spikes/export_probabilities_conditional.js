// Schreibt public/probabilities_if_win.json und ..._if_lose.json
// Annahme: Team 'JEN'. Nutzt deine bestehenden Core-Funktionen.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import {
  standingsBaseFromRows,
  applySingleGame,
} from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN';
const NOW = Date.parse('2025-09-01T00:00:00Z');
const ITERS = 20000;

function toPercentages(byRank, iterations) {
  const out = {};
  for (const [rank, count] of Object.entries(byRank)) {
    out[rank] = +(100 * (count / iterations)).toFixed(1);
  }
  return out;
}

async function exportPayload(filename, payload) {
  const outDir = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, filename);
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Export: ${outFile}`);
}

async function main() {
  const standingsPath = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standingsPath, 'utf8')));
  const gamesAll = mapGames(JSON.parse(await fs.readFile(gamesPath, 'utf8')));
  const base = standingsBaseFromRows(standRows);

  // Restprogramm und nächster Spieltag
  const remainingAll = gamesAll.filter(g => g.status === 'PRE');
  const nextMd = getUpcomingMatchday(gamesAll, NOW);
  const todays = gamesForMatchday(gamesAll, nextMd);

  const jenaIdx = todays.findIndex(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  if (jenaIdx === -1) {
    console.log('ℹ️ JEN hat am nächsten Spieltag kein Spiel – kein konditionaler Export.');
    return;
  }

  const jenaGame = todays[jenaIdx];
  const restWithoutThis = remainingAll.filter(g => g.id !== jenaGame.id);

  // Bit definieren: 0 = Heimsieg, 1 = Auswärtssieg
  const winBit = jenaGame.home.tlc === TEAM ? 0 : 1;

  // Fall 1: JEN gewinnt
  const baseWin = applySingleGame(base, jenaGame, winBit);
  const hWin = histogramsForAllTeams(baseWin, restWithoutThis, { iterations: ITERS, topK: 8, bottomR: 2 });

  // Fall 2: JEN verliert
  const baseLose = applySingleGame(base, jenaGame, winBit ^ 1);
  const hLose = histogramsForAllTeams(baseLose, restWithoutThis, { iterations: ITERS, topK: 8, bottomR: 2 });

  // GUI-freundliche Payloads
  const mkPayload = (condition, hists) => ({
    generatedAt: new Date().toISOString(),
    condition, // 'JEN_WIN' | 'JEN_LOSE'
    seasonId: standRows[0]?.seasonId ?? 2025,
    nextMatchday: nextMd,
    iterations: ITERS,
        teams: Object.fromEntries(
      Object.entries(hists).map(([tlc, rec]) => {
        const wins = Number(baseWin ? (condition==='JEN_WIN' ? baseWin[tlc]?.wins : baseLose[tlc]?.wins) : 0);
        const losses = Number(baseWin ? (condition==='JEN_WIN' ? baseWin[tlc]?.losses : baseLose[tlc]?.losses) : 0);
        const games = wins + losses;
        return [
          tlc,
          {
            record: { wins, losses, games },
            top8Pct: +(100 * rec.topKCount / rec.iterations).toFixed(1),
            bottom2Pct: +(100 * rec.bottomRCount / rec.iterations).toFixed(1),
            rankPct: toPercentages(rec.byRank, rec.iterations),
          },
        ];
      })
    ),
  });

  await exportPayload('probabilities_if_win.json', mkPayload('JEN_WIN', hWin));
  await exportPayload('probabilities_if_lose.json', mkPayload('JEN_LOSE', hLose));
}

main().catch(err => { console.error(err); process.exit(1); });
