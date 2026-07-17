/* story-concepts.jsx — three "storytelling panel" concepts, all driven by one
   shared year scrubber, using the real family data + relationship engine.
   Concepts: B "Standing in the year" · A "The diary" · C "Two rivers". */
const { useState, useRef, useEffect, useMemo } = React;
const R = window.REL;
const SLOTS = (window.FT_SEED && window.FT_SEED.slots) || {};

// ---------- helpers ----------
function photoFor(id, ei) { const s = SLOTS['ph-' + id + '-e' + ei]; return s ? s.src : null; }
function firstOf(id) { return R.fullName(R.get(id), 'en').split(' ')[0]; }
function lc(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function relLabel(focalId, otherId) {
  try { const r = R.relationOf(focalId, otherId, 'en'); return r || null; } catch (e) { return null; }
}
// latest photo of a person at/just before `year` (fallback earliest)
function portraitAt(id, year) {
  const ev = R.lifeEvents(id, 'en');
  let best = null, first = null;
  ev.forEach(e => {
    if (e.ei == null) return;
    const src = photoFor(id, e.ei); if (!src) return;
    const y = e.effYear != null ? e.effYear : e.year;
    if (!first) first = src;
    if (y <= year) best = src;
  });
  return best || first || null;
}

// ---------- the story engine ----------
// Build one chronological list of beats from the focal person's perspective:
//   scope 'self'   — their own life
//   scope 'family' — a relative's notable event during their lifetime
//   scope 'world'  — a relative's notable event BEFORE they were born (prologue)
function buildBeats(focalId) {
  const focal = R.get(focalId);
  const bYear = focal.birth.year;
  const beats = [];
  // own life — every event
  R.lifeEvents(focalId, 'en').forEach(e => {
    beats.push({
      key: 'self-' + (e.key || e.year + '-' + e.label),
      year: e.effYear != null ? e.effYear : e.year,
      scope: 'self', cat: e.cat, tier: e.tier || 'minor',
      label: e.label, post: e.post || null,
      photo: e.ei != null ? photoFor(focalId, e.ei) : null,
    });
  });
  // relatives — notable beats only, deduped
  const seen = new Set();
  R.F.people.forEach(p => {
    if (p.id === focalId) return;
    const relation = relLabel(focalId, p.id);
    if (!relation) return;
    R.lifeEvents(p.id, 'en').forEach(e => {
      const yr = e.effYear != null ? e.effYear : e.year;
      const keep = e.cat === 'birth' || e.cat === 'death' || e.cat === 'union' ||
        (e.cat === 'self' && e.tier === 'major');
      if (!keep) return;
      // dedupe shared moments (a wedding shows up for both partners)
      let dk = e.cat + '|' + yr + '|' + p.id;
      if (e.cat === 'union') dk = 'union|' + yr + '|' + [p.id, e.refId].sort().join('-');
      if (seen.has(dk)) return; seen.add(dk);
      beats.push({
        key: p.id + '-' + (e.key || yr) + '-' + e.cat,
        year: yr, scope: yr < bYear ? 'world' : 'family',
        cat: e.cat, tier: e.tier || 'minor',
        relation, otherId: p.id, name: R.fullName(p, 'en'), first: firstOf(p.id),
        label: e.label, post: e.post || null,
        photo: e.ei != null ? photoFor(p.id, e.ei) : null,
      });
    });
  });
  beats.sort((a, b) => a.year - b.year || (a.scope === 'self' ? -1 : 1));
  return beats;
}

// narrate a relative beat as a short second-person line
function relLine(b) {
  const who = 'your ' + lc(b.relation) + ' ' + b.first;
  if (b.cat === 'birth') return cap(who) + ' is born.';
  if (b.cat === 'death') return cap(who) + ' dies.';
  if (b.cat === 'union') return cap(who) + ' marries.';
  return cap(who) + ' — ' + lc(b.label) + '.';
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function selfLine(b) {
  if (b.cat === 'birth') return 'You are born — ' + lc(b.label) + '.';
  if (b.cat === 'death') return 'You die — ' + lc(b.label) + '.';
  if (b.cat === 'union') return 'You ' + lc(b.label) + '.';
  return b.label;
}

// ============================================================
// CONCEPT B — "Standing in the year": one present-tense card that
// recomposes as you scrub. The scrubber IS the story engine.
// ============================================================
function ConceptStanding({ focalId, year }) {
  const focal = R.get(focalId);
  const beats = useMemo(() => buildBeats(focalId), [focalId]);
  const bYear = focal.birth.year;
  const status = R.statusAt(focal, year);
  const age = R.ageAt(focal, year);

  // the most recent beat at/just before the year, self preferred
  const past = beats.filter(b => b.year <= year);
  const recent = [...past].reverse().find(b => b.scope === 'self') && past.length
    ? [...past].reverse()[0] : past[past.length - 1];

  // who is around you, right now
  let around = [];
  if (status !== 'unborn') {
    R.F.people.forEach(p => {
      if (p.id === focalId) return;
      const rel = relLabel(focalId, p.id); if (!rel) return;
      const st = R.statusAt(p, year); if (st !== 'living') return;
      around.push({ id: p.id, rel, age: R.ageAt(p, year), name: R.fullName(p, 'en') });
    });
    around.sort((a, b) => b.age - a.age);
    around = around.slice(0, 6);
  }
  // recent losses (deaths in the last 6 years)
  const losses = beats.filter(b => b.cat === 'death' && b.scope !== 'self' &&
    b.year <= year && b.year > year - 7);

  const portrait = status === 'unborn'
    ? (past.filter(b => b.photo).slice(-1)[0] || {}).photo
    : portraitAt(focalId, year);

  const headline = status === 'unborn'
    ? { big: 'Not yet born', sub: 'arrives ' + bYear }
    : status === 'dead'
      ? { big: 'No longer here', sub: 'died ' + focal.death.year + ' · aged ' + (focal.death.year - bYear) }
      : { big: "You're " + age, sub: 'in ' + year };

  return (
    <div className="sc-body standing">
      <div className="st-hero">
        {portrait
          ? <img className="st-photo" src={portrait} alt="" />
          : <div className="st-photo ph">{focal.name.en.split(' ').map(w => w[0]).join('')}</div>}
        <div className={'st-scrim' + (status === 'unborn' ? ' pre' : '')} />
        <div className="st-head">
          <div className="st-big">{headline.big}</div>
          <div className="st-sub">{headline.sub}</div>
        </div>
      </div>

      <div className="st-now">
        {status === 'unborn' ? (
          <p className="st-lead">The family is waiting for you. {recent
            ? cap('your ' + (recent.relation ? lc(recent.relation) + ' ' + recent.first : 'family')) + ' — ' + lc(recent.label) + '.'
            : ''}</p>
        ) : (
          <p className="st-lead">{recent ? (recent.scope === 'self' ? selfLine(recent) : relLine(recent)) : ''}</p>
        )}
      </div>

      {status === 'unborn' && (
        <div className="st-sec">
          <div className="st-sec-h">The world that made you</div>
          {beats.filter(b => b.year <= year && b.tier === 'major').slice(-4).map(b => (
            <div key={b.key} className="st-mini"><span className="st-yr">{b.year}</span>
              <span>{b.scope === 'self' ? selfLine(b) : relLine(b)}</span></div>
          ))}
        </div>
      )}

      {around.length > 0 && (
        <div className="st-sec">
          <div className="st-sec-h">Around you now</div>
          <div className="st-people">
            {around.map(a => (
              <div key={a.id} className="st-person">
                <span className="st-dot" style={{ background: R.get(a.id).sex === 'f' ? 'var(--sex-f)' : 'var(--sex-m)' }} />
                <b>{a.name.split(' ')[0]}</b>
                <span className="st-rel">{lc(a.rel)} · {a.age}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {losses.length > 0 && (
        <div className="st-sec">
          <div className="st-sec-h loss">Recently lost</div>
          {losses.map(b => (
            <div key={b.key} className="st-mini"><span className="st-yr">{b.year}</span>
              <span>{cap('your ' + lc(b.relation) + ' ' + b.first)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONCEPT A — "The diary": a scrolling second-person feed. The scrubber
// auto-scrolls to the matching entry; a prologue holds the pre-birth world.
// ============================================================
function ConceptDiary({ focalId, year }) {
  const beats = useMemo(() => buildBeats(focalId), [focalId]);
  const bYear = R.get(focalId).birth.year;
  const feedRef = useRef(null);
  const rowRefs = useRef({});

  // current entry = last beat at/before year
  const curIdx = (() => { let i = -1; beats.forEach((b, k) => { if (b.year <= year) i = k; }); return i; })();

  useEffect(() => {
    const feed = feedRef.current, row = rowRefs.current[curIdx];
    if (!feed || !row) return;
    const target = row.offsetTop - feed.clientHeight / 2 + row.clientHeight / 2;
    feed.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [curIdx, focalId]);

  const pro = beats.filter(b => b.scope === 'world');
  const life = beats.filter(b => b.scope !== 'world');
  let running = -1;
  const Row = (b) => {
    running++; const idx = running;
    const active = idx === curIdx;
    return (
      <div key={b.key} ref={el => rowRefs.current[idx] = el}
        className={'dy-row ' + b.scope + (active ? ' active' : '') + (b.year > year ? ' future' : '')}>
        <div className="dy-rail"><span className="dy-node" /></div>
        <div className="dy-card">
          <div className="dy-yr">{b.year}{b.scope === 'self' ? '' : ' · ' + b.first}</div>
          <div className="dy-text">{b.scope === 'self' ? selfLine(b) : relLine(b)}</div>
          {active && b.post && <div className="dy-post">{b.post}</div>}
          {active && b.photo && <img className="dy-photo" src={b.photo} alt="" />}
        </div>
      </div>
    );
  };

  return (
    <div className="sc-body diary" ref={feedRef}>
      {pro.length > 0 && <div className="dy-chapter pre">Before you — the world that was waiting</div>}
      {pro.map(Row)}
      <div className="dy-birth"><span>{bYear} · you arrive</span></div>
      {life.map(Row)}
    </div>
  );
}

// ============================================================
// CONCEPT C — "Two rivers": your life on the right, the family around you on
// the left, braided down one time axis. Before birth your lane is a dotted
// "not here yet"; the family lane already flows.
// ============================================================
function ConceptRivers({ focalId, year }) {
  const beats = useMemo(() => buildBeats(focalId), [focalId]);
  const bYear = R.get(focalId).birth.year;
  const feedRef = useRef(null);
  const rowRefs = useRef({});
  const curIdx = (() => { let i = -1; beats.forEach((b, k) => { if (b.year <= year) i = k; }); return i; })();
  useEffect(() => {
    const feed = feedRef.current, row = rowRefs.current[curIdx];
    if (!feed || !row) return;
    feed.scrollTo({ top: Math.max(0, row.offsetTop - feed.clientHeight / 2), behavior: 'smooth' });
  }, [curIdx, focalId]);

  return (
    <div className="sc-body rivers" ref={feedRef}>
      <div className="rv-head"><span>Family around you</span><span className="rv-you">Your life</span></div>
      {beats.map((b, k) => {
        const self = b.scope === 'self';
        const active = k === curIdx;
        return (
          <div key={b.key} ref={el => rowRefs.current[k] = el}
            className={'rv-row' + (active ? ' active' : '') + (b.year > year ? ' future' : '')}>
            <div className="rv-left">{!self && (
              <div className="rv-card fam">
                <div className="rv-text">{relLine(b)}</div>
                {active && b.photo && <img className="rv-photo" src={b.photo} alt="" />}
              </div>
            )}</div>
            <div className="rv-axis"><span className="rv-yr">{b.year}</span><span className="rv-node" /></div>
            <div className="rv-right">{self ? (
              <div className="rv-card you">
                <div className="rv-text">{selfLine(b)}</div>
                {active && b.post && <div className="rv-post">{b.post}</div>}
                {active && b.photo && <img className="rv-photo" src={b.photo} alt="" />}
              </div>
            ) : (b.year < bYear && <div className="rv-dot">not here yet</div>)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Root — shared scrubber + person picker driving all three panels
// ============================================================
const CONCEPTS = [
  { id: 'standing', name: 'Standing in the year', tag: 'B', desc: 'One present-tense card that recomposes as you scrub. The scrubber is the story.', C: ConceptStanding },
  { id: 'diary', name: 'The diary', tag: 'A', desc: 'A second-person feed; scrubbing glides it to the moment. A sepia prologue holds the world before you.', C: ConceptDiary },
  { id: 'rivers', name: 'Two rivers', tag: 'C', desc: 'Your life on the right, the family around you on the left, braided by year.', C: ConceptRivers },
];
const PEOPLE = ['eli', 'rachel', 'leah', 'hannah', 'maya', 'david', 'aaron', 'daniel'];

function Root() {
  const [focalId, setFocalId] = useState('eli');
  const [year, setYear] = useState(() => Math.max(R.MIN_YEAR, R.get('eli').birth.year - 3));
  const focal = R.get(focalId);

  const pick = (id) => { setFocalId(id); setYear(Math.max(R.MIN_YEAR, R.get(id).birth.year - 3)); };

  return (
    <div className="sc-page">
      <header className="sc-top">
        <div className="sc-title">
          <h1>Storytelling panel — concepts</h1>
          <p>One scrubber, three ways to tell <b>{focal.name.en}</b>’s story from their point of view — including before they were born. Drag the timeline.</p>
        </div>
        <div className="sc-pick">
          <span className="sc-pick-lbl">Whose story</span>
          <div className="sc-pick-row">
            {PEOPLE.map(id => (
              <button key={id} className={'sc-chip' + (id === focalId ? ' on' : '')} onClick={() => pick(id)}>
                {R.fullName(R.get(id), 'en').split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="sc-cols">
        {CONCEPTS.map(c => (
          <section key={c.id} className="sc-col">
            <div className="sc-col-h">
              <span className="sc-badge">{c.tag}</span>
              <div><div className="sc-col-name">{c.name}</div><div className="sc-col-desc">{c.desc}</div></div>
            </div>
            <div className="sc-panel"><c.C focalId={focalId} year={year} /></div>
          </section>
        ))}
      </div>

      <footer className="sc-scrub">
        <div className="sc-year">{year}{year < focal.birth.year ? ' · before ' + focal.name.en.split(' ')[0] : year > (focal.death ? focal.death.year : 9999) ? ' · after' : ''}</div>
        <input type="range" min={R.MIN_YEAR} max={R.MAX_YEAR} value={year} onChange={e => setYear(+e.target.value)} />
        <div className="sc-ends"><span>{R.MIN_YEAR}</span><span>{R.MAX_YEAR}</span></div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
