import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import { log } from 'node:console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('matchday helpers', () => {
  it('findet den nächsten Spieltag und filtert die Spiele dafür', async () => {
    const p = path.join(__dirname, 'fixtures', 'games.json');
    const rawItems = JSON.parse(await fs.readFile(p, 'utf8'));
    const games = mapGames(rawItems);

    // "Heute" = vor Saisonstart (UTC)
    const NOW = Date.parse('2025-09-01T00:00:00Z');

    const md = getUpcomingMatchday(games, NOW);
    expect(typeof md).toBe('number');
    expect(md).toBeGreaterThanOrEqual(1);
    expect(md).toBeLessThanOrEqual(34);

    const list = gamesForMatchday(games, md);
    // console.log(`Spiele für Spieltag #${md}:`, list);
    expect(Array.isArray(list)).toBe(true);
    // Deine Fixture hat an #1 acht Spiele – erlauben 8..9
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(list.length).toBeLessThanOrEqual(9);

    // Konsistenz
    expect(list.every(g => g.matchDay === md)).toBe(true);
    expect(list.every(g => g.status === 'PRE')).toBe(true);
  });
});
