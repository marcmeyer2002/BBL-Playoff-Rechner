// public/app.js
// Aggregiert BBL-spezifische Bereiche: Playoffs (1–6), Play-In (7–10),
// Mittelfeld (11–16), Abstieg (17–18). Zeigt Prozentwerte an.

const TEAM_HIGHLIGHT = 'JEN'; // später konfigurierbar

// Rang-Bereiche (falls die BBL-Regeln sich ändern, hier anpassen)
const RANGES = {
  playoffs: [1, 2, 3, 4, 5, 6],
  playin:   [7, 8, 9, 10],
  mid:      [11, 12, 13, 14, 15, 16],
  releg:    [17, 18],
};

const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

function expectedRank(rankPctObj) {
  // Erwarteten Rang aus Prozenten berechnen: Σ rank * (pct/100)
  let exp = 0;
  for (const [rankStr, pct] of Object.entries(rankPctObj)) {
    exp += Number(rankStr) * (Number(pct) / 100);
  }
  return exp;
}

function sumRange(rankPctObj, ranks) {
  let s = 0;
  for (const r of ranks) s += Number(rankPctObj[r] ?? 0);
  return s;
}

function parseTeamRows(teamsObj) {
  return Object.entries(teamsObj).map(([tlc, rec]) => {
    const rankPct = Object.fromEntries(
      Object.entries(rec.rankPct || {}).map(([k, v]) => [Number(k), Number(v)])
    );

    const wins = Number(rec.record?.wins ?? 0);
    const losses = Number(rec.record?.losses ?? 0);
    const games = Number(rec.record?.games ?? (wins + losses));

    const playoffs = sumRange(rankPct, RANGES.playoffs);
    const playin   = sumRange(rankPct, RANGES.playin);
    const mid      = sumRange(rankPct, RANGES.mid);
    const releg    = sumRange(rankPct, RANGES.releg);

    const expected = expectedRank(rankPct);

    return { tlc, wins, losses, games, playoffs, playin, mid, releg, expected };
  });
}

async function loadAndRender(filename) {
  const res = await fetch(`./${filename}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // Nach erwarteter Platzierung sortieren (niedriger = besser)
  const rows = parseTeamRows(data.teams).sort((a, b) => a.expected - b.expected);

  // Meta
  const meta = document.querySelector('#meta');
  meta.textContent = `Stand: ${new Date(data.generatedAt).toLocaleString()} • Iterations: ${data.iterations} • Nächster Spieltag: #${data.nextMatchday}`;

  // Tabelle rendern
  const tbody = document.querySelector('#probTable tbody');
  tbody.innerHTML = '';

  for (const t of rows) {
    const tr = document.createElement('tr');
    if (t.tlc === TEAM_HIGHLIGHT) tr.classList.add('hl');

    tr.innerHTML = `
      <td class="sticky name">${t.tlc}</td>
      <td class="center">${t.wins}</td>
      <td class="center">${t.losses}</td>
      <td class="center">${t.games}</td>
      <td class="center" title="#1–6">${fmtPct(t.playoffs)}</td>
      <td class="center" title="#7–10">${fmtPct(t.playin)}</td>
      <td class="center" title="#11–16">${fmtPct(t.mid)}</td>
      <td class="center" title="#17–18">${fmtPct(t.releg)}</td>
    `;

    tbody.appendChild(tr);
  }
}

function wireButtons() {
  document.querySelectorAll('button[data-src]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const file = btn.getAttribute('data-src');
      loadAndRender(file).catch((e) => alert(`Fehler: ${e.message}`));
    });
  });
}

// Init
wireButtons();
loadAndRender('probabilities.json').catch((e) => alert(`Fehler: ${e.message}`));
