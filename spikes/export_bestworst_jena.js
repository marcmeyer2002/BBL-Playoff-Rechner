// Baut public/bestworst_JEN.json im Stil von PlayoffStatus:
// Drei Zeilen (Best / Current / Worst) + Liste der Spiele (max. 3),
// die dafür "gesetzt" werden müssen. 50/50, nur aktueller Spieltag.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import { standingsBaseFromRows, applySingleGame } from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM = 'JEN';
const NOW = Date.now();
const ITERS = 15000;     // gern hochdrehen, wenn’s flackert
const MAX_GAMES = 3;     // wie PlayoffStatus: max. 3 Spiele

function pct(n) { return +(100 * n).toFixed(1); }

function sumRanks(byRank, from, to) {
  let s = 0;
  for (let r = from; r <= to; r++) {
    s += Number(byRank[String(r)] ?? 0);
  }
  return s;
}

function summarizeBucketsForTeam(hists, tlc) {
  const rec = hists[tlc];
  const by = rec.byRank;

  // Erkennen, ob byRank ZÄHLER (≈ iterations) oder bereits PROZENTE (≈ 100) sind
  const totalAll = Object.values(by).reduce((a, b) => a + Number(b), 0);
  const isCounts = rec.iterations && Math.abs(totalAll - rec.iterations) < rec.iterations * 0.1;
  const denom = isCounts ? rec.iterations : 100;

  const pct = (from, to) => +(((sumRanks(by, from, to) / denom) * 100).toFixed(1));

  return {
    iterations: rec.iterations,
    playoffs: pct(1, 6),     // 1–6
    playin:   pct(7, 10),    // 7–10
    mid:      pct(11, 16),   // 11–16
    releg:    pct(17, 18),   // 17–18
  };
}


function analyzeSingleGameDelta(base, remaining, game, team) {
  // 0 = Home gewinnt, 1 = Away gewinnt
  const baseH = applySingleGame(base, game, 0);
  const remH  = remaining.filter(x => x.id !== game.id);
  const histH = histogramsForAllTeams(baseH, remH, { iterations: 5000, topK: 6, bottomR: 2 });
  const pH    = sumRanks(histH[team].byRank, 1, 6) / 100;

  const baseA = applySingleGame(base, game, 1);
  const remA  = remaining.filter(x => x.id !== game.id);
  const histA = histogramsForAllTeams(baseA, remA, { iterations: 5000, topK: 6, bottomR: 2 });
  const pA    = sumRanks(histA[team].byRank, 1, 6) / 100;

  return { pHome: pH, pAway: pA };
}

function chooseTopGames(base, todays, remaining, team, excludeId) {
  // Score = |Δ Playoffs| je Spiel; nimm Top MAX_GAMES
  const rows = [];
  for (const g of todays) {
    if (g.id === excludeId) continue;
    const { pHome, pAway } = analyzeSingleGameDelta(base, remaining, g, team);
    const better = pHome > pAway ? 'home' : (pAway > pHome ? 'away' : 'equal');
    rows.push({
      id: g.id,
      matchDay: g.matchDay,
      home: g.home.tlc,
      away: g.away.tlc,
      better,
      deltaPctAbs: Math.abs(pHome - pAway),
      top6_if_home: pct(pHome),
      top6_if_away: pct(pAway),
    });
  }
  rows.sort((a,b) => b.deltaPctAbs - a.deltaPctAbs);
  return rows.slice(0, MAX_GAMES);
}

function applyScenario(base, picks, todays, remaining) {
  // setzt Outcomes für picks: {id, better: 'home'|'away'}
  let cur = base;
  let rem = remaining.slice();
  for (const p of picks) {
    const g = todays.find(x => x.id === p.id);
    if (!g) continue;
    const bit = p.better === 'home' ? 0 : 1;
    cur = applySingleGame(cur, g, bit);
    rem = rem.filter(x => x.id !== g.id);
  }
  return { base: cur, remaining: rem };
}

async function main() {
  const standingsPath = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');
  const gamesPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');

  const standRows = mapStandings(JSON.parse(await fs.readFile(standingsPath, 'utf8')));
  const gamesAll  = mapGames(JSON.parse(await fs.readFile(gamesPath, 'utf8')));
  const base      = standingsBaseFromRows(standRows);

  const remainingAll = gamesAll.filter(g => g.status === 'PRE');
  const md = getUpcomingMatchday(gamesAll, NOW);
  const todays = gamesForMatchday(gamesAll, md);

  // Jena-Spiel lokalisieren (nicht in Top-3 berücksichtigen)
  const jenaGame = todays.find(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
  const excludeId = jenaGame?.id ?? null;

  // Top-3 Hebelspiele (unbedingt)
  const top = chooseTopGames(base, todays, remainingAll, TEAM, excludeId);

  // Szenarien bauen
  const bestPicks  = top.map(x => ({ id: x.id, better: x.better }));
  const worstPicks = top.map(x => ({ id: x.id, better: x.better === 'home' ? 'away' : 'home' }));

  // Current
  const histCur = histogramsForAllTeams(base, remainingAll, { iterations: ITERS, topK: 6, bottomR: 2 });
  const current = summarizeBucketsForTeam(histCur, TEAM);

  // Best
  const { base: baseBest, remaining: remBest } = applyScenario(base, bestPicks, todays, remainingAll);
  const histBest = histogramsForAllTeams(baseBest, remBest, { iterations: ITERS, topK: 6, bottomR: 2 });
  const best = summarizeBucketsForTeam(histBest, TEAM);

  // Worst
  const { base: baseWorst, remaining: remWorst } = applyScenario(base, worstPicks, todays, remainingAll);
  const histWorst = histogramsForAllTeams(baseWorst, remWorst, { iterations: ITERS, topK: 6, bottomR: 2 });
  const worst = summarizeBucketsForTeam(histWorst, TEAM);

  const payload = {
    generatedAt: new Date().toISOString(),
    iterations: ITERS,
    team: TEAM,
    matchDay: md,
    picks: {
      best:  top.map(x => ({ id: x.id, home: x.home, away: x.away, choose: x.better })),
      worst: top.map(x => ({ id: x.id, home: x.home, away: x.away, choose: x.better === 'home' ? 'away' : 'home' })),
    },
    scenarios: { best, current, worst },
  };

  const outDir  = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'bestworst_JEN.json');
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✅ Export: ${outFile}`);
}

main().catch(err => { console.error(err); process.exit(1); });
