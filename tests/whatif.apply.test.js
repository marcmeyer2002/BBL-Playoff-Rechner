import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapStandings } from '../src/ingest/standings.js';
import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';
import { enumerateOutcomes, standingsBaseFromRows, applyResults } from '../src/core/whatif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadFixtures() {
  const standP = path.join(__dirname, 'fixtures', 'standings.json');
  const gamesP = path.join(__dirname, 'fixtures', 'games.json');
  const standRows = mapStandings(JSON.parse(await fs.readFile(standP, 'utf8')));
  const games = mapGames(JSON.parse(await fs.readFile(gamesP, 'utf8')));
  return { standRows, games };
}

describe('what-if core', () => {
  it('enumerateOutcomes erzeugt 2^n Kombinationen', () => {
    const combos = [...enumerateOutcomes(3)];
    expect(combos.length).toBe(8);
    expect(combos.every(c => c.length === 3)).toBe(true);
  });

  it('applyResults inkrementiert Wins/Losses korrekt für ein paar Spiele', async () => {
    const { standRows, games } = await loadFixtures();
    const NOW = Date.parse('2025-09-01T00:00:00Z');
    const md = getUpcomingMatchday(games, NOW);
    const todays = gamesForMatchday(games, md);

    // wir nehmen nur die ersten 2 Spiele des Spieltags, damit der Test klein bleibt
    const sample = todays.slice(0, 2);
    expect(sample.length).toBeGreaterThanOrEqual(2);

    const base = standingsBaseFromRows(standRows); // tlc -> { wins, losses }

    // Szenario: [0, 1] ⇒ Spiel 0: Heim gewinnt, Spiel 1: Auswärts gewinnt
    const updated = applyResults(base, sample, [0, 1]);

    const g0 = sample[0];
    const g1 = sample[1];

    // Start war 0/0, daher nach Anwendung:
    expect(updated[g0.home.tlc].wins).toBe(1);
    expect(updated[g0.home.tlc].losses).toBe(0);
    expect(updated[g0.away.tlc].wins).toBe(0);
    expect(updated[g0.away.tlc].losses).toBe(1);

    expect(updated[g1.away.tlc].wins).toBe(1);
    expect(updated[g1.away.tlc].losses).toBe(0);
    expect(updated[g1.home.tlc].wins).toBe(0);
    expect(updated[g1.home.tlc].losses).toBe(1);
  });
});
