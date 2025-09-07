// src/core/whatif.js
import { rankTable, positionOfTeam } from './ranking.js';

/**
 * Zählt für alle 2^n 50/50-Szenarien eines Spieltags:
 *  - die Platz-Häufigkeiten des Teams (byRank)
 *  - Anzahl Top-K und Bottom-R Szenarien
 */
export function summarizeOutcomes(base, games, teamTlc, { topK = 8, bottomR = 2 } = {}) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  const n = games.length;
  const total = 1 << n;

  const totalTeams = Math.max(2, Object.keys(base || {}).length || 18);

  // Histogramm 1..totalTeams (als plain object für einfaches JSON)
  const byRank = {};
  for (let r = 1; r <= totalTeams; r++) byRank[r] = 0;

  let topKCount = 0;
  let bottomRCount = 0;

  // Wir nutzen enumerateOutcomes/applyResults aus diesem Modul
  let idx = 0;
  for (const bits of enumerateOutcomes(n)) {
    const table = applyResults(base, games, bits);
    const ranked = rankTable(table);
    const pos = positionOfTeam(ranked, teamTlc);
    if (pos != null) {
      byRank[pos] = (byRank[pos] ?? 0) + 1;
      if (pos <= topK) topKCount++;
      if (pos > totalTeams - bottomR) bottomRCount++;
    }
    idx++;
  }

  return {
    team: teamTlc,
    gamesCount: n,
    totalScenarios: total,
    topKCount,
    bottomRCount,
    byRank,
  };
}

/* ---- bereits vorhandene Exporte (lassen, falls noch nicht da) ---- */
/**
 * Generator für alle 0/1-Kombinationen (0=Home, 1=Away).
 */
export function* enumerateOutcomes(n) {
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
    yield bits;
  }
}

export function standingsBaseFromRows(rows) {
  const out = {};
  for (const r of rows) {
    if (!r?.tlc) continue;
    out[r.tlc] = {
      wins: Number(r.totals?.wins ?? 0),
      losses: Number(r.totals?.losses ?? 0),
    };
  }
  return out;
}

export function applyResults(base, games, outcomeBits) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  if (!Array.isArray(outcomeBits) || outcomeBits.length !== games.length) {
    throw new TypeError('outcomeBits muss Array mit gleicher Länge wie games sein');
  }
  const table = {};
  for (const [tlc, rec] of Object.entries(base)) {
    table[tlc] = { wins: Number(rec.wins ?? 0), losses: Number(rec.losses ?? 0) };
  }
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const bit = outcomeBits[i];
    const home = g.home?.tlc;
    const away = g.away?.tlc;
    if (!home || !away) continue;
    if (!table[home]) table[home] = { wins: 0, losses: 0 };
    if (!table[away]) table[away] = { wins: 0, losses: 0 };
    if (bit === 0) {
      table[home].wins += 1;
      table[away].losses += 1;
    } else {
      table[away].wins += 1;
      table[home].losses += 1;
    }
  }
  return table;
}
