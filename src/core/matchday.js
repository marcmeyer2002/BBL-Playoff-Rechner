// src/core/matchday.js

/**
 * Ermittelt den nächsten Spieltag (1..34) anhand geplanter Spiele.
 * Logik:
 *  - Betrachte nur Spiele mit status === 'PRE'.
 *  - Nimm den kleinsten scheduledTime >= nowMs.
 *  - Fallback: kleinster PRE-matchDay (falls Zeiten fehlen).
 */
export function getUpcomingMatchday(games, nowMs = Date.now()) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');

  const pre = games.filter(g => g?.status === 'PRE');
  if (pre.length === 0) {
    // Fallback: wenn nichts PRE ist, nimm den kleinsten vorhandenen matchDay
    return Math.min(...games.map(g => g.matchDay).filter(Number.isFinite));
  }

  // Kandidaten mit gültiger Zeit ab jetzt
  const withTime = pre
    .map(g => ({ g, t: Date.parse(g.scheduledTime) }))
    .filter(x => Number.isFinite(x.t));

  const future = withTime.filter(x => x.t >= nowMs);
  if (future.length > 0) {
    const tMin = Math.min(...future.map(x => x.t));
    return future.find(x => x.t === tMin).g.matchDay;
  }

  // Wenn alle Zeiten < now oder keine Zeiten vorhanden: kleinster PRE-matchDay
  return Math.min(...pre.map(g => g.matchDay).filter(Number.isFinite));
}

/**
 * Liefert alle PRE-Spiele eines Spieltags, sortiert nach Anstoßzeit (falls vorhanden).
 */
export function gamesForMatchday(games, matchDay) {
  if (!Array.isArray(games)) throw new TypeError('games muss ein Array sein');
  const list = games.filter(g => g?.status === 'PRE' && g?.matchDay === matchDay);
  // hübsch sortieren (ohne Annahmen, falls Zeit fehlt)
  return list.sort((a, b) => (Date.parse(a.scheduledTime) || 0) - (Date.parse(b.scheduledTime) || 0));
}
