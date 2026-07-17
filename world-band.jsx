/* world-band.jsx — the "horizon whispers" band above the scrubber (concept C2).
   Always-on scattered star constellation; near the playhead, events bloom into
   icon + short title. Crowding is collision-culled: landmarks win over minors,
   nearer wins over farther, max 3 blooms at once. Hover anything → whisper tip
   with the full story + a live family line. Data lives in world-events.js. */

/* Phosphor icons (viewBox 256). Default weight FILL; variant="outline" for regular. */
function WvIcon({ name, size, variant }) {
  const ic = window.WORLD_ICONS[name] || {};
  return <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d={(variant === 'outline' ? ic.o : ic.f) || ''}></path>
  </svg>;
}

function wvFamLine(R, personId, y) {
  if (personId) {
    const p = R.get(personId); if (!p) return '';
    const nm = R.fullName(p, 'en').split(' ')[0];
    const b = p.birth.year, d = p.death && p.death.year;
    if (y < b) return nm + ' is born ' + (b - y) + (b - y === 1 ? ' year' : ' years') + ' later';
    if (d && y > d) return nm + ' passed ' + (y - d) + (y - d === 1 ? ' year' : ' years') + ' earlier';
    return nm + ' is ' + (y - b);
  }
  const n = window.REL.F.people.filter(p => p.birth.year <= y && (!p.death || p.death.year >= y)).length;
  return n ? n + ' of the family alive that year' : 'before the family\u2019s story begins';
}

function WorldHorizon({ disp, min, max, trackW, personId, openId }) {
  const R = window.REL;
  const EV = window.WORLD_EVENTS || [];
  const [hover, setHover] = React.useState(null); // event id
  const [, setWvTick] = React.useState(0); // re-render when toggles flip in the prompts doc
  React.useEffect(() => {
    const f = (e) => { if (!e.key || e.key === window.WEV_ON_KEY) setWvTick(t => t + 1); };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);
  const X = (y) => ((y - min) / (max - min)) * 100;
  const pxOf = (y) => (X(y) / 100) * (trackW || 1200);
  // ---- collision-culled blooms: landmarks first, then nearest; max 3 ----
  const kept = [];
  const cand = EV.map(e => ({ e, d: Math.abs(e.year - disp), win: e.minor ? 9 : 13 }))
    .filter(v => v.d < v.win)
    .sort((a, b) => ((a.e.minor ? 1 : 0) - (b.e.minor ? 1 : 0)) || (a.d - b.d));
  for (const v of cand) {
    if (kept.length >= 3) break;
    const w = v.e.minor ? 30 : 34 + v.e.short.length * 8.5;
    const x = pxOf(v.e.year), lo = x - w / 2 - 12, hi = x + w / 2 + 12;
    if (!kept.some(k => lo < k.hi && hi > k.lo)) kept.push({ ...v, lo, hi });
  }
  const keptIds = new Set(kept.map(k => k.e.id));
  const hovEv = hover && EV.find(e => e.id === hover);
  const markEv = hovEv || (openId && EV.find(e => e.id === openId)) || null;
  const openEv = (id) => { setHover(null); window.dispatchEvent(new CustomEvent('ft-world-open', { detail: id })); };
  return (
    <React.Fragment>
    <div className="world-band">
      {EV.map((e, i) => {
        const jit = ((e.year * 13) % 7) - 3;
        const soff = Math.max(-9, Math.min(9, (e.year - disp) * .4));
        return (
          <span key={e.id} className={'wv-star wv-t-' + e.type + (i % 3 === 1 ? ' dot' : '') + (e.id === openId ? ' open' : '')}
            style={{ left: X(e.year) + '%', bottom: ((i % 2 ? 16 : 4) + jit) + 'px',
              transform: 'translateX(calc(-50% + ' + soff + 'px))' }}
            onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(h => h === e.id ? null : h)}
            onClick={() => openEv(e.id)}>
            <i></i>
          </span>
        );
      })}
      {EV.map(e => {
        const d = Math.abs(e.year - disp), win = e.minor ? 9 : 13;
        const o = keptIds.has(e.id) ? Math.max(0, 1 - d / win) : 0;
        const off = Math.max(-26, Math.min(26, (e.year - disp) * (e.minor ? .9 : 1.8)));
        return (
          <span key={e.id} className={'wv-bloom wv-t-' + e.type}
            style={{ left: X(e.year) + '%', bottom: '42px', opacity: o,
              pointerEvents: o > .15 ? 'auto' : 'none',
              transform: 'translateX(calc(-50% + ' + off + 'px))' }}
            onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(h => h === e.id ? null : h)}
            onClick={() => openEv(e.id)}>
            <WvIcon name={e.icon} size={e.minor ? 14 : 15}></WvIcon>
            {!e.minor && <span className="wv-name">{e.short}</span>}
          </span>
        );
      })}
      {hovEv && (
        <div className={'wv-tip wv-t-' + hovEv.type}
          style={{ left: 'clamp(135px, ' + X(hovEv.year) + '%, calc(100% - 135px))' }}>
          <div className="ty">{hovEv.year + ' · ' + window.WORLD_EVENT_TYPES[hovEv.type]}</div>
          <div className="tn">{hovEv.title}</div>
          {hovEv.img && <img src={hovEv.img} alt={hovEv.title} />}
          <div className="tm">{hovEv.desc}</div>
          <div className="tf">{wvFamLine(R, personId, hovEv.year)}</div>
        </div>
      )}
    </div>
    {markEv && (markEv.span
      ? <div className={'wv-mark wv-t-' + markEv.type}
          style={{ left: X(markEv.span[0]) + '%', width: (X(markEv.span[1]) - X(markEv.span[0])) + '%' }}></div>
      : <div className={'wv-mark point wv-t-' + markEv.type} style={{ left: X(markEv.year) + '%' }}></div>)}
    </React.Fragment>
  );
}
window.WorldHorizon = WorldHorizon;

