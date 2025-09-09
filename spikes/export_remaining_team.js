// Erzeugt public/remaining_<TEAM>.json – "Remaining Games" (PlayoffStatus-Stil)
// Nutzt 50/50-MC und mittelt über zufällige Teilmengen der restlichen Team-Spiele.
//
// Aufruf: node spikes/export_remaining_team.js --team=JEN
//         npm run export:remaining -- --team=BON

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { standingsBaseFromRows, applySingleGame } from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CLI: --team=XXX
function getTeamArg() {
  const arg = process.argv.find(a => a.startsWith('--team='));
  const v = arg ? arg.split('=')[1] : null;
  if (!v) throw new Error('Bitte Team per --team=TL C angeben (z.B. --team=JEN)');
  return v.toUpperCase();
}
const TEAM = getTeamArg();

// Rechenaufwand – feinjustierbar
const SUBSETS_PER_K = 40;
const MC_ITERS       = 400;

// Robuste Auswahl zufälliger Teilmenge von k Elementen (ohne Zurücklegen)
function pick(arr, k) {
  if (!Array.isArray(arr)) arr = [];
  const n = arr.length;
  const kk = Math.max(0, Math.min(n, Number.isFinite(k) ? Math.trunc(k) : 0));
  const a = arr.slice();
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a.slice(0, kk);
}

function bucketsFromHists(hists, tlc) {
  const rec = hists[tlc];
  if (!rec) throw new Error(`Team ${tlc} nicht im Histogramm gefunden`);
  const by  = rec.byRank;

  // Counts vs % erkennen
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

  // Aktueller Record aus standings
  const row = standRows.find(t => t.tlc === TEAM);
  if (!row) throw new Error(`Team ${TEAM} nicht in standings.json gefunden`);
  const BASE_W = Number(row.wins ?? row.totalVictories ?? 0);
  const BASE_L = Number(row.losses ?? row.totalLosses ?? 0);

  // Basiszustand + verbleibende Spiele
  const base = standingsBaseFromRows(standRows);
  const remainingAll = gamesAll.filter(g => g.status === 'PRE');
  const remainingTeam = remainingAll.filter(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  const R = remainingTeam.length;

  const rows = [];

  if (R === 0) {
    // keine Team-Spiele mehr → nur Rest-Liga simulieren
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
      let agg = { playoffs: 0, playin: 0, mid: 0, releg: 0 };

      for (let s = 0; s < SUBSETS_PER_K; s++) {
        const wins = new Set(pick(remainingTeam, k).map(g => g.id));

        // feste Team-Ergebnisse anwenden
        let curBase = base;
        let rem = remainingAll.slice();
        for (const g of remainingTeam) {
          const teamIsHome = g.home.tlc === TEAM;
          const teamWins   = wins.has(g.id);
          const bit = teamIsHome ? (teamWins ? 0 : 1) : (teamWins ? 1 : 0);
          curBase = applySingleGame(curBase, g, bit);
          rem = rem.filter(x => x.id !== g.id);
        }

        // restliche Liga simulieren (50/50)
        const hists = histogramsForAllTeams(curBase, rem, { iterations: MC_ITERS, topK: 6, bottomR: 2 });
        const b = bucketsFromHists(hists, TEAM);
        agg.playoffs += b.playoffs;
        agg.playin   += b.playin;
        agg.mid      += b.mid;
        agg.releg    += b.releg;
      }

      agg.playoffs = +(agg.playoffs / SUBSETS_PER_K).toFixed(1);
      agg.playin   = +(agg.playin   / SUBSETS_PER_K).toFixed(1);
      agg.mid      = +(agg.mid      / SUBSETS_PER_K).toFixed(1);
      agg.releg    = +(agg.releg    / SUBSETS_PER_K).toFixed(1);

      rows.push({
        winsOfRemaining: k,
        remainingTotal: R,
        winPctRemaining: +(((k / R) * 100).toFixed(0)),
        resultantRecord: { wins: BASE_W + k, losses: BASE_L + (R - k) },
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
  const outFile = path.join(outDir, `remaining_${TEAM}.json`);
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Export: ${outFile} (R=${R})`);
}

main().catch(e => { console.error(e); process.exit(1); });
