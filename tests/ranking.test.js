import { describe, it, expect } from 'vitest';
import { rankTable, positionOfTeam } from '../src/core/ranking.js';

describe('ranking basics', () => {
  it('sortiert nach Wins desc, Losses asc, dann tlc alphabetisch (Tiebreak)', () => {
    const table = {
      JEN: { wins: 1, losses: 0 },
      FCB: { wins: 1, losses: 0 },
      BER: { wins: 0, losses: 1 },
    };

    const ranked = rankTable(table);

    // Bei Gleichstand 1-0 entscheidet alphabetisch: FCB vor JEN
    expect(ranked.map(r => r.tlc)).toEqual(['FCB', 'JEN', 'BER']);
    expect(ranked[0]).toMatchObject({ tlc: 'FCB', wins: 1, losses: 0, rank: 1 });
    expect(ranked[1]).toMatchObject({ tlc: 'JEN', wins: 1, losses: 0, rank: 2 });
    expect(ranked[2]).toMatchObject({ tlc: 'BER', wins: 0, losses: 1, rank: 3 });

    expect(positionOfTeam(ranked, 'JEN')).toBe(2);
    expect(positionOfTeam(ranked, 'XYZ')).toBeNull(); // unbekanntes Team
  });
});