/* side panel for a clicked world event — a MINI PROJECTOR: prev/centre/next
   photo stack (like the full-screen projector) + sliding text. Scrub-reactive:
   once the timeline moves, it follows the most recent event ≤ the scrub year. */
function WorldEventDrawer({ evId, year, setYear, personId, onClose, onOpenRoom }) {
  const EV = React.useMemo(() => (window.WORLD_EVENTS || []).slice().sort((a, b) => a.year - b.year), []);
  const clicked = EV.find(x => x.id === evId);
  const first = React.useRef(year);
  const scrubbed = year !== first.current;
  const recent = [...EV].filter(x => x.year <= year).pop();
  const e = (scrubbed && recent) ? recent : clicked;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => window.ImageSlotStore && window.ImageSlotStore.subscribe(() => force()), []);
  const wheelT = React.useRef(0);
  if (!e) return null;
  const R = window.REL;
  const cur = EV.indexOf(e);
  // mini stage geometry — both strips always reserved so the centre stays put
  const STRIP = 46, GAP = 10, CH = 190, H = STRIP + GAP + CH + GAP + STRIP;
  const geomFor = (k) => {
    const rel = k - cur;
    if (rel === 0) return { top: STRIP + GAP, h: CH, op: 1, z: 30 };
    if (rel === -1) return { top: 0, h: STRIP, op: 0.55, z: 20 };
    if (rel === 1) return { top: STRIP + GAP + CH + GAP, h: STRIP, op: 0.55, z: 20 };
    if (rel <= -2) return { top: -(STRIP + GAP + 4), h: STRIP, op: 0, z: 10 };
    return { top: H + GAP + 4, h: STRIP, op: 0, z: 10 };
  };
  const onWheel = (ev) => {
    const now = Date.now();
    if (now - wheelT.current < 450 || Math.abs(ev.deltaY) < 12) return;
    const k = cur + (ev.deltaY > 0 ? 1 : -1);
    if (k < 0 || k >= EV.length) return;
    wheelT.current = now;
    setYear(EV[k].year);
  };
  const store = window.ImageSlotStore;
  return (
    <div className={'drawer wev-drawer wv-t-' + e.type}>
      <button className="x-btn float" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
      <div className="drawer-body">
        <div className="wev-stage" style={{ height: H + 'px' }} onWheel={onWheel}>
          {EV.map((ev2, k) => {
            const g = geomFor(k);
            const off = Math.abs(k - cur) > 1;
            const sv = store && store.has('wev-' + ev2.id) ? (store.get('wev-' + ev2.id) || {}) : null;
            const u = ev2.img || (sv && sv.u);
            return (
              <div key={ev2.id} className={'pframe' + (k !== cur ? ' side' : '')} aria-hidden={k !== cur}
                title={ev2.year + ' \u2014 ' + ev2.title}
                onClick={k !== cur ? () => setYear(ev2.year) : undefined}
                style={{ top: g.top + 'px', height: g.h + 'px', opacity: g.op, zIndex: g.z,
                  pointerEvents: off ? 'none' : 'auto', cursor: k !== cur ? 'pointer' : 'default' }}>
                {u ? <img src={u} alt="" draggable="false" />
                   : (k === cur
                      ? <image-slot key={'wev-' + ev2.id} id={'wev-' + ev2.id} shape="rounded" radius="13" placeholder={'Add a photo \u00b7 ' + ev2.short}
                          style={{ width: '100%', height: '100%', display: 'block' }}></image-slot>
                      : <div className={'wev-blank wv-t-' + ev2.type}><span className="wb-med"><WvIcon name={ev2.icon} size={16}></WvIcon></span></div>)}
              </div>
            );
          })}
        </div>
        <div className="wev-text">
          <div className="wev-meta">
            <span className="wev-chip"><WvIcon name={e.icon} size={13}></WvIcon>{window.WORLD_EVENT_TYPES[e.type]}</span>
            <span className="wev-year">{e.span ? e.span[0] + '\u2013' + e.span[1] : e.year}</span>
          </div>
          <h3 className="wev-title">{e.title}</h3>
          <p className="wev-desc">{e.long || e.desc}</p>
          <div className="wev-fam">
            <div className="wev-fam-line">{wvFamLine(R, personId, e.year)}</div>
          </div>
        </div>
      </div>
      <div className="drawer-foot wev-foot">
        <button className="cta" onClick={() => onOpenRoom(e.id)}>
          Open the world projector
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"></rect><path d="M9 21h6"></path></svg>
        </button>
      </div>
    </div>
  );
}
window.WorldEventDrawer = WorldEventDrawer;
