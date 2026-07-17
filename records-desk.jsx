/* records-desk.jsx — Records Room overview ("the desk"): score, stat tiles, coverage,
   do-next list, since-last-save feed. Merges the old Health screen. Editor mode only. */

const rrdI = (paths, sz) => (
  <svg width={sz || 15} height={sz || 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths.map((d, i) => <path key={i} d={d}></path>)}</svg>
);
const rrdIcons = {
  people: ["M9 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2", "M16 3.13a4 4 0 0 1 0 7.75", "M21 21v-2a4 4 0 0 0 -3 -3.85"],
  calev: ["M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z", "M16 3v4", "M8 3v4", "M4 11h16", "M8 15h2v2h-2z"],
  photo: ["M15 8h.01", "M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z", "M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5", "M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"],
  flag: ["M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z", "M5 21v-7"],
  pencil: ["M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4", "M13.5 6.5l4 4"],
  lang: ["M4 5h7", "M9 3v2c0 4.418 -2.239 8 -5 8", "M5 9c0 2.144 2.952 3.908 6.7 4", "M12 20l4 -9l4 9", "M19.1 18h-6.2"],
  cal: ["M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z", "M16 3v4", "M8 3v4", "M4 11h16", "M11 15h1", "M12 15v3"],
  crop: ["M8 5v10a1 1 0 0 0 1 1h10", "M5 8h10a1 1 0 0 1 1 1v10"],
  exch: ["M21 7l-18 0", "M6 10l-3 -3l3 -3", "M3 17l18 0", "M18 20l3 -3l-3 -3"],
  pin: ["M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0", "M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"],
};

function rrdAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}
const rrdPct = (a, b) => (b ? Math.round((a / b) * 100) : 100);

