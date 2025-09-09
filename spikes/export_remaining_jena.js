// Erzeugt public/remaining_JEN.json – "Remaining Games" (PlayoffStatus-Stil)
// Rechnet für k Siege in den verbleibenden JEN-Spielen jeweils über mehrere
// zufällige Teilmengen und simuliert den Rest (50/50).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { standingsBaseFromRows, applySingleGame } from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN';

// Rechenaufwand – bei Bedarf feinjustieren
const SUBSETS_PER_K = 40;   // wie viele zufällige Teilmengen je k
const MC_ITERS       = 400;  // Monte-Carlo-Iterationen je Teilmenge

// Robuste Zufallsauswahl von k Elementen (ohne Zurücklegen).
// Clamped 0..n und integer; kein RangeError mehr möglich.
function pick(arr, k) {
  if (!Array.isArray(arr)) arr = [];
  const n = arr.length;
  const kk = Math.max(0, Math.min(n, Number.isFinite(k) ? Math.trunc(k) : 0));
  const a = arr.slice(); // Kopie
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0; // 0..i
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a.slice(0, kk);
}

function bucketsFromHists(hists, tlc) {
  const rec = hists[tlc];
  const by  = rec.byRank;

  // Counts vs. Prozent erkennen
  const total = Object.values(by).reduce((s, v) => s + Number(v), 0);
  const isCounts = rec.iterations && Math.abs(total - rec.iterations) < rec.iterations * 0.1;
  const denom = isCounts ? rec.iterations : 100;

  const sumRange = (lo, hi) => {
    let s = 0;
    for (let r = lo; r <= hi; r++) s += Number(by[String(r)] ?? 0);
    return +(((s / denom) * 100).toFixed(1));
  };

  return {
    playoffs: sumRange(1, 6),
    playin:   sumRange(7, 10),
    mid:      sumRange(11, 16),
    releg:    sumRange(17, 18),
  };
}

async function main() {
  const standingsPath = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesPath     = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standingsPath, 'utf8')));
  const gamesAll  = mapGames(JSON.parse(await fs.readFile(gamesPath, 'utf8')));

  // Basiszustand der Liga
  const base = standingsBaseFromRows(standRows);

  // Jenas aktueller Record aus standings (nicht aus base.teams lesen)
  const jenStanding = standRows.find(t => t.tlc === TEAM);
  if (!jenStanding) throw new Error(`Team ${TEAM} nicht in standings.json gefunden`);
  const BASE_W = Number(jenStanding.wins ?? jenStanding.totalVictories ?? 0);
  const BASE_L = Number(jenStanding.losses ?? jenStanding.totalLosses ?? 0);

  // Verbleibende Spiele
  const remainingAll = gamesAll.filter(g => g.status === 'PRE');
  const remainingJEN = remainingAll.filter(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  const R = remainingJEN.length;

  const rows = [];

  // Spezieller Edge-Case: keine verbleibenden JEN-Spiele
  if (R === 0) {
    const hists = histogramsForAllTeams(base, remainingAll, { iterations: MC_ITERS, topK: 6, bottomR: 2 });
    const b = bucketsFromHists(hists, TEAM);
    rows.push({
      winsOfRemaining: 0,
      remainingTotal: 0,
      winPctRemaining: 0,
      resultantRecord: { wins: BASE_W, losses: BASE_L },
      buckets: b,
    });
  } else {
    for (let k = R; k >= 0; k--) {
      // Aggregat über mehrere zufällige Teilmengen (welche k Spiele gewinnt JEN?)
      let agg = { playoffs: 0, playin: 0, mid: 0, releg: 0 };

      for (let s = 0; s < SUBSETS_PER_K; s++) {
        const wins = new Set(pick(remainingJEN, k).map(g => g.id));

        // feste JEN-Ergebnisse anwenden
        let curBase = base;
        let rem = remainingAll.slice();
        for (const g of remainingJEN) {
          const jenIsHome = g.home.tlc === TEAM;
          const jenWins   = wins.has(g.id);
          const bit = jenIsHome ? (jenWins ? 0 : 1) : (jenWins ? 1 : 0);
          curBase = applySingleGame(curBase, g, bit);
          rem = rem.filter(x => x.id !== g.id);
        }

        // Rest der Liga simulieren (50/50)
        const hists = histogramsForAllTeams(curBase, rem, { iterations: MC_ITERS, topK: 6, bottomR: 2 });
        const b = bucketsFromHists(hists, TEAM);
        agg.playoffs += b.playoffs;
        agg.playin   += b.playin;
        agg.mid      += b.mid;
        agg.releg    += b.releg;
      }

      // Mittelwert über die SUBSETS_PER_K-Runs
      agg.playoffs = +(agg.playoffs / SUBSETS_PER_K).toFixed(1);
      agg.playin   = +(agg.playin   / SUBSETS_PER_K).toFixed(1);
      agg.mid      = +(agg.mid      / SUBSETS_PER_K).toFixed(1);
      agg.releg    = +(agg.releg    / SUBSETS_PER_K).toFixed(1);

      rows.push({
        winsOfRemaining: k,
        remainingTotal: R,
        winPctRemaining: +(((k / R) * 100).toFixed(0)),
        resultantRecord: {
          wins:   BASE_W + k,
          losses: BASE_L + (R - k),
        },
        buckets: agg,
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    parameters: { SUBSETS_PER_K, MC_ITERS },
    team: TEAM,
    rows,
  };

  const outDir  = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'remaining_JEN.json');
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Export: ${outFile} (R=${R})`);
}

main().catch(e => { console.error(e); process.exit(1); });
