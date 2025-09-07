// src/core/ranking.js

/**
 * Nimmt eine Tabelle { tlc: {wins, losses} } und gibt eine
 * sortierte Rangliste zurück: [{ tlc, wins, losses, rank }, ...]
 *
 * MVP-Tiebreaker:
 *  1) höhere Wins zuerst
 *  2) bei Gleichstand weniger Losses zuerst
 *  3) dann alphabetisch nach tlc
 *
 * Hinweis: Die echten BBL-Tiebreaker sind komplexer (Head-to-Head etc.).
 * Für das 50/50-MVP reicht diese einfache, deterministische Ordnung.
 */
export function rankTable(table) {
  const rows = Object.entries(table).map(([tlc, rec]) => ({
    tlc,
    wins: Number(rec?.wins ?? 0),
    losses: Number(rec?.losses ?? 0),
  }));

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.tlc.localeCompare(b.tlc);
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Gibt die Rangnummer eines Teams zurück oder null, falls nicht vorhanden. */
export function positionOfTeam(ranked, tlc) {
  const hit = ranked.find(r => r.tlc === tlc);
  return hit ? hit.rank : null;
}
