// src/core/whatif.js

/**
 * Generator für alle 0/1-Kombinationen von Länge n.
 * 0 = Heimsieg, 1 = Auswärtssieg.
 */
export function* enumerateOutcomes(n) {
  const total = 1 << n; // 2^n
  for (let mask = 0; mask < total; mask++) {
    const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
    yield bits;
  }
}

/**
 * Baut eine einfache Basistabelle aus mapStandings()-Zeilen:
 * { [tlc]: { wins, losses } }
 */
export function standingsBaseFromRows(rows) {
  const out = {};
  for (const r of rows) {
    if (!r?.tlc) continue;
    out[r.tlc] = {
      wins: Number(r.totals?.wins ?? 0),
      losses: Number(r.totals?.losses ?? 0),
    };
  }
  return out;
}

/**
 * Wendet ein Ergebnis-Vektor (0=Home gewinnt, 1=Away gewinnt) auf eine Basistabelle an.
 * games: normalisierte Spiele (mapGames) für diesen Spieltag.
 * returns: NEUES Objekt { tlc: { wins, losses } } – base bleibt unverändert.
 */
export function applyResults(base, games, outcomeBits) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  if (!Array.isArray(outcomeBits) || outcomeBits.length !== games.length) {
    throw new TypeError('outcomeBits muss Array mit gleicher Länge wie games sein');
  }

  // tiefe Kopie der Basistabelle
  const table = {};
  for (const [tlc, rec] of Object.entries(base)) {
    table[tlc] = { wins: Number(rec.wins ?? 0), losses: Number(rec.losses ?? 0) };
  }

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const bit = outcomeBits[i];

    const home = g.home?.tlc;
    const away = g.away?.tlc;
    if (!home || !away) continue;

    // ensure teams exist in table
    if (!table[home]) table[home] = { wins: 0, losses: 0 };
    if (!table[away]) table[away] = { wins: 0, losses: 0 };

    if (bit === 0) {
      table[home].wins += 1;
      table[away].losses += 1;
    } else {
      table[away].wins += 1;
      table[home].losses += 1;
    }
  }

  return table;
}
