// src/core/whatif.js
import { rankTable, positionOfTeam } from './ranking.js';

/** Generator für alle 0/1-Kombinationen von Länge n. 0 = Heimsieg, 1 = Auswärtssieg. */
export function* enumerateOutcomes(n) {
  const total = 1 << n; // 2^n
  for (let mask = 0; mask < total; mask++) {
    const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
    yield bits;
  }
}

/** Baut Basistabelle aus mapStandings()-Zeilen: { [tlc]: { wins, losses } } */
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

/**
 * Wendet Ergebnis-Vektor (0=Home,1=Away) auf eine Basistabelle an.
 * games: normalisierte Spiele (mapGames) für diesen Spieltag.
 * return: NEUES Objekt { tlc: { wins, losses } }
 */
export function applyResults(base, games, outcomeBits) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  if (!Array.isArray(outcomeBits) || outcomeBits.length !== games.length) {
    throw new TypeError('outcomeBits muss Array mit gleicher Länge wie games sein');
  }

  // tiefe Kopie
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

/** Genau ein Spiel anwenden (0=Home, 1=Away). */
export function applySingleGame(base, game, bit) {
  return applyResults(base, [game], [bit]);
}

/**
 * Zählt für alle 2^n 50/50-Szenarien eines Spieltags:
 *  - Platz-Häufigkeiten des Teams (byRank)
 *  - Anzahl Top-K und Bottom-R Szenarien
 */
export function summarizeOutcomes(base, games, teamTlc, { topK = 8, bottomR = 2 } = {}) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  const n = games.length;
  const total = 1 << n;

  const totalTeams = Math.max(2, Object.keys(base || {}).length || 18);

  const byRank = {};
  for (let r = 1; r <= totalTeams; r++) byRank[r] = 0;

  let topKCount = 0;
  let bottomRCount = 0;

  for (const bits of enumerateOutcomes(n)) {
    const table = applyResults(base, games, bits);
    const ranked = rankTable(table);
    const pos = positionOfTeam(ranked, teamTlc);
    if (pos != null) {
      byRank[pos] = (byRank[pos] ?? 0) + 1;
      if (pos <= topK) topKCount++;
      if (pos > totalTeams - bottomR) bottomRCount++;
    }
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

/** Eine komplette Restsaison zufällig durchsimulieren (50/50 pro Spiel). */
export function simulateSeasonOnce(base, games, rng = Math.random) {
  const table = {};
  for (const [tlc, rec] of Object.entries(base)) {
    table[tlc] = { wins: Number(rec.wins ?? 0), losses: Number(rec.losses ?? 0) };
  }
  for (const g of games) {
    const home = g.home?.tlc;
    const away = g.away?.tlc;
    if (!home || !away) continue;
    if (!table[home]) table[home] = { wins: 0, losses: 0 };
    if (!table[away]) table[away] = { wins: 0, losses: 0 };
    const bit = rng() < 0.5 ? 0 : 1;
    if (bit === 0) { table[home].wins++; table[away].losses++; }
    else { table[away].wins++; table[home].losses++; }
  }
  return table;
}

/** Monte-Carlo-Zusammenfassung fürs Saisonende. */
export function monteCarloSummary(base, games, teamTlc, { iterations = 20000, topK = 8, bottomR = 2 } = {}) {
  const totalTeams = Math.max(2, Object.keys(base || {}).length || 18);
  const byRank = {};
  for (let r = 1; r <= totalTeams; r++) byRank[r] = 0;

  let topKCount = 0;
  let bottomRCount = 0;

  for (let i = 0; i < iterations; i++) {
    const table = simulateSeasonOnce(base, games);
    const ranked = rankTable(table);
    const pos = positionOfTeam(ranked, teamTlc);
    if (pos != null) {
      byRank[pos] = (byRank[pos] ?? 0) + 1;
      if (pos <= topK) topKCount++;
      if (pos > totalTeams - bottomR) bottomRCount++;
    }
  }

  return {
    team: teamTlc,
    iterations,
    topKCount,
    bottomRCount,
    byRank,
  };
}
