import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { standingsBaseFromRows } from '../src/core/whatif.js';
import { histogramsForAllTeams } from '../src/core/probabilities.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('histogramsForAllTeams', () => {
  it('liefert je Team ein korrekt summierendes Histogramm', async () => {
    const standRows = mapStandings(JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'standings.json'), 'utf8')));
    const games = mapGames(JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'games.json'), 'utf8')));
    const base = standingsBaseFromRows(standRows);
    const remaining = games.filter(g => g.status === 'PRE');

    const ITERS = 2000; // klein halten für Tests
    const res = histogramsForAllTeams(base, remaining, { iterations: ITERS, topK: 8, bottomR: 2 });

    const teams = Object.keys(res);
    expect(teams.length).toBeGreaterThanOrEqual(18);

    // Summen-Checks pro Team
    for (const tlc of teams) {
      const { iterations, byRank, topKCount, bottomRCount } = res[tlc];
      expect(iterations).toBe(ITERS);
      const sumRanks = Object.values(byRank).reduce((a, b) => a + b, 0);
      expect(sumRanks).toBe(ITERS);
      expect(topKCount).toBeGreaterThanOrEqual(0);
      expect(topKCount).toBeLessThanOrEqual(ITERS);
      expect(bottomRCount).toBeGreaterThanOrEqual(0);
      expect(bottomRCount).toBeLessThanOrEqual(ITERS);
    }

    // JEN sollte vorkommen
    expect(res['JEN']).toBeTruthy();
  });
});
