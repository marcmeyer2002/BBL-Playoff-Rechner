// spikes/snoop_json_endpoint.js
// Lädt den gefundenen JSON-Endpoint und speichert ihn als Fixture.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⬇️ Deine URL hier direkt eintragen:
const JSON_URL = 'https://api.basketball-bundesliga.de/standings?seasonId=2025&stages[]=MAIN_ROUND&competition=BBL';

const OUT = path.join(__dirname, '..', 'tests', 'fixtures', 'standings.json');

async function main() {
  // ...
  const res = await fetch(JSON_URL, {
    headers: {
      // Browser-ähnlich bleiben:
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',

      // Wichtig laut cURL:
      'Origin': 'https://www.easycredit-bbl.de',
      'Referer': 'https://www.easycredit-bbl.de/',
      'x-api-key': 'publicWebUser',
      'x-api-secret': '8220f74917f69b4baddf2cdcd1f6d1a09f697e64abe5d6576bffff2631c3dea4',
    },
    // Kein If-None-Match/ETag mitsenden, damit es keine 304 gibt
    cache: 'no-store',
  });


  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const data = await res.json();

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ JSON gespeichert: ${OUT}`);

  console.log(Array.isArray(data) ? `Top-Level Array mit ${data.length} Einträgen` 
                                  : `Top-Level Keys: ${Object.keys(data)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
