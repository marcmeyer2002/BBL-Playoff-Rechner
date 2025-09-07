// Bewertet pro "anderem" Spiel am nächsten Spieltag, welcher Ausgang JENs Top-8-Chance maximiert.
// Nutzt dein bestehendes Core – keine neuen Core-Funktionen nötig.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import {
  standingsBaseFromRows,
  applySingleGame,
  monteCarloSummary,
} from '../src/core/whatif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN';
const NOW = Date.parse('2025-09-01T00:00:00Z');
const ITERS = 5000; // kannst du hochdrehen (10k/20k) für stabilere Prozentwerte

function pct(count, total) {
  return total ? (100 * count / total).toFixed(1) + '%' : '—';
}

async function load() {
  const standRows = mapStandings(JSON.parse(await fs.readFile(path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json'), 'utf8')));
  const games = mapGames(JSON.parse(await fs.readFile(path.join(__dirname, '..', 'tests', 'fixtures', 'games.json'), 'utf8')));
  return { base: standingsBaseFromRows(standRows), games };
}

function analyzeSet({ base, remainingAll, todays, excludeIdx = -1 }) {
  const others = todays.filter((_, i) => i !== excludeIdx);
  const results = [];

  for (const g of others) {
    // Home-Sieg fixieren
    const baseH = applySingleGame(base, g, 0);
    const remH = remainingAll.filter(x => x.id !== g.id);
    const sumH = monteCarloSummary(baseH, remH, TEAM, { iterations: ITERS, topK: 8, bottomR: 2 });

    // Away-Sieg fixieren
    const baseA = applySingleGame(base, g, 1);
    const remA = remainingAll.filter(x => x.id !== g.id);
    const sumA = monteCarloSummary(baseA, remA, TEAM, { iterations: ITERS, topK: 8, bottomR: 2 });

    const pH = sumH.topKCount / sumH.iterations;
    const pA = sumA.topKCount / sumA.iterations;
    const delta = pH - pA;

    results.push({
      id: g.id,
      matchDay: g.matchDay,
      home: g.home.tlc,
      away: g.away.tlc,
      better: delta > 0 ? 'home' : (delta < 0 ? 'away' : 'equal'),
      deltaPct: (100 * Math.abs(delta)).toFixed(2) + '%',
      top8_if_home: pct(sumH.topKCount, sumH.iterations),
      top8_if_away: pct(sumA.topKCount, sumA.iterations),
    });
  }

  // nach Einfluss sortieren (größter Effekt zuerst)
  results.sort((a, b) => parseFloat(b.deltaPct) - parseFloat(a.deltaPct));
  return results;
}

async function main() {
  const { base, games } = await load();

  const md = getUpcomingMatchday(games, NOW);
  const todays = gamesForMatchday(games, md);
  const remainingAll = games.filter(g => g.status === 'PRE');

  console.log(`🗓️ Spieltag #${md} — andere Partien: ${todays.length}`);

  const idxJena = todays.findIndex(g => g.home.tlc === TEAM || g.away.tlc === TEAM);

  // 1) Unkonditional (Jenas Spiel bleibt random, falls vorhanden)
  console.log('\n— Unkonditional (Jena-Ergebnis nicht festgelegt):');
  const uncond = analyzeSet({ base, remainingAll, todays, excludeIdx: -1 });
  console.table(uncond);

  if (idxJena !== -1) {
    // 2) Konditional: Jena GEWINNT
    const jenaWinBit = todays[idxJena].home.tlc === TEAM ? 0 : 1;
    const baseWin = applySingleGame(base, todays[idxJena], jenaWinBit);
    const remainingNoJena = remainingAll.filter(g => g.id !== todays[idxJena].id);

    console.log('\n— Konditional: Jena GEWINNT');
    const condWin = analyzeSet({ base: baseWin, remainingAll: remainingNoJena, todays, excludeIdx: idxJena });
    console.table(condWin);

    // 3) Konditional: Jena VERLIERT
    const baseLose = applySingleGame(base, todays[idxJena], jenaWinBit ^ 1);
    console.log('\n— Konditional: Jena VERLIERT');
    const condLose = analyzeSet({ base: baseLose, remainingAll: remainingNoJena, todays, excludeIdx: idxJena });
    console.table(condLose);
  } else {
    console.log('\nℹ️ Jena spielt an diesem Spieltag nicht – nur unkonditional ausgewertet.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
