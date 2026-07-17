/* world-room.jsx — "The world outside": full-screen room for world events,
   mirroring the person focus view exactly — slide-projector photo stack on the
   left (wheel/click nav), collapsible World story log on the right, footer with
   prev/next event arrows, and a draggable bottom timeline. Photos ride the
   shared wev-<id> image slots (same ones as the side panel).
   Reuses the .focus / .projector / .post / .prail styles from focus-view. */

function WorldRoom({ evId, year, setYear, onClose }) {
  const R = window.REL;
  const store = window.ImageSlotStore;
  const [wvTick, setWvTick] = React.useState(0); // re-render when toggles flip in the prompts doc
  React.useEffect(() => {
    const f = (e) => { if (!e.key || e.key === window.WEV_ON_KEY) setWvTick(t => t + 1); };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);
  const EV = React.useMemo(() => (window.WORLD_EVENTS || []).slice().sort((a, b) => a.year - b.year), [wvTick]);
  const [filterMajor, setFilterMajor] = React.useState(false);
  const [toggled, setToggled] = React.useState({});
  const railRef = React.useRef(null);
  const logRef = React.useRef(null);
  const postRefs = React.useRef({});
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => store && store.subscribe(() => force()), []);
  // land on the clicked event
  React.useEffect(() => { const e = EV.find(x => x.id === evId); if (e) setYear(e.year); }, [evId]);

  const events = filterMajor ? EV.filter(e => !e.minor) : EV;
  const minY = R.MIN_YEAR, maxY = R.MAX_YEAR, span = Math.max(maxY - minY, 1);
  const clamped = Math.min(Math.max(year, minY), maxY);
  const playPct = ((clamped - minY) / span) * 100;
  const recent = [...events].filter(e => e.year <= year).pop();
  const alive = R.F.people.filter(p => p.birth.year <= year && (!p.death || p.death.year >= year));

  const ticks = [];
  for (let y = Math.ceil(minY / 20) * 20; y <= maxY; y += 20) ticks.push(y);

  // ---- prev/next event navigation + log focus (same pattern as FocusView) ----
  const evYears = React.useMemo(() => [...new Set(events.map(e => e.year))].sort((a, b) => a - b), [events]);
  const prevEvYear = [...evYears].reverse().find(y => y < year);
  const nextEvYear = evYears.find(y => y > year);
  const goEv = (y) => {
    if (y === undefined || y === null) return;
    setYear(y);
    const idx = events.findIndex(e => e.year === y);
    if (idx < 0) return;
    setToggled(t => ({ ...t, [idx]: true }));
  };
  // scrubbing (or nav) → highlight the current event and centre it vertically in the log
  const recentId = recent ? recent.id : null;
  React.useEffect(() => {
    if (recentId == null) return;
    const idx = events.findIndex(e => e.id === recentId);
    const el = postRefs.current[idx], log = logRef.current;
    if (!el || !log) return;
    const r = el.getBoundingClientRect(), lr = log.getBoundingClientRect();
    const top = r.top - lr.top + log.scrollTop - Math.max(14, (log.clientHeight - r.height) / 2);
    log.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [recentId]);
  React.useEffect(() => {
    const h = (ev) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key === 'ArrowRight' && nextEvYear !== undefined) goEv(nextEvYear);
      if (ev.key === 'ArrowLeft' && prevEvYear !== undefined) goEv(prevEvYear);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ---- draggable bottom timeline ----
  const yearFromX = (clientX) => {
    const r = railRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(minY + t * span);
  };
  const railDrag = React.useRef(false);
  const onRailDown = (e) => { railDrag.current = true; railRef.current.setPointerCapture(e.pointerId); setYear(yearFromX(e.clientX)); };
  const onRailMove = (e) => { if (railDrag.current) setYear(yearFromX(e.clientX)); };
  const onRailUp = (e) => { railDrag.current = false; try { railRef.current.releasePointerCapture(e.pointerId); } catch (_) {} };

  return (
    <div className="focus wroom" data-screen-label="The world outside">
      <button className="btn-back floating" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
        Back to tree
      </button>

      <div className="focus-body">
        <div className="focus-left">
          <WorldProjector year={year} onJump={goEv} />
        </div>

        <div className="focus-right">
          <div className="log-filter">
            <span className="lf-title">World story</span>
            <div className="seg-mini">
              <button className={!filterMajor ? 'on' : ''} onClick={() => setFilterMajor(false)}>All {EV.length}</button>
              <button className={filterMajor ? 'on' : ''} onClick={() => setFilterMajor(true)}>Landmarks</button>
            </div>
          </div>
          <div className="post-log" ref={logRef}>
            {events.map((e, i) => {
              const passed = e.year <= year;
              const isNow = recent && recent.id === e.id;
              const slotId = 'wev-' + e.id;
              const hasPhoto = store && store.has(slotId);
              const open = toggled[i] === undefined ? !e.minor : toggled[i];
              return (
                <div key={e.id} ref={(el) => { postRefs.current[i] = el; }}
                  className={'post wv-t-' + e.type + (passed ? '' : ' future') + (isNow ? ' now' : '') + ' clickable' + (open ? ' open' : '')}>
                  <div className="post-top" onClick={() => { setYear(e.year); setToggled(t => ({ ...t, [i]: !open })); }}>
                    <span className="post-year">{e.span ? e.span[0] + '\u2013' + e.span[1] : e.year}</span>
                    <span className="post-icon" style={{ color: 'var(--wv-d)' }}><WvIcon name={e.icon} size={17}></WvIcon></span>
                    <span className={'post-title' + (!e.minor ? ' major' : '')} dir="auto">{e.title}</span>
                    <span className="post-cat">{window.WORLD_EVENT_TYPES[e.type]}</span>
                    {hasPhoto && <span className="post-haspic" title="Has a photo">{'\u25C9'}</span>}
                    <span className="post-chev">{open ? '\u2212' : '\u203a'}</span>
                  </div>
                  {open && (
                    <div className="post-expand">
                      <div className="post-story" dir="auto">{e.long || e.desc}</div>
                      <div className="post-media">
                        {e.img
                          ? <img className="wev-photo" style={{ width: '100%', maxWidth: '300px', height: 'auto' }} src={e.img} alt={e.title} />
                          : (() => {
                              const v = hasPhoto ? (store.get(slotId) || {}) : {};
                              const st = v.w && v.h
                                ? { width: '100%', maxWidth: '300px', height: 'auto', aspectRatio: v.w + ' / ' + v.h }
                                : { width: '100%', maxWidth: '300px', height: '148px' };
                              return <image-slot key={slotId} id={slotId} shape="rounded" radius="12" placeholder={'Add a photo \u00b7 ' + e.short}
                                style={st}></image-slot>;
                            })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="focus-footer">
        <div className="focus-title">
          <span className="focus-name">The world outside</span>
          <span className="focus-life">{EV.length} world events {'\u00b7'} {EV[0].year}{'\u2013'}{EV[EV.length - 1].year}</span>
        </div>
        <div className="focus-sep"></div>
        <div className="focus-now">
          <div className="now-age">{year}<span className="now-year">{recent ? recent.short : 'before it all'}</span></div>
          <div className="now-meta"><span>{alive.length ? alive.length + ' of the family alive' : 'before the family\u2019s story begins'}</span></div>
        </div>
        <div className="wev-avs sm foot-avs">
          {alive.map(p => {
            const nm = R.fullName(p, 'en').split(' ')[0];
            const av = window.autoAvatar ? window.autoAvatar(p.id, year) : { u: null };
            return (
              <span key={p.id} className="wev-av" title={nm}>
                <i style={av.u ? { backgroundImage: 'url(' + av.u + ')' } : null}>{!av.u && nm[0]}</i>
                <b>{nm + ' \u00b7 ' + (year - p.birth.year)}</b>
              </span>
            );
          })}
        </div>
        <div className="ev-nav">
          <button className="ev-btn" disabled={prevEvYear === undefined} onClick={() => goEv(prevEvYear)} title="Previous event" aria-label="Previous event">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          </button>
          <button className="ev-btn" disabled={nextEvYear === undefined} onClick={() => goEv(nextEvYear)} title="Next event" aria-label="Next event">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
          </button>
        </div>
      </div>

      <div className="focus-rail">
        <div className="prail-scale">
          <span>{minY}</span>
          <span className="prail-era">The world outside {'\u00b7'} scrub the century</span>
          <span>{maxY}</span>
        </div>
        <div className="prail" ref={railRef} onPointerDown={onRailDown} onPointerMove={onRailMove} onPointerUp={onRailUp} onPointerLeave={onRailUp}>
          <div className="prail-axis"></div>
          {EV.filter(e => e.span).map(e => (
            <div key={'sp' + e.id} className={'prail-seg wv-t-' + e.type} title={e.short + ' \u00b7 ' + e.span[0] + '\u2013' + e.span[1]}
              style={{ left: ((e.span[0] - minY) / span) * 100 + '%', width: ((e.span[1] - e.span[0]) / span) * 100 + '%',
                background: 'color-mix(in srgb, var(--wv) 30%, transparent)' }}></div>
          ))}
          {ticks.map(t => <div key={t} className="prail-tick" style={{ left: ((t - minY) / span) * 100 + '%' }}><span>{"'" + String(t).slice(2)}</span></div>)}
          {events.map((e, i) => (
            <button key={e.id} className={'prail-dot wv-t-' + e.type + (e.year <= year ? ' passed' : '') + (!e.minor ? ' major' : '')}
              title={e.year + ' \u2014 ' + e.title} onClick={(ev) => { ev.stopPropagation(); goEv(e.year); }}
              style={{ left: ((e.year - minY) / span) * 100 + '%',
                background: e.year <= year ? 'var(--wv)' : 'var(--surface)', borderColor: 'var(--wv-d)' }}></button>
          ))}
          <div className="prail-head" style={{ left: playPct + '%' }}>
            <div className="prail-flag">{clamped}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* slide-projector for world-event photos — same vertical prev/centre/next
   stack as LifeProjector, keyed off the shared wev-<id> slots. */
function WorldProjector({ year, onJump }) {
  const store = window.ImageSlotStore;
  const EV = (window.WORLD_EVENTS || []).slice().sort((a, b) => a.year - b.year);
  const [, force] = React.useReducer(x => x + 1, 0);
  const stageRef = React.useRef(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => store && store.subscribe(() => force()), []);
  React.useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const frames = EV
    .map(e => ({ e, id: 'wev-' + e.id, u: e.img || (store && store.has('wev-' + e.id) ? (store.get('wev-' + e.id) || {}).u : null) }))
    .filter(f => f.u);

  if (frames.length === 0) {
    return (
      <div className="projector">
        <div className="projector-stage" ref={stageRef}>
          <div className="portrait-empty">
            <span style={{ color: 'var(--ink-3)' }}><WvIcon name="globe" size={64}></WvIcon></span>
            <div className="pe-cap">No photos yet</div>
            <div className="pe-sub">Open an event in the world story to add one</div>
          </div>
        </div>
      </div>
    );
  }

  let cur = 0;
  for (let k = 0; k < frames.length; k++) if (year >= frames[k].e.year) cur = k;

  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const H = box.h || 480, W = box.w || 340;
  const STRIP = clampN(Math.round(H * 0.17), 60, 100);
  const GAP = 12;
  const hasPrev = cur > 0, hasNext = cur < frames.length - 1;
  const topRes = hasPrev ? STRIP + GAP : 0;
  const botRes = hasNext ? STRIP + GAP : 0;
  const availH = Math.max(140, H - topRes - botRes);
  const curV = (store && store.get(frames[cur].id)) || {};
  const curAr = curV.w && curV.h ? curV.h / curV.w : 0.72;
  const cH = clampN(Math.round(W * curAr), 140, availH);
  const groupTop = Math.max(0, Math.round((H - (topRes + cH + botRes)) / 2));
  const centreTop = groupTop + topRes;
  const geomFor = (k) => {
    const rel = k - cur;
    if (rel === 0) return { top: centreTop, h: cH, op: 1, z: 30 };
    if (rel === -1) return { top: centreTop - GAP - STRIP, h: STRIP, op: 0.55, z: 20 };
    if (rel === 1) return { top: centreTop + cH + GAP, h: STRIP, op: 0.55, z: 20 };
    if (rel <= -2) return { top: centreTop - GAP - STRIP - (STRIP + GAP) - 4, h: STRIP, op: 0, z: 10 };
    return { top: centreTop + cH + GAP + STRIP + GAP + 4, h: STRIP, op: 0, z: 10 };
  };

  const wheelT = React.useRef(0);
  const onWheel = (e) => {
    const now = Date.now();
    if (now - wheelT.current < 450 || Math.abs(e.deltaY) < 12) return;
    const k = cur + (e.deltaY > 0 ? 1 : -1);
    if (k < 0 || k >= frames.length) return;
    wheelT.current = now;
    onJump && onJump(frames[k].e.year);
  };

  const curEv = frames[cur].e;
  return (
    <div className="projector">
      <div className="projector-stage" ref={stageRef} onWheel={onWheel} style={{ '--pf-dur': '0.45s' }}>
        {frames.map((f, k) => {
          if (Math.abs(k - cur) > 2) {
            const off = k < cur ? centreTop - 2 * (STRIP + GAP) - 4 : centreTop + cH + 2 * GAP + STRIP + 4;
            return <div key={f.id} className="pframe" aria-hidden="true"
              style={{ top: off + 'px', height: STRIP + 'px', opacity: 0, zIndex: 1, pointerEvents: 'none' }}>
              <img src={f.u} alt="" draggable="false" /></div>;
          }
          const g = geomFor(k);
          return (
            <div key={f.id} className={'pframe' + (k !== cur ? ' side' : '')} aria-hidden={k !== cur}
              onClick={() => onJump && onJump(f.e.year)}
              title={f.e.year + ' \u2014 ' + f.e.title}
              style={{ top: g.top + 'px', height: g.h + 'px', opacity: g.op, zIndex: g.z, cursor: 'pointer' }}>
              <img src={f.u} alt="" draggable="false" />
            </div>
          );
        })}
      </div>
      <div className={'era-label wv-t-' + curEv.type}>
        <span className="era-dot" style={{ background: 'var(--wv)' }}></span>
        <span dir="auto">{curEv.title}</span>
        <span className="era-years">{curEv.year}</span>
      </div>
    </div>
  );
}
Object.assign(window, { WorldRoom, WorldProjector });
