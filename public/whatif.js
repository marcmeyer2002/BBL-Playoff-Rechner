// What-If: Next Game + Best/Worst + Remaining Games — 50/50
// Neu: Team per URL-Parameter ?team=JEN (Default JEN)

function getTeamFromQuery() {
  const t = new URLSearchParams(location.search).get('team');
  return (t || 'JEN').toUpperCase();
}
const TEAM = getTeamFromQuery();

const fmtPct = (n) => `${Number(n).toFixed(1)}%`;

const RANGES = {
  playoffs: [1,2,3,4,5,6],
  playin:   [7,8,9,10],
  mid:      [11,12,13,14,15,16],
  releg:    [17,18],
};

function sumRange(rankPctObj, ranks) {
  let s = 0;
  for (const r of ranks) s += Number(rankPctObj[r] ?? 0);
  return s;
}

function pickTeam(payload, tlc) {
  const t = payload?.teams?.[tlc];
  if (!t) throw new Error(`Team ${tlc} nicht im Payload`);
  const rankPct = Object.fromEntries(
    Object.entries(t.rankPct || {}).map(([k,v]) => [Number(k), Number(v)])
  );
  return {
    record: {
      wins: Number(t.record?.wins ?? 0),
      losses: Number(t.record?.losses ?? 0),
    },
    buckets: {
      playoffs: sumRange(rankPct, RANGES.playoffs),
      playin:   sumRange(rankPct, RANGES.playin),
      mid:      sumRange(rankPct, RANGES.mid),
      releg:    sumRange(rankPct, RANGES.releg),
    },
  };
}