function rrdStats() {
  const R = window.REL, S = window.FTStore, IS = window.ImageSlotStore;
  const people = window.FAMILY.people;
  const slotIds = new Set(Object.keys((window.FT_SEED && window.FT_SEED.slots) || {}));
  (IS && IS.ids ? IS.ids() : []).forEach((id) => slotIds.add(id));
  let evTotal = 0, phFilled = 0, edN = 0, stN = 0, heAble = 0, heN = 0, undated = 0, avAble = 0, avDone = 0;
  const perPerson = [], issues = [];
  const nowYr = new Date().getFullYear();
  people.forEach((p) => {
    const name = R.fullName(p, 'en'), first = name.split(' ')[0];
    const evs = R.lifeEvents(p.id, 'en');
    const endY = p.death ? p.death.year : nowYr;
    const lived = Math.max(0, endY - p.birth.year);
    let ph = 0, ed = 0, st = 0, ha = 0, he = 0, und = 0, lastY = p.birth.year;
    evs.forEach((e) => {
      evTotal++;
      if (window.rrSlotSrc('ph-' + p.id + '-e' + e.ei)) { ph++; phFilled++; }
      if (e.mid && e.year == null) { und++; undated++; issues.push({ sev: 'warn', ic: 'cal', tx: <span><b>“{e.label || 'Untitled moment'}”</b> ({first}) is undated — placed {e.yearLabel || 'by order'}</span>, act: 'Set year', pid: p.id }); }
      if (e.year != null && e.year > lastY) lastY = e.year;
      const editable = e.mid || (e.derived && e.cat === 'self');
      if (editable) {
        edN++; ed++;
        if (e.post) { stN++; st++; heAble++; ha++; if (e.hePost) { heN++; he++; } }
      }
    });
    if (ph) { avAble++; if ([...slotIds].some((id) => id.indexOf('av-' + p.id + '-') === 0)) avDone++; }
    else issues.push({ sev: lived >= 10 ? 'bad' : 'warn', ic: 'photo', tx: <span><b>{name}</b> has no photos at all</span>, act: 'Open record', pid: p.id });
    const expected = Math.min(5, Math.max(3, Math.round(lived / 12)));
    if (lived >= 16 && evs.length < expected) issues.push({ sev: 'warn', ic: 'people', tx: <span><b>{name}</b> has only {evs.length} life events across {lived} years — thin records read as gaps</span>, act: 'Open record', pid: p.id });
    if (!p.death && lived >= 12 && nowYr - lastY > 8) issues.push({ sev: 'warn', ic: 'cal', tx: <span><b>{name}</b> has been quiet since {lastY} — nothing recorded in {nowYr - lastY} years</span>, act: 'Open record', pid: p.id });
    const dims = [rrdPct(ph, evs.length), rrdPct(evs.length - und, evs.length)];
    if (ed) dims.push(rrdPct(st, ed));
    if (ha) dims.push(rrdPct(he, ha));
    perPerson.push({ pid: p.id, p, name, lived, pct: Math.round(dims.reduce((a, b) => a + b, 0) / dims.length), evs: evs.length, ph });
  });
  let orphans = 0;
  slotIds.forEach((id) => {
    const m = /^ph-(.+)-e(\d+)$/.exec(id);
    if (!m || !window.rrSlotSrc(id)) return;
    const p = R.byId[m[1]];
    const ev = p && R.lifeEvents(m[1], 'en').find((x) => x.ei === +m[2]);
    if (!ev) { orphans++; issues.push({ sev: 'bad', ic: 'photo', tx: <span><b>{id}</b> points at an event that no longer exists</span>, act: 'Photos →', screen: 'photos' }); }
  });
  (window.FAMILY.unions || []).forEach((u) => {
    if (!u.year) issues.push({ sev: 'bad', ic: 'exch', tx: <span>Marriage <b>{R.fullName(R.get(u.a), 'en').split(' ')[0]} &amp; {R.fullName(R.get(u.b), 'en').split(' ')[0]}</b> has no year</span>, act: 'Open record', pid: u.a });
  });
  const noStory = edN - stN, missingHe = heAble - heN;
  if (noStory) issues.push({ sev: 'warn', ic: 'pencil', tx: <span><b>{noStory} event{noStory > 1 ? 's' : ''}</b> {noStory > 1 ? 'have' : 'has'} no story text yet</span>, act: 'People →', screen: 'people' });
  if (missingHe) issues.push({ sev: 'warn', ic: 'lang', tx: <span><b>{missingHe} stor{missingHe > 1 ? 'ies are' : 'y is'}</b> still missing Hebrew</span>, act: 'People →', screen: 'people' });
  issues.sort((a, b) => (a.sev === 'bad' ? 0 : 1) - (b.sev === 'bad' ? 0 : 1));
  const cov = [
    ['Photos', 'photo', rrdPct(phFilled, evTotal)],
    ['Stories', 'pencil', rrdPct(stN, edN)],
    ['Translation', 'lang', rrdPct(heN, heAble)],
    ['Dates', 'cal', rrdPct(evTotal - undated, evTotal)],
    ['Avatar crops', 'crop', rrdPct(avDone, avAble)],
  ];
  const score = Math.round(0.3 * cov[0][2] + 0.2 * cov[1][2] + 0.2 * cov[2][2] + 0.2 * cov[3][2] + 0.1 * cov[4][2]);
  perPerson.sort((a, b) => a.pct - b.pct);
  const grown = perPerson.filter((x) => x.lived >= 10);
  const pool = grown.length ? grown : perPerson;
  const thin = pool.filter((x) => x.pct < 70).length;
  const worldAll = window.WORLD_EVENTS_ALL || [];
  return {
    score, cov, issues, undated, orphans, thin,
    people: people.length, evTotal, phFilled,
    worldN: worldAll.length, worldOn: worldAll.filter((e) => S.worldOn(e)).length,
    spotlight: pool[0],
  };
}

/* animated score card — the logo tree grows while the number climbs; click replays */
function RrdScore({ score, note }) {
  const box = React.useRef(null), api = React.useRef(null);
  React.useEffect(() => {
    let dead = false;
    fetch('assets/logo-myfamily.svg').then((r) => r.text()).then((txt) => {
      if (dead || !box.current) return;
      const holder = box.current.querySelector('.rrd-tree');
      holder.innerHTML = txt;
      const svg = holder.querySelector('svg');
      svg.setAttribute('width', '118'); svg.setAttribute('height', '82'); svg.style.display = 'block';
      const leaves = [], structure = []; let sun = null;
      [].slice.call(svg.querySelectorAll('path')).forEach((p) => {
        const f = (p.getAttribute('fill') || '').toLowerCase();
        if (f.indexOf('url(') === 0) { sun = p; }
        else if (f === '#5c5d2d') { leaves.push(p); p.style.transformBox = 'fill-box'; p.style.transformOrigin = 'center'; }
        else { const bb = p.getBBox(); if (bb.width > 80 || bb.height < 35) p.remove(); else structure.push(p); }
      });
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      structure.forEach((p) => g.appendChild(p)); svg.appendChild(g);
      g.style.transformBox = 'fill-box'; g.style.transformOrigin = '50% 100%';
      const num = box.current.querySelector('.rrd-huge'), bar = box.current.querySelector('.rrd-bar i');
      let raf = 0;
      const play = () => {
        g.style.transition = 'none'; g.style.transform = 'scale(.05)';
        leaves.forEach((p) => { p.style.transition = 'none'; p.style.transform = 'scale(0)'; });
        if (sun) { sun.style.transition = 'none'; sun.style.opacity = '0'; }
        bar.style.transition = 'none'; bar.style.width = '0%'; num.textContent = '0';
        void svg.getBoundingClientRect();
        requestAnimationFrame(() => {
          g.style.transition = 'transform 1.3s cubic-bezier(.3,.9,.35,1)'; g.style.transform = 'scale(1)';
          leaves.forEach((p, i) => { p.style.transition = 'transform .55s ' + (0.7 + i * 0.11) + 's cubic-bezier(.34,1.56,.64,1)'; p.style.transform = 'scale(1)'; });
          if (sun) { sun.style.transition = 'opacity 1.4s 1.2s ease-out'; sun.style.opacity = '0.8'; }
          bar.style.transition = 'width 2s .2s ease-out'; bar.style.width = score + '%';
          cancelAnimationFrame(raf);
          const t0 = performance.now(), D = 2000;
          (function tick(t) { const k = Math.min(1, ((t || performance.now()) - t0) / D); num.textContent = Math.round(score * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); })();
        });
      };
      api.current = play; play();
    }).catch(() => {});
    return () => { dead = true; };
  }, []);
  return (
    <div className="rr-card rrd-score" ref={box} title="Replay" onClick={() => api.current && api.current()}>
      <div className="rrd-tree"></div>
      <div className="rrd-huge">{score}</div>
      <div className="rrd-of">of 100</div>
      <div className="rrd-barwrap"><div className="rrd-bar"><i></i></div></div>
      <div className="rrd-note">{note}</div>
    </div>
  );
}

