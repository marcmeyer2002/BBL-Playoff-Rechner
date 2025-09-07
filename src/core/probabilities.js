// Aggregiert Platz-Wahrscheinlichkeiten für ALLE Teams über Monte-Carlo.
// Nutzt deine existierenden Helpers: simulateSeasonOnce + rankTable.

import { simulateSeasonOnce } from './whatif.js';
import { rankTable } from './ranking.js';

/**
 * @param {Record<string,{wins:number,losses:number}>} base - Ausgangstabelle (z. B. aus standingsBaseFromRows)
 * @param {Array} games - alle restlichen Spiele (status === 'PRE')
 * @param {{iterations?:number, topK?:number, bottomR?:number}} opts
 * @returns {Record<string,{iterations:number, topKCount:number, bottomRCount:number, byRank:Record<number,number>}>}
 */
export function histogramsForAllTeams(base, games, { iterations = 20000, topK = 8, bottomR = 2 } = {}) {
  const teamIds = Object.keys(base);
  const totalTeams = teamIds.length || 18;

  // init
  const out = {};
  for (const tlc of teamIds) {
    const byRank = {};
    for (let r = 1; r <= totalTeams; r++) byRank[r] = 0;
    out[tlc] = { iterations, topKCount: 0, bottomRCount: 0, byRank };
  }

  for (let i = 0; i < iterations; i++) {
    const table = simulateSeasonOnce(base, games);
    const ranked = rankTable(table);
    for (const row of ranked) {
      const rec = out[row.tlc];
      if (!rec) continue; // safety
      rec.byRank[row.rank] = (rec.byRank[row.rank] ?? 0) + 1;
      if (row.rank <= topK) rec.topKCount++;
      if (row.rank > totalTeams - bottomR) rec.bottomRCount++;
    }
  }

  return out;
}