async function loadJSON(file) {
  const res = await fetch(file, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

function renderMeta(probBase) {
  document.querySelector('#meta').textContent =
    `Stand: ${new Date(probBase.generatedAt).toLocaleString()} • Iterations: ${probBase.iterations} • Nächster Spieltag: #${probBase.nextMatchday}`;
  const h1 = document.querySelector('#pageTitle');
  if (h1) h1.textContent = `${TEAM} — What-If (50/50)`;
}

function findTeamNextGame(nextMdPayload) {
  return nextMdPayload.games.find(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
}

function renderNextHeader(nextMdPayload, currentW, currentL) {
  const g = findTeamNextGame(nextMdPayload);
  const title = document.querySelector('#nextTitle');
  const info  = document.querySelector('#nextInfo');

  if (!g) {
    title.textContent = `Nächstes Spiel`;
    info.textContent  = `${TEAM} spielt an Spieltag #${nextMdPayload.matchDay} nicht. Aktueller Record: ${currentW}-${currentL}.`;
    return;
  }

  const home = g.home.tlc === TEAM;
  const opp  = home ? `${g.away.tlc} (${g.away.name})` : `${g.home.tlc} (${g.home.name})`;
  const vs   = home ? `vs` : `@`;

  title.textContent = `Nächstes Spiel – ${vs} ${opp}`;
  info.textContent  = `Spieltag #${g.matchDay} • ${new Date(g.scheduledTime).toLocaleString()} • Aktueller Record: ${currentW}-${currentL}`;
}

function renderBWRow(label, buckets, highlight=false) {
  return `
    <tr class="${highlight ? 'hlrow' : ''}">
      <td class="center">${label}</td>
      <td class="center">${fmtPct(buckets.playoffs)}</td>
      <td class="center">${fmtPct(buckets.playin)}</td>
      <td class="center">${fmtPct(buckets.mid)}</td>
      <td class="center">${fmtPct(buckets.releg)}</td>
    </tr>
  `;
}

function renderBestWorstBox(bw) {
  const tbody = document.querySelector('#bwBody');
  tbody.innerHTML =
    renderBWRow('Best Case Scenario',  bw.scenarios.best,   true) +
    renderBWRow('Current Standings',   bw.scenarios.current, false) +
    renderBWRow('Worst Case Scenario', bw.scenarios.worst,  false);

  const bestUl  = document.querySelector('#bwBestList');
  const worstUl = document.querySelector('#bwWorstList');
  bestUl.innerHTML  = (bw.picks.best  || []).map(p => `<li>${p.home} vs ${p.away} — <b>${p.choose === 'home' ? p.home : p.away}</b> gewinnt</li>`).join('');
  worstUl.innerHTML = (bw.picks.worst || []).map(p => `<li>${p.home} vs ${p.away} — <b>${p.choose === 'home' ? p.home : p.away}</b> gewinnt</li>`).join('');
}

function renderRemaining(rem) {
  const tbody = document.querySelector('#remBody');
  if (!rem || !Array.isArray(rem.rows)) {
    tbody.innerHTML = `<tr><td colspan="7" class="center">Keine Daten</td></tr>`;
    return;
  }
  tbody.innerHTML = rem.rows.map(r => `
    <tr>
      <td class="center">${r.winsOfRemaining} of ${r.remainingTotal}</td>
      <td class="center">${r.winPctRemaining}%</td>
      <td class="center">${r.resultantRecord.wins}-${r.resultantRecord.losses}</td>
      <td class="center">${fmtPct(r.buckets.playoffs)}</td>
      <td class="center">${fmtPct(r.buckets.playin)}</td>
      <td class="center">${fmtPct(r.buckets.mid)}</td>
      <td class="center">${fmtPct(r.buckets.releg)}</td>
    </tr>
  `).join('');
}

async function main() {
  // Basisladungen
  const [probBase, nextMd] = await Promise.all([
    loadJSON('./probabilities.json'),
    loadJSON('./next_matchday.json'),
  ]);
  renderMeta(probBase);

  // Next Game Tabelle (immer verfügbar)
  const base = pickTeam(probBase, TEAM);
  renderNextHeader(nextMd, base.record.wins, base.record.losses);

  const nextBody = document.querySelector('#nextTableBody');

  // Die konditionalen Dateien (_if_win/_if_lose) gelten aktuell NUR für JEN.
  // Für andere Teams zeigen wir nur "Current Standings".
let win = await loadJSON(`./probabilities_if_${TEAM}_win.json`)
  .then(p => pickTeam(p, TEAM)).catch(()=>null);
let lose = await loadJSON(`./probabilities_if_${TEAM}_lose.json`)
  .then(p => pickTeam(p, TEAM)).catch(()=>null);


  const wNext = base.record.wins + 1;
  const lNext = base.record.losses + 0;
  const wLose = base.record.wins + 0;
  const lLose = base.record.losses + 1;

  let html = '';
  if (win)  html += `
    <tr class="hlrow">
      <td class="center">Win Next Game</td>
      <td class="center">${wNext}</td>
      <td class="center">${lNext}</td>
      <td class="center">${fmtPct(win.buckets.playoffs)}</td>
      <td class="center">${fmtPct(win.buckets.playin)}</td>
      <td class="center">${fmtPct(win.buckets.mid)}</td>
      <td class="center">${fmtPct(win.buckets.releg)}</td>
    </tr>`;
  html += `
    <tr>
      <td class="center">Current Standings</td>
      <td class="center">${base.record.wins}</td>
      <td class="center">${base.record.losses}</td>
      <td class="center">${fmtPct(base.buckets.playoffs)}</td>
      <td class="center">${fmtPct(base.buckets.playin)}</td>
      <td class="center">${fmtPct(base.buckets.mid)}</td>
      <td class="center">${fmtPct(base.buckets.releg)}</td>
    </tr>`;
  if (lose) html += `
    <tr>
      <td class="center">Lose Next Game</td>
      <td class="center">${wLose}</td>
      <td class="center">${lLose}</td>
      <td class="center">${fmtPct(lose.buckets.playoffs)}</td>
      <td class="center">${fmtPct(lose.buckets.playin)}</td>
      <td class="center">${fmtPct(lose.buckets.mid)}</td>
      <td class="center">${fmtPct(lose.buckets.releg)}</td>
    </tr>`;
  nextBody.innerHTML = html;

  // Best/Worst
  const bw = await loadJSON(`./bestworst_${TEAM}.json`).catch(()=>null);
  if (bw) renderBestWorstBox(bw);
  else document.querySelector('#bwBody').innerHTML =
    `<tr><td colspan="5" class="center">Noch keine Best/Worst-Case Daten für ${TEAM} generiert.</td></tr>`;

  // Remaining Games
  const rem = await loadJSON(`./remaining_${TEAM}.json`).catch(()=>null);
  if (rem) renderRemaining(rem);
  else document.querySelector('#remBody').innerHTML =
    `<tr><td colspan="7" class="center">Noch keine Remaining-Games Daten für ${TEAM} generiert.</td></tr>`;
}

main().catch(e => alert(`Fehler: ${e.message}`));
