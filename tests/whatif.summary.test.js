import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import { standingsBaseFromRows, summarizeOutcomes } from '../src/core/whatif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadFixtures() {
  const standP = path.join(__dirname, 'fixtures', 'standings.json');
  const gamesP = path.join(__dirname, 'fixtures', 'games.json');
  const standRows = mapStandings(JSON.parse(await fs.readFile(standP, 'utf8')));
  const games = mapGames(JSON.parse(await fs.readFile(gamesP, 'utf8')));
  return { standRows, games };
}

describe('what-if summary for next matchday', () => {
  it('berechnet 50/50-Szenarien für JEN (Top-8 / Bottom-2)', async () => {
    const { standRows, games } = await loadFixtures();

    const NOW = Date.parse('2025-09-01T00:00:00Z');
    const md = getUpcomingMatchday(games, NOW);
    const todays = gamesForMatchday(games, md);

    const base = standingsBaseFromRows(standRows);
    const result = summarizeOutcomes(base, todays, 'JEN', { topK: 8, bottomR: 2 });

    // Grundchecks
    expect(result.team).toBe('JEN');
    expect(result.gamesCount).toBe(todays.length);
    expect(result.totalScenarios).toBe(2 ** todays.length);

    // Histogramm summiert sich zur Gesamtszenariozahl
    const sumHist = Object.values(result.byRank).reduce((a, b) => a + b, 0);
    expect(sumHist).toBe(result.totalScenarios);

    // Top-8/Bottom-2 in sinnvollen Grenzen
    expect(result.topKCount).toBeGreaterThanOrEqual(0);
    expect(result.topKCount).toBeLessThanOrEqual(result.totalScenarios);

    expect(result.bottomRCount).toBeGreaterThanOrEqual(0);
    expect(result.bottomRCount).toBeLessThanOrEqual(result.totalScenarios);
  });
});
