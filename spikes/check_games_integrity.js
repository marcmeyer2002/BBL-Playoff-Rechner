// spikes/check_games_integrity.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const p = path.join(__dirname, '..', 'tests', 'fixtures', 'games.json');
  const data = JSON.parse(await fs.readFile(p, 'utf8')); // flaches items-Array

  const teams = new Set();
  const byDay = new Map();
  const statuses = new Map();
  const flags = { tbd: 0, hidden: 0 };

  for (const it of data) {
    // Teams sammeln
    if (it?.homeTeam?.tlc) teams.add(it.homeTeam.tlc);
    if (it?.guestTeam?.tlc) teams.add(it.guestTeam.tlc);

    // Spieltage zählen
    const d = Number(it.matchDay ?? -1);
    if (!byDay.has(d)) byDay.set(d, 0);
    byDay.set(d, byDay.get(d) + 1);

    // Status verteilen
    const st = it.status ?? 'UNK';
    statuses.set(st, (statuses.get(st) ?? 0) + 1);

    // Flags
    if (it.isTBD) flags.tbd++;
    if (it.isHidden) flags.hidden++;
  }

  const totalGames = data.length;
  const distinctDays = [...byDay.keys()].filter(n => n > 0).sort((a,b)=>a-b);
  const minDay = distinctDays[0];
  const maxDay = distinctDays[distinctDays.length - 1];

  console.log(`Teams: ${teams.size} (erwartet 18)`);
  console.log(`Spiele gesamt: ${totalGames} (erwartet 306)`);
  console.log(`matchDay min..max: ${minDay}..${maxDay} (erwartet 1..34)`);
  console.log(`Status-Verteilung:`, Object.fromEntries(statuses));
  if (flags.tbd || flags.hidden) {
    console.log(`Hinweise: isTBD=${flags.tbd}, isHidden=${flags.hidden}`);
  }

  // Spieltage mit nicht 9 Spielen hervorheben
  const anomalies = [];
  for (const d of distinctDays) {
    const c = byDay.get(d);
    if (c !== 9) anomalies.push([d, c]);
  }
  if (anomalies.length) {
    console.log('⚠️ Abweichungen (matchDay → Anzahl Spiele):');
    for (const [d, c] of anomalies) console.log(`  #${d}: ${c}`);
  } else {
    console.log('✅ Alle Spieltage haben 9 Spiele.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
