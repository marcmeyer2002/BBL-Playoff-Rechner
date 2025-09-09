// Schreibt public/next_matchday.json mit allen Partien des nächsten Spieltags
// (id, matchDay, scheduledTime, home {tlc,name}, away {tlc,name})

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapGames } from '../src/ingest/games.js';
import { getUpcomingMatchday, gamesForMatchday } from '../src/core/matchday.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const gamesPath = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');
  const raw = JSON.parse(await fs.readFile(gamesPath, 'utf8'));
  const allGames = mapGames(raw);

  const nextMd = getUpcomingMatchday(allGames, Date.now());
  const todays = gamesForMatchday(allGames, nextMd);

  const payload = {
    generatedAt: new Date().toISOString(),
    matchDay: nextMd,
    games: todays.map(g => ({
      id: g.id,
      matchDay: g.matchDay,
      scheduledTime: g.scheduledTime,
      home: { tlc: g.home.tlc, name: g.home.name },
      away: { tlc: g.away.tlc, name: g.away.name },
    })),
  };

  const outDir = path.join(__dirname, '..', 'public');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'next_matchday.json');
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`✅ Export: ${outFile} (Spiele: ${payload.games.length})`);
}

main().catch(err => { console.error(err); process.exit(1); });
