// spikes/whatif_next_matchday.js
// Bericht: Nächster Spieltag (50/50) – gesamt + konditional (JEN gewinnt / verliert)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import {
  standingsBaseFromRows,
  summarizeOutcomes,
  applyResults,
  enumerateOutcomes,
} from '../src/core/whatif.js';
import { rankTable, positionOfTeam } from '../src/core/ranking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN'; // Science City Jena
const NOW = Date.parse('2025-09-01T00:00:00Z'); // Referenzdatum für "nächster Spieltag"

function pct(n, d) {
  return d ? (100 * n / d).toFixed(1) + '%' : '—';
}

// Hilfsfunktion: genau ein Spiel anwenden (0=Home, 1=Away), liefert neue Tabelle
function applySingleGame(base, game, bit) {
  return applyResults(base, [game], [bit]);
}

async function main() {
  // Fixtures laden
  const standP = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesP = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standP, 'utf8')));
  const games = mapGames(JSON.parse(await fs.readFile(gamesP, 'utf8')));

  const base = standingsBaseFromRows(standRows);

  // Nächster Spieltag
  const md = getUpcomingMatchday(games, NOW);
  const todays = gamesForMatchday(games, md);

  console.log(`🗓️  Nächster Spieltag: #${md}, Spiele: ${todays.length}`);

  // 1) Gesamt (alle 2^n Szenarien)
  const overall = summarizeOutcomes(base, todays, TEAM, { topK: 8, bottomR: 2 });
  console.log('\n— Gesamt (50/50):');
  console.log(`   Szenarien: ${overall.totalScenarios}`);
  console.log(`   Top-8:  ${overall.topKCount}  (${pct(overall.topKCount, overall.totalScenarios)})`);
  console.log(`   Bottom-2: ${overall.bottomRCount} (${pct(overall.bottomRCount, overall.totalScenarios)})`);

  // 2) Konditional: Jena-Spiel fixieren (falls Jena an diesem Spieltag spielt)
  const idxJena = todays.findIndex(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  if (idxJena === -1) {
    console.log('\nℹ️  Jena hat an diesem Spieltag kein Spiel – keine Konditionalanalyse.');
    return;
  }

  const jenaGame = todays[idxJena];
  const others = todays.filter((_, i) => i !== idxJena);

  // Hilfszählung über 2^(n-1) für “Jena gewinnt” / “Jena verliert”
  function summarizeConditional(winForJena) {
    // Welcher Bitwert bedeutet “Jena gewinnt”?
    const jenaWinBit = jenaGame.home.tlc === TEAM ? 0 : 1;
    const forcedBit = winForJena ? jenaWinBit : (jenaWinBit ^ 1);

    // Basis schon mit dem fixen Ergebnis updaten:
    const baseForced = applySingleGame(base, jenaGame, forcedBit);

    // Restspiele durchzählen (2^(n-1))
    const n = others.length;
    const total = 1 << n;

    let topKCount = 0;
    let bottomRCount = 0;
    const totalTeams = Object.keys(baseForced).length || 18;

    for (const bits of enumerateOutcomes(n)) {
      const table = applyResults(baseForced, others, bits);
      const ranked = rankTable(table);
      const pos = positionOfTeam(ranked, TEAM);
      if (pos != null) {
        if (pos <= 8) topKCount++;
        if (pos > totalTeams - 2) bottomRCount++;
      }
    }
    return { total, topKCount, bottomRCount };
  }

  const win = summarizeConditional(true);
  const lose = summarizeConditional(false);

  console.log('\n— Wenn Jena GEWINNT:');
  console.log(`   Szenarien (Rest): ${win.total}`);
  console.log(`   Top-8:  ${win.topKCount}  (${pct(win.topKCount, win.total)})`);
  console.log(`   Bottom-2: ${win.bottomRCount} (${pct(win.bottomRCount, win.total)})`);

  console.log('\n— Wenn Jena VERLIERT:');
  console.log(`   Szenarien (Rest): ${lose.total}`);
  console.log(`   Top-8:  ${lose.topKCount}  (${pct(lose.topKCount, lose.total)})`);
  console.log(`   Bottom-2: ${lose.bottomRCount} (${pct(lose.bottomRCount, lose.total)})`);
}

main().catch(err => { console.error(err); process.exit(1); });
