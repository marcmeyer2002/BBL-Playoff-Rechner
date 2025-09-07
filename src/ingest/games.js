// Normalisiert die BBL-Games-Items (Array) in ein schlankes Format.
// Eingabe = das flache Array aus games.json (nicht das Paging-Objekt).

export function mapGames(items) {
  if (!Array.isArray(items)) {
    throw new TypeError('mapGames erwartet ein Array von Items');
  }

  // TODO: du implementierst hier die Abbildung:
  // - id: String (oder Number → String)
  // - stage, competition: direkt durchreichen
  // - status: z.B. "PRE"
  // - matchDay: Number
  // - scheduledTime: ISO-String (aus scheduledTime)
  // - home/away: { tlc, name, teamId (als String) }
  // - (optional für später) result: { homeScore, awayScore } wenn vorhanden, sonst null

  // Tipp zu Feldern:
  //  - item.homeTeam.tlc, item.homeTeam.name, item.homeTeam.teamId
  //  - item.guestTeam.tlc, item.guestTeam.name, item.guestTeam.teamId
  //  - item.matchDay, item.scheduledTime, item.status, item.stage, item.competition
  //  - item.result ist bei PRE null; bei fertigen Spielen liefert die API Scores (kannst du später ergänzen)

  return items.map((it) => {
    const home = it.homeTeam ?? {};
    const away = it.guestTeam ?? {};

    return {
      id: String(it.id),
      stage: it.stage ?? null,
      competition: it.competition ?? null,
      status: it.status ?? null,
      matchDay: Number(it.matchDay ?? 0),
      scheduledTime: it.scheduledTime ?? null,
      home: {
        tlc: home.tlc ?? null,
        name: home.name ?? '',
        teamId: home.teamId != null ? String(home.teamId) : null,
      },
      away: {
        tlc: away.tlc ?? null,
        name: away.name ?? '',
        teamId: away.teamId != null ? String(away.teamId) : null,
      },
      // Für später:
      result: it.result && typeof it.result === 'object'
        ? {
            homeScore: Number(it.result.homeScore ?? it.result.homePoints ?? NaN),
            awayScore: Number(it.result.awayScore ?? it.result.awayPoints ?? NaN),
          }
        : null,
    };
  });
}
