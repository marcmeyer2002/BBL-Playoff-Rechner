import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapGames } from '../src/ingest/games.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('mapGames', () => {
  it('normalisiert die Games-Fixture in ein schlankes Format', async () => {
    const p = path.join(__dirname, 'fixtures', 'games.json');
    const txt = await fs.readFile(p, 'utf8');
    const rawItems = JSON.parse(txt); // Achtung: games.json ist das flache items-Array

    const games = mapGames(rawItems);

    // Grundchecks
    expect(Array.isArray(games)).toBe(true);
    // Hauptrunde sollte ~306 Spiele enthalten – zu Saisonstart evtl. etwas weniger
    expect(games.length).toBeGreaterThanOrEqual(250);
    expect(games.length).toBeLessThanOrEqual(400);

    // Felder-Form: ein Beispielspiel prüfen
    const g = games[0];
    expect(g).toHaveProperty('id');
    expect(g).toHaveProperty('stage', 'MAIN_ROUND');
    expect(g).toHaveProperty('competition', 'BBL');
    expect(g).toHaveProperty('matchDay');        // Number
    expect(g).toHaveProperty('scheduledTime');   // ISO-String
    expect(g).toHaveProperty('status');          // PRE/POST/etc.
    expect(g.home).toHaveProperty('tlc');
    expect(g.away).toHaveProperty('tlc');

    // Jena sollte in mind. einem Spiel vorkommen
    const hasJena = games.some(
      (x) => x.home.tlc === 'JEN' || x.away.tlc === 'JEN'
    );
    expect(hasJena).toBe(true);
  });
});
