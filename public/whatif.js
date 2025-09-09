// What-If Seite für JEN: "Next Game" + drei Szenarien (Win / Current / Lose)
// nutzt: probabilities.json, probabilities_if_win.json, probabilities_if_lose.json, next_matchday.json

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
  // rankPct keys evtl. als String -> in Zahlen konvertieren
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
  const meta = document.querySelector('#meta');
  meta.textContent = `Stand: ${new Date(probBase.generatedAt).toLocaleString()} • Iterations: ${probBase.iterations} • Nächster Spieltag: #${probBase.nextMatchday}`;
}

function findJenaNextGame(nextMdPayload) {
  return nextMdPayload.games.find(g => g.home.tlc === TEAM || g.away.tlc === TEAM);
}

function renderNextHeader(nextMdPayload, currentW, currentL) {
  const g = findJenaNextGame(nextMdPayload);
  const title = document.querySelector('#nextTitle');
  const info = document.querySelector('#nextInfo');

  if (!g) {
    title.textContent = `Nächstes Spiel`;
    info.textContent = `Jena spielt an Spieltag #${nextMdPayload.matchDay} nicht. Aktueller Record: ${currentW}-${currentL}.`;
    return;
  }

  const home = g.home.tlc === TEAM;
  const opp = home ? `${g.away.tlc} (${g.away.name})` : `${g.home.tlc} (${g.home.name})`;
  const vs = home ? `vs` : `@`;

  title.textContent = `Nächstes Spiel – ${vs} ${opp}`;
  info.textContent = `Spieltag #${g.matchDay} • ${new Date(g.scheduledTime).toLocaleString()} • Aktueller Record: ${currentW}-${currentL}`;
}

function rowHTML(label, w, l, buckets, highlight=false) {
  return `
    <tr class="${highlight ? 'hlrow' : ''}">
      <td class="center">${label}</td>
      <td class="center">${w}</td>
      <td class="center">${l}</td>
      <td class="center">${fmtPct(buckets.playoffs)}</td>
      <td class="center">${fmtPct(buckets.playin)}</td>
      <td class="center">${fmtPct(buckets.mid)}</td>
      <td class="center">${fmtPct(buckets.releg)}</td>
    </tr>
  `;
}

async function main() {
  // Basis + konditionale Wahrscheinlichkeiten laden
  const [probBase, probWin, probLose, nextMd] = await Promise.all([
    loadJSON('./probabilities.json'),
    loadJSON('./probabilities_if_win.json').catch(()=>null),
    loadJSON('./probabilities_if_lose.json').catch(()=>null),
    loadJSON('./next_matchday.json'),
  ]);

  renderMeta(probBase);

  // Teamdaten extrahieren
  const base = pickTeam(probBase, TEAM);
  const win  = probWin  ? pickTeam(probWin,  TEAM) : null;
  const lose = probLose ? pickTeam(probLose, TEAM) : null;

  // Header: Gegner + aktueller Record
  renderNextHeader(nextMd, base.record.wins, base.record.losses);

  // Tabelle aufbauen (Resultant Record: nur nächstes Spiel)
  const tbody = document.querySelector('#nextTableBody');
  const wNext = base.record.wins + 1;
  const lNext = base.record.losses + 0;
  const wLose = base.record.wins + 0;
  const lLose = base.record.losses + 1;

  let html = '';
  if (win)  html += rowHTML('Win Next Game',  wNext, lNext, win.buckets, true);
  html += rowHTML('Current Standings', base.record.wins, base.record.losses, base.buckets, false);
  if (lose) html += rowHTML('Lose Next Game', wLose, lLose, lose.buckets, false);
  tbody.innerHTML = html;
}

main().catch(e => alert(`Fehler: ${e.message}`));