window.RrDesk = function RrDesk({ jumpPerson, setScreen, onOpenPublish, onClose }) {
  const R = window.REL, S = window.FTStore;
  const st = rrdStats();
  const h = new Date().getHours();
  const greet = h < 5 ? 'Working late, archivist' : h < 12 ? 'Good morning, archivist' : h < 18 ? 'Good afternoon, archivist' : 'Good evening, archivist';
  const gens = new Set(window.FAMILY.people.map((p) => p.gen)).size;
  const ops = S.doc.ops || [];
  const lastOp = ops.length ? ops[ops.length - 1] : null;
  const pending = S.pendingOps().slice(-4).reverse();
  const n = S.pendingOps().length;
  const weakest = st.cov.slice().sort((a, b) => a[2] - b[2])[0];
  const note = weakest[2] >= 95 ? 'The record is nearly whole.' : `${weakest[0]} ${weakest[0] === 'Photos' || weakest[0] === 'Stories' || weakest[0] === 'Dates' ? 'are' : 'is'} the biggest gap — ${weakest[2]}% covered.`;
  const go = (i) => (i.pid ? jumpPerson(i.pid) : setScreen(i.screen || 'people'));
  const opIc = (k) => k === 'edit' ? 'pencil' : (k === 'tree-hide' || k === 'tree-show') ? 'flag' : (k || '').indexOf('moment') === 0 ? 'pencil' : 'photo';
  const sp = st.spotlight;
  return (
    <div className="rr-detail">
      <div className="rrd">
        <div className="rrd-head">
          <div>
            <button type="button" className="rrd-backtop" onClick={onClose}>← Back to the tree</button>
            <h1>{greet}</h1>
            <div className="rrd-sub">{gens} generations · {R.MIN_YEAR} → today{lastOp ? ` · last edit ${rrdAgo(lastOp.ts)}` : ''}</div>
          </div>
          <button className={'rrd-save' + (n ? ' dirty' : '')} onClick={onOpenPublish}>{n ? `Save · ${n} change${n > 1 ? 's' : ''}` : `v${S.doc.baseV || '–'} · in sync`}</button>
        </div>
        <div className="rrd-grid">
          <RrdScore score={st.score} note={note} />
          <div className="rrd-stats">
            <button className="rrd-stat" onClick={() => setScreen('people')}><span className="rrd-tico">{rrdI(rrdIcons.people)}</span><span className="rrd-big">{st.people}</span><span className="rrd-lab">People</span><span className={'rr-chip ' + (st.thin ? 'warn' : 'ok')}>{st.thin ? st.thin + ' thin record' + (st.thin > 1 ? 's' : '') : 'all filled in'}</span></button>
            <button className="rrd-stat" onClick={() => setScreen('people')}><span className="rrd-tico">{rrdI(rrdIcons.calev)}</span><span className="rrd-big">{st.evTotal}</span><span className="rrd-lab">Life events</span><span className={'rr-chip ' + (st.undated ? 'warn' : 'ok')}>{st.undated ? st.undated + ' undated' : 'all dated'}</span></button>
            <button className="rrd-stat" onClick={() => setScreen('photos')}><span className="rrd-tico">{rrdI(rrdIcons.photo)}</span><span className="rrd-big">{st.phFilled}<i>/{st.evTotal}</i></span><span className="rrd-lab">Photos in slots</span><span className={'rr-chip ' + (st.orphans ? 'hidden' : 'ok')}>{st.orphans ? st.orphans + ' orphaned' : 'none orphaned'}</span></button>
            <button className="rrd-stat" onClick={() => setScreen('world')}><span className="rrd-tico">{rrdI(rrdIcons.flag)}</span><span className="rrd-big">{st.worldN}</span><span className="rrd-lab">World events</span><span className="rr-chip info">{st.worldOn + ' on the band'}</span></button>
          </div>
          <div className="rr-card rrd-col3">
            <div className="rrd-ch">Coverage</div>
            <div className="rrd-gwrap">
              {st.cov.map(([lab, ic, pct]) => (
                <div className="rrd-g" key={lab}>
                  <span className="rrd-glab"><span className="rrd-gico">{rrdI(rrdIcons[ic], 12)}</span>{lab}</span>
                  <span className="rrd-meter"><i style={{ width: pct + '%', background: pct >= 85 ? 'var(--green, #4C9A6B)' : 'var(--amber, #B07D2B)' }}></i></span>
                  <span className="rrd-pct">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rr-card rrd-r2">
            <div className="rrd-ch">Since last save {n ? <span className="rr-chip info">{n} unsaved</span> : <span className="rr-chip ok">in sync</span>}</div>
            {pending.map((op) => (
              <div className="rrd-row" key={op.ts}><span className="rrd-gico">{rrdI(rrdIcons[opIc(op.kind)], 12)}</span><span className="rrd-rtx"><b>{op.label || op.kind}</b></span><span className="rrd-when">{rrdAgo(op.ts)}</span></div>
            ))}
            {!pending.length && <div className="rrd-row soft">{'Everything is saved into v' + (S.doc.baseV || '–') + '.'}</div>}
          </div>
          <div className="rr-card rrd-r2">
            <div className="rrd-ch">Spotlight · thinnest record</div>
            {sp && (
              <div className="rrd-spot">
                {window.RrAvatar ? <window.RrAvatar pid={sp.pid} size={52} /> : null}
                <span className="rrd-sptx">
                  <span className="rrd-spname">{sp.name} <span className={'rr-chip ' + (sp.pct < 70 ? 'warn' : 'ok')}>{sp.pct}% whole</span></span>
                  <span className="rrd-spsub">{sp.p.death ? `${sp.p.birth.year}–${sp.p.death.year}` : 'b. ' + sp.p.birth.year} · {sp.p.birth.place || '—'} · {sp.evs} events, {sp.ph} photo{sp.ph !== 1 ? 's' : ''}</span>
                </span>
                <button className="rr-go" onClick={() => jumpPerson(sp.pid)}>Open →</button>
              </div>
            )}
          </div>
          <div className="rr-card rrd-r2">
            <div className="rrd-ch">Do next {st.issues.length ? <span className="rr-chip warn">{st.issues.length} item{st.issues.length > 1 ? 's' : ''}</span> : <span className="rr-chip ok">all clear</span>}</div>
            <div className="rrd-tasks">
              {st.issues.map((i, k) => (
                <button className="rrd-task" key={k} onClick={() => go(i)}>
                  <span className={'rr-ic ' + i.sev}>{rrdI(rrdIcons[i.ic || 'pencil'], 13)}</span>
                  <span className="rrd-rtx">{i.tx}</span>
                  <span className="rr-go">{i.act}</span>
                </button>
              ))}
              {!st.issues.length && <div className="rrd-row soft">Every record has photos, stories and dates.</div>}
            </div>
          </div>
          <div className="rr-card rrd-r2">
            <div className="rrd-ch">Start your own family record</div>
            <div className="rrd-row soft" style={{ padding: '2px 0 10px' }}>Done exploring the Adlers? Ask Claude in the project chat to clear the demo and keep the app - then build your family from scratch.</div>
            <button className="rr-btn" onClick={(e) => {
              const btn = e.currentTarget;
              const ask = 'Clear the demo Adler family - all people, photos, stories and world-event edits - but keep the app fully working. Then help me start my own family record: I\'ll tell you who\'s in the family.';
              navigator.clipboard && navigator.clipboard.writeText(ask).then(() => { btn.textContent = 'Copied - paste it to Claude in the chat'; setTimeout(() => { btn.textContent = 'Copy the ask for Claude'; }, 2600); }).catch(() => {});
            }}>Copy the ask for Claude</button>
          </div>
        </div>
      </div>
    </div>
  );
};
