import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapStandings } from '../src/ingest/standings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('mapStandings', () => {
  it('parst die BBL-Standings-Fixture in ein normales Array', async () => {
    const p = path.join(__dirname, 'fixtures', 'standings.json');
    const txt = await fs.readFile(p, 'utf8');
    const raw = JSON.parse(txt);

    const rows = mapStandings(raw);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(18);

    // Jena sollte vorhanden sein (dein Dump zeigt rank 18)
    const jena = rows.find(r => r.tlc === 'JEN' || /Jena/i.test(r.name));
    expect(jena).toBeTruthy();
    expect(jena.rank).toBe(18);

    // Zu Saisonstart sind die Totals 0
    expect(jena.totals.games).toBeTypeOf('number');
    expect(jena.totals.games).toBe(0);
    expect(jena.flags.isRelegationCertain).toBe(false);
  });
});
