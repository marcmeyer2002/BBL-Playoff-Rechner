// What-If für JEN im PlayoffStatus-Stil:
// 1) Next-Game-Box (Win / Current / Lose)
// 2) Best/Worst-Case-Scenarios (3 Zeilen + Spiel-Listen)

const TEAM = 'JEN';

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
}

function findJenaNextGame(nextMdPayload) {
  return nextMdPayload.games.find(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
}

function renderNextHeader(nextMdPayload, currentW, currentL) {
  const g = findJenaNextGame(nextMdPayload);
  const title = document.querySelector('#nextTitle');
  const info  = document.querySelector('#nextInfo');

  if (!g) {
    title.textContent = `Nächstes Spiel`;
    info.textContent  = `Jena spielt an Spieltag #${nextMdPayload.matchDay} nicht. Aktueller Record: ${currentW}-${currentL}.`;
    return;
  }

  const home = g.home.tlc === TEAM;
  const opp  = home ? `${g.away.tlc} (${g.away.name})` : `${g.home.tlc} (${g.home.name})`;
  const vs   = home ? `vs` : `@`;

  title.textContent = `Nächstes Spiel – ${vs} ${opp}`;
  info.textContent  = `Spieltag #${g.matchDay} • ${new Date(g.scheduledTime).toLocaleString()} • Aktueller Record: ${currentW}-${currentL}`;
}

function rowHTML(label, w, l, buckets, highlight=false) {
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
    rowHTML('Best Case Scenario', 0, 0, bw.scenarios.best, true) +
    rowHTML('Current Standings',  0, 0, bw.scenarios.current, false) +
    rowHTML('Worst Case Scenario',0, 0, bw.scenarios.worst, false);

  const bestUl  = document.querySelector('#bwBestList');
  const worstUl = document.querySelector('#bwWorstList');
  bestUl.innerHTML  = (bw.picks.best  || []).map(p => `<li>${p.home} vs ${p.away} — <b>${p.choose === 'home' ? p.home : p.away}</b> gewinnt</li>`).join('');
  worstUl.innerHTML = (bw.picks.worst || []).map(p => `<li>${p.home} vs ${p.away} — <b>${p.choose === 'home' ? p.home : p.away}</b> gewinnt</li>`).join('');
}

async function main() {
  // 1) Basis-Kram
  const [probBase, probWin, probLose, nextMd] = await Promise.all([
    loadJSON('./probabilities.json'),
    loadJSON('./probabilities_if_win.json').catch(()=>null),
    loadJSON('./probabilities_if_lose.json').catch(()=>null),
    loadJSON('./next_matchday.json'),
  ]);
  renderMeta(probBase);

  // 2) Next-Game-Box
  const base = pickTeam(probBase, TEAM);
  const win  = probWin  ? pickTeam(probWin,  TEAM) : null;
  const lose = probLose ? pickTeam(probLose, TEAM) : null;

  renderNextHeader(nextMd, base.record.wins, base.record.losses);

  const nextBody = document.querySelector('#nextTableBody');
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

  // 3) Best/Worst-Case-Box
  const bw = await loadJSON('./bestworst_JEN.json').catch(()=>null);
  if (bw) renderBestWorstBox(bw);
  else document.querySelector('#bwCard').insertAdjacentHTML('beforeend', `<p class="muted">Noch keine Best/Worst-Case Daten generiert.</p>`);
}

main().catch(e => alert(`Fehler: ${e.message}`));
