// Saisonende-What-if (Monte-Carlo, 50/50): overall + konditional (JEN gewinnt/verliert nächstes Spiel)

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
const ITERS = 20000; // bei Bedarf kleiner/größer setzen

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + '%' : '—'; }

async function main() {
  const standRows = mapStandings(JSON.parse(await fs.readFile(path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json'), 'utf8')));
  const allGames = mapGames(JSON.parse(await fs.readFile(path.join(__dirname, '..', 'tests', 'fixtures', 'games.json'), 'utf8')));

  const base = standingsBaseFromRows(standRows);
  const md = getUpcomingMatchday(allGames, NOW);
  const todays = gamesForMatchday(allGames, md);

  // Rest der Saison = alle PRE-Spiele
  const remainingAll = allGames.filter(g => g.status === 'PRE');

  console.log(`🗓️ Saisonende-MC (Iterations=${ITERS}) — Ausgang: Wins/Losses laut standings.json`);

  // Overall (ohne Festlegung von Jenas nächstem Spiel)
  const overall = monteCarloSummary(base, remainingAll, TEAM, { iterations: ITERS, topK: 8, bottomR: 2 });
  console.log('\n— Overall (bis Saisonende):');
  console.log(`   Top-8:    ${overall.topKCount}/${overall.iterations} (${pct(overall.topKCount, overall.iterations)})`);
  console.log(`   Bottom-2: ${overall.bottomRCount}/${overall.iterations} (${pct(overall.bottomRCount, overall.iterations)})`);

  // Konditional: nur wenn Jena am nächsten Spieltag spielt
  const jenaIdx = todays.findIndex(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  if (jenaIdx === -1) {
    console.log('\nℹ️ Jena hat am nächsten Spieltag kein Spiel – überspringe Konditionalanalyse.');
    return;
  }
  const jenaGame = todays[jenaIdx];
  const remainingWithoutThis = remainingAll.filter(g => g.id !== jenaGame.id);

  // Jena-Sieg fest verdrahten
  const jenaWinBit = jenaGame.home.tlc === TEAM ? 0 : 1;
  const baseWin = applySingleGame(base, jenaGame, jenaWinBit);
  const win = monteCarloSummary(baseWin, remainingWithoutThis, TEAM, { iterations: ITERS, topK: 8, bottomR: 2 });

  // Jena-Niederlage fest verdrahten
  const baseLose = applySingleGame(base, jenaGame, jenaWinBit ^ 1);
  const lose = monteCarloSummary(baseLose, remainingWithoutThis, TEAM, { iterations: ITERS, topK: 8, bottomR: 2 });

  console.log('\n— Wenn Jena GEWINNT (Saisonende):');
  console.log(`   Top-8:    ${win.topKCount}/${win.iterations} (${pct(win.topKCount, win.iterations)})`);
  console.log(`   Bottom-2: ${win.bottomRCount}/${win.iterations} (${pct(win.bottomRCount, win.iterations)})`);

  console.log('\n— Wenn Jena VERLIERT (Saisonende):');
  console.log(`   Top-8:    ${lose.topKCount}/${lose.iterations} (${pct(lose.topKCount, lose.iterations)})`);
  console.log(`   Bottom-2: ${lose.bottomRCount}/${lose.iterations} (${pct(lose.bottomRCount, lose.iterations)})`);
}

main().catch(err => { console.error(err); process.exit(1); });
