// src/ingest/standings.js
// Normalisiert die BBL-API-Standings auf ein schlankes Format.

export function mapStandings(raw) {
  if (!Array.isArray(raw)) {
    throw new TypeError('mapStandings erwartet ein Array');
  }

  return raw.map((entry) => {
    const st = entry.seasonTeam ?? {};
    return {
      tlc: st.tlc ?? null,                 // z.B. "JEN"
      name: st.name ?? '',                 // "Science City Jena"
      nameShort: st.nameShort ?? '',       // "Jena"
      teamId: st.teamId != null ? String(st.teamId) : null,
      seasonTeamId: st.id != null ? Number(st.id) : null,
      rank: entry.rank ?? null,
      totals: {
        games: Number(entry.totalGames ?? 0),
        wins: Number(entry.totalVictories ?? 0),
        losses: Number(entry.totalLosses ?? 0),
        // API nutzt teils "Points", teils "Goals" – beides abfangen:
        pointsFor: Number(entry.totalPointsMade ?? entry.totalGoalsMade ?? 0),
        pointsAgainst: Number(entry.totalPointsAgainst ?? entry.totalGoalsAgainst ?? 0),
      },
      updatedDate: entry.updatedDate ?? null,
      competition: entry.competition ?? 'BBL',
      stage: entry.stage ?? null,
      seasonId: entry.seasonId ?? null,
      flags: {
        hasReachedPlayoffs: !!st.hasReachedPlayoffs,
        hasReachedPlayins: !!st.hasReachedPlayins,
        isRelegationCertain: !!st.isRelegationCertain,
      },
    };
  });
}
