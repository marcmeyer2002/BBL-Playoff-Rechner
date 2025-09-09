// Exportiert public/marginals_JEN.json mit Top-3 "Hebel-Spielen" am nächsten Spieltag
// für JEN (unconditional, if JEN wins, if JEN loses). Kennzahl: Δ Playoffs (1–6).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import { standingsBaseFromRows, applySingleGame, monteCarloSummary } from '../src/core/whatif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN';
const NOW = Date.now();
const ITERS = 10000; // kannst du erhöhen

function pct(x) { return +(100 * x).toFixed(1); }

function analyzeSet({ base, remainingAll, todays, excludeIdx = -1 }) {
  const others = todays.filter((_, i) => i !== excludeIdx);
  const rows = [];

  for (const g of others) {
    // 0 = Heimsieg, 1 = Auswärtssieg
    const baseH = applySingleGame(base, g, 0);
    const baseA = applySingleGame(base, g, 1);
    const remH = remainingAll.filter(x => x.id !== g.id);
    const remA = remH; // identisch

    const sH = monteCarloSummary(baseH, remH, TEAM, { iterations: ITERS, topK: 6, bottomR: 2 });
    const sA = monteCarloSummary(baseA, remA, TEAM, { iterations: ITERS, topK: 6, bottomR: 2 });

    const pH = sH.topKCount / sH.iterations;
    const pA = sA.topKCount / sA.iterations;

    rows.push({
      id: g.id,
      matchDay: g.matchDay,
      home: g.home.tlc,
      away: g.away.tlc,
      better: pH > pA ? 'home' : (pA > pH ? 'away' : 'equal'),
      deltaPctAbs: Math.abs(pH - pA),
      top6_if_home: pct(pH),
      top6_if_away: pct(pA),
    });
  }

  rows.sort((a, b) => b.deltaPctAbs - a.deltaPctAbs);
  return rows.slice(0, 3); // Top-3
}

async function main() {
  const standingsPath = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standingsPath, 'utf8')));
  const gamesAll = mapGames(JSON.parse(await fs.readFile(gamesPath, 'utf8')));
  const base = standingsBaseFromRows(standRows);

  const remainingAll = gamesAll.filter(g => g.status === 'PRE');
  const md = getUpcomingMatchday(gamesAll, NOW);
  const todays = gamesForMatchday(gamesAll, md);

  const jenaIdx = todays.findIndex(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  const jenaGame = jenaIdx !== -1 ? todays[jenaIdx] : null;

  // Unkonditional
  const unconditional = analyzeSet({ base, remainingAll, todays, excludeIdx: -1 });

  // Konditional
  let ifWin = [], ifLose = [];
  if (jenaGame) {
    const winBit = jenaGame.home.tlc === TEAM ? 0 : 1;
    const baseWin = applySingleGame(base, jenaGame, winBit);
    const baseLose = applySingleGame(base, jenaGame, winBit ^ 1);
    const remNoJena = remainingAll.filter(g => g.id !== jenaGame.id);

    ifWin  = analyzeSet({ base: baseWin,  remainingAll: remNoJena, todays, excludeIdx: jenaIdx });
    ifLose = analyzeSet({ base: baseLose, remainingAll: remNoJena, todays, excludeIdx: jenaIdx });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    iterations: ITERS,
    team: TEAM,
    matchDay: md,
    unconditional,
    ifWin,
    ifLose,
  };

  const outDir = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'marginals_JEN.json');
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Export: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
