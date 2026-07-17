/* focus-view.jsx — single-person life screen
   layout: header (name + live status) · body (big portrait + story posts + mini side-card)
           · bottom personal timeline (draggable scrubber) */

function eraOf(age) { return age < 22 ? 'young' : age < 59 ? 'adult' : 'elder'; }
const ERA_LABEL = { young: 'Childhood & youth', adult: 'Adulthood', elder: 'Later years' };
const ERAS = ['young', 'adult', 'elder'];
const ERA_START = { young: 0, adult: 22, elder: 59 };
const CAT_COLOR = {
  birth: 'var(--amber)', self: 'var(--ink-2)', union: 'var(--amber-d)',
  family: 'var(--blue)', loss: 'var(--plum)', death: 'var(--ink)',
};
const CAT_FILL = {
  birth: 'var(--amber)', self: 'var(--surface)', union: 'var(--amber-subtle)',
  family: 'var(--blue)', loss: 'var(--plum)', death: 'var(--ink)',
};

// One icon per milestone type. The first three (baby / ring / carriage) are the
// user-supplied SVGs; star / people / heart / leaf fill in the rest in the same
// Phosphor-bold weight. Keyed off a milestone's cat (+ kind to split
// child vs sibling, which share the "family" category).
const MS_ICONS = {
  baby: { vb: '0 0 256 256', d: 'M92,144a16,16,0,1,1,16-16A16,16,0,0,1,92,144Zm72-32a16,16,0,1,0,16,16A16,16,0,0,0,164,112Zm-14.4,49.85a41,41,0,0,1-43.2,0,12,12,0,1,0-12.8,20.3,65,65,0,0,0,68.8,0,12,12,0,1,0-12.8-20.3ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84.08,84.08,0,0,0-82-83.95c-9.46,14.2-10,27.28-10,28A8,8,0,0,0,136,72a12,12,0,0,1,24,0,32,32,0,0,1-64,0c0-.63.1-10.48,5-23.52A84,84,0,1,0,212,128Z' },
  ring: { vb: '0 0 24 24', d: 'M9.46488 1L7.69076 3.66118L9.55579 5.35667C6.05273 6.40661 3.5 9.6552 3.5 13.5C3.5 18.1944 7.30558 22 12 22C16.6944 22 20.5 18.1944 20.5 13.5C20.5 9.65523 17.9473 6.40667 14.4443 5.35669L16.3094 3.66118L14.5352 1H9.46488ZM12 7C15.5899 7 18.5 9.91015 18.5 13.5C18.5 17.0899 15.5899 20 12 20C8.41015 20 5.5 17.0899 5.5 13.5C5.5 9.91015 8.41015 7 12 7ZM10.3094 3.33882L10.5352 3H13.4649L13.6908 3.33882L12.0001 4.87581L10.3094 3.33882Z' },
  carriage: { vb: '0 0 256 256', d: 'M160,28h-8a20,20,0,0,0-20,20v52H58.16A40.07,40.07,0,0,0,20,72a12,12,0,0,0,0,24,16,16,0,0,1,16,16,84.09,84.09,0,0,0,84,84h40a84,84,0,0,0,0-168Zm48.06,48.12A59.58,59.58,0,0,1,218.79,100H178.21ZM160,52a59.66,59.66,0,0,1,29.83,8L156,87V52Zm0,120H120a60.1,60.1,0,0,1-58.79-48H218.79A60.1,60.1,0,0,1,160,172Zm-52,52a20,20,0,1,1-20-20A20,20,0,0,1,108,224Zm104,0a20,20,0,1,1-20-20A20,20,0,0,1,212,224Z' },
  star: { vb: '0 0 256 256', d: 'M239.2,97.29a16,16,0,0,0-13.81-11L166,81.17,142.72,25.81h0a15.95,15.95,0,0,0-29.44,0L90.07,81.17,30.61,86.32a16,16,0,0,0-9.11,28.06L66.61,153.8,53.09,212.34a16,16,0,0,0,23.84,17.34l51-31,51.11,31a16,16,0,0,0,23.84-17.34l-13.52-58.54,45.1-39.42A16,16,0,0,0,239.2,97.29Z' },
  people: { vb: '0 0 256 256', d: 'M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z' },
  heart: { vb: '0 0 256 256', d: 'M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z' },
  leaf: { vb: '0 0 256 256', d: 'M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49c.57,15.92,5.21,32,13.79,47.85l-19.51,19.5a8,8,0,0,0,11.32,11.32l19.5-19.51C81,210.73,97.09,215.37,113,215.94q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07Z' },
};
function msIconKey(ev) {
  switch (ev.cat) {
    case 'birth': return 'baby';
    case 'union': return 'ring';
    case 'death': return 'leaf';
    case 'loss': return 'heart';
    case 'family': return ev.kind === 'child' ? 'carriage' : 'people';
    default: return 'star';   // self / personal milestone
  }
}
function MilestoneIcon({ ev, size = 19 }) {
  const ic = MS_ICONS[msIconKey(ev)] || MS_ICONS.star;
  return (
    <span className="post-icon" style={{ color: CAT_COLOR[ev.cat] || 'var(--ink-2)' }}>
      <svg width={size} height={size} viewBox={ic.vb} fill="currentColor" aria-hidden="true"><path d={ic.d} /></svg>
    </span>
  );
}

// a compact, scrub-reactive summary of one person (used in header + mini side-card)
function personNow(R, id, year, lang) {
  const p = R.get(id);
  const status = R.statusAt(p, year);
  const age = R.ageAt(p, year);
  const fn = (x) => R.fullName(R.get(x), lang).split(' ')[0];
  const union = R.unionsOf(id).find(u => year >= u.year && !(u.endYear && year >= u.endYear));
  const spouse = union ? R.partnerInUnion(union, id) : null;
  const kids = R.childrenOf(id).map(R.get).filter(c => c.birth.year <= year);
  const ev = R.lifeEvents(id, lang).filter(e => e.year <= year);
  return { p, status, age, spouse, spouseName: spouse && fn(spouse), kids, recent: ev[ev.length-1], union };
}

function MiniPortrait({ id, year, h = 120 }) {
  const R = window.REL; const p = R.get(id);
  const st = R.statusAt(p, year);
  const era = st === 'unborn' ? 'young' : eraOf(Math.min(R.ageAt(p, year) ?? 0, (p.death?p.death.year:R.NOW) - p.birth.year));
  if (st === 'unborn') return <div className="mini-photo empty" style={{ height:h }}><Medallion person={p} size={Math.round(h*0.4)} /></div>;
  return <image-slot key={'m'+id} id={`ph-${id}-${era}`} shape="rounded" radius="10"
    className="mini-photo" style={{ width:'100%', height:h+'px' }} placeholder={initials(p)}></image-slot>;
}

// slide-projector portrait. Photos are pinned to milestones (sparsely — people
// don't add one per event), so the current photo holds across several
// milestones until the next photographed one. The scrub picks an integer
// "current frame"; between photographed milestones nothing moves. Crossing
// into the next photographed milestone retargets the layout and the browser's
// CSS transitions animate the advance: the old centre shrinks up into the thin
// top strip while the next photo grows up from the bottom strip into the
// centre. A true vertical stack (prev / centre / next) — nothing behind.
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function LifeProjector({ personId, year, lang, onJump }) {
  const R = window.REL; const p = R.get(personId);
  const status = R.statusAt(p, year);
  const birth = p.birth.year; const end = p.death ? p.death.year : R.NOW;

  const [, force] = React.useReducer((x) => x + 1, 0);
  const stageRef = React.useRef(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });

  // react when photos are added / removed anywhere
  React.useEffect(() => window.ImageSlotStore && window.ImageSlotStore.subscribe(() => force()), []);
  // measure the stage so we can size the centre frame to each photo's ratio
  React.useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const store = window.ImageSlotStore;
  const [docVer, setDocVer] = React.useState(0);
  React.useEffect(() => { const h = () => setDocVer(v => v + 1); window.addEventListener('ft-doc-changed', h); return () => window.removeEventListener('ft-doc-changed', h); }, []);
  const allEv = React.useMemo(() => R.lifeEvents(personId, lang).filter(e => !e.hideStory), [personId, lang, docVer]);
  const frames = allEv
    .map((e) => ({ ei: e.ei, year: (e.effYear != null ? e.effYear : e.year), label: e.label, id: `ph-${personId}-e${e.ei}` }))
    .filter((f) => store && store.has(f.id));

  if (status === 'unborn') {
    return (
      <div className="projector">
        <div className="projector-stage" ref={stageRef}>
          <div className="portrait-empty">
            <Medallion person={p} size={92} />
            <div className="pe-cap">Not yet born</div>
            <div className="pe-sub">arrives {birth}</div>
          </div>
        </div>
      </div>
    );
  }
  if (frames.length === 0) {
    return (
      <div className="projector">
        <div className="projector-stage" ref={stageRef}>
          <div className="portrait-empty">
            <Medallion person={p} size={84} />
            <div className="pe-cap">No photos yet</div>
            <div className="pe-sub">Open a milestone in the life story to add one</div>
          </div>
        </div>
      </div>
    );
  }

  // integer current frame = last photographed milestone the scrub has reached.
  // Holds steady between milestones; only flips when you cross the next photo.
  let cur = 0;
  for (let k = 0; k < frames.length; k++) if (year >= frames[k].year) cur = k;

  const H = box.h || 480, W = box.w || 340;
  const STRIP = clampN(Math.round(H * 0.17), 60, 100);   // thin neighbour strip (≤100px)
  const GAP = 12;

  // target geometry for frame k given the current frame. CSS transitions on
  // .pframe animate between successive target states as `cur` changes.
  // The prev/next strips hug the centre frame (fixed GAP) — the whole
  // prev+centre+next group is centred in the stage, so a landscape (short)
  // centre photo keeps its neighbours right against it instead of at the edges.
  const hasPrev = cur > 0, hasNext = cur < frames.length - 1;
  const topRes = hasPrev ? STRIP + GAP : 0;
  const botRes = hasNext ? STRIP + GAP : 0;
  const availH = Math.max(140, H - topRes - botRes);
  const curV = store.get(frames[cur].id) || {};
  const curAr = curV.w && curV.h ? curV.h / curV.w : 1.15; // height / width — dynamic
  const cH = clampN(Math.round(W * curAr), 140, availH);    // wide→short, tall→tall
  const groupTop = Math.max(0, Math.round((H - (topRes + cH + botRes)) / 2));
  const centreTop = groupTop + topRes;
  const geomFor = (k) => {
    const rel = k - cur;
    if (rel === 0) return { top: centreTop, h: cH, op: 1, z: 30 };
    if (rel === -1) return { top: centreTop - GAP - STRIP, h: STRIP, op: 0.55, z: 20 }; // hugs top edge
    if (rel === 1) return { top: centreTop + cH + GAP, h: STRIP, op: 0.55, z: 20 };     // hugs bottom edge
    if (rel <= -2) return { top: centreTop - GAP - STRIP - (STRIP + GAP) - 4, h: STRIP, op: 0, z: 10 };
    return { top: centreTop + cH + GAP + STRIP + GAP + 4, h: STRIP, op: 0, z: 10 };
  };

  const curEv = frames[cur];
  window.__proj = { year, cur, n: frames.length, years: frames.map(f => f.year) };

  // adaptive transition speed: gauge how fast the user is scrubbing (years/sec).
  // A slow scrub stretches the photo transition up to 100% slower (2× duration);
  // fast scrubbing keeps the snappy base speed. Smoothed to avoid jitter.
  const speedRef = React.useRef({ y: year, t: performance.now(), dur: 0.5 });
  // discrete flips (photo click / wheel) should feel snappy; only continuous
  // rail scrubbing gets the adaptive slow-down.
  const snapRef = React.useRef(false);
  if (year !== speedRef.current.y) {
    const now = performance.now();
    let target;
    if (snapRef.current) {
      target = 0.26; snapRef.current = false;
      speedRef.current = { y: year, t: now, dur: target };   // no smoothing — snap immediately
    } else {
      const dt = Math.max(16, now - speedRef.current.t);
      const v = Math.abs(year - speedRef.current.y) / (dt / 1000);   // years per second
      const slow = clampN((8 - v) / 7, 0, 1);                        // ≤1 yr/s → 1 · ≥8 yr/s → 0
      target = 0.5 * (1 + 3 * slow);                                 // .5s … 2s
      speedRef.current = { y: year, t: now, dur: speedRef.current.dur * 0.5 + target * 0.5 };
    }
  }
  const pfDur = speedRef.current.dur;

  // flip to another frame (photo click / wheel): mark snappy, then jump.
  const flip = (y) => { if (y !== year) snapRef.current = true; onJump && onJump(y); };

  // mouse-wheel flips frames (throttled to one flip per transition)
  const wheelT = React.useRef(0);
  const onWheel = (e) => {
    const now = Date.now();
    if (now - wheelT.current < 450 || Math.abs(e.deltaY) < 12) return;
    const k = cur + (e.deltaY > 0 ? 1 : -1);
    if (k < 0 || k >= frames.length) return;
    wheelT.current = now;
    flip(frames[k].year);
  };

  return (
    <div className="projector">
      <div className="projector-stage" ref={stageRef} onWheel={onWheel} style={{ '--pf-dur': pfDur.toFixed(2) + 's' }}>
        {frames.map((f, k) => {
          if (Math.abs(k - cur) > 2) {
            // keep mounted just off-stage so it can transition in next step
            const off = k < cur ? centreTop - 2 * (STRIP + GAP) - 4 : centreTop + cH + 2 * GAP + STRIP + 4;
            return <div key={f.id} className="pframe" aria-hidden="true"
              style={{ top: off + 'px', height: STRIP + 'px', opacity: 0, zIndex: 1, pointerEvents: 'none' }}>
              <img src={(store.get(f.id) || {}).u} alt="" draggable="false" /></div>;
          }
          const g = geomFor(k); const v = store.get(f.id) || {};
          return (
            <div key={f.id} className={'pframe' + (k !== cur ? ' side' : '')} aria-hidden={k !== cur}
              onClick={() => flip(f.year)}
              title={`${f.year} — ${f.label || ''}`}
              style={{ top: g.top + 'px', height: g.h + 'px', opacity: g.op, zIndex: g.z, cursor: 'pointer' }}>
              <img src={v.u} alt="" draggable="false" />
              {k === cur && React.createElement(window.PhotoIconTools, { personId, idx: f.ei })}
            </div>
          );
        })}
      </div>
      <div className="era-label">
        <span className="era-dot" />
        <span dir="auto">{curEv.label || ''}</span>
        <span className="era-years">{curEv.year}</span>
      </div>
    </div>
  );
}

// avatar for a referenced person inside a post card: their face-framed avatar
// crop when a photo exists at (or before) this year, else the initials medallion.
function RefAvatar({ id, year, size = 34, dead }) {
  const R = window.REL; const p = R.get(id);
  const av = (typeof autoAvatar === 'function') ? autoAvatar(id, year) : { idx: -1, u: null };
  if (av.idx === -1 || !av.u) return <Medallion person={p} size={size} deceased={dead} />;
  return <image-slot key={'ppav-' + id} id={`av-${id}-e${av.idx}`} src={av.u} shape="circle" fit="cover" no-reframe=""
    style={{ width: size + 'px', height: size + 'px', flex: '0 0 auto', filter: dead ? 'grayscale(0.65)' : 'none' }}
    placeholder={initials(p)}></image-slot>;
}

// inline compact card of a related person, shown inside a milestone post
function PostPerson({ id, year, lang, onOpenFull }) {
  const R = window.REL; const m = personNow(R, id, year, lang); const mp = m.p;
  const dead = m.status === 'dead';
  const sub = m.status === 'living' ? `Age ${m.age} · ${year}`
    : dead ? `${mp.birth.year}\u2013${mp.death.year}` : `Born ${mp.birth.year}`;
  return (
    <div className="post-person" onClick={()=>onOpenFull(id)} title="Open full screen">
      <RefAvatar id={id} year={year} size={34} dead={dead} />
      <div className="pp-body">
        <div className="pp-name"><NameText person={mp} lang={lang} /></div>
        <div className="pp-sub" dir="auto">{sub}{m.recent ? ` · ${m.recent.label}` : ''}</div>
      </div>
      <span className="pp-go">→</span>
    </div>
  );
}

// one milestone photo, with hover controls to (a) reframe its tree avatar and
// (b) choose whether this photo represents the person on the family tree.
function PostPhoto({ personId, idx, hasPhoto, onFocus }) {
  const v = (hasPhoto && window.ImageSlotStore && window.ImageSlotStore.get(`ph-${personId}-e${idx}`)) || null;
  const style = v && v.w && v.h
    ? { width: '100%', maxWidth: '300px', height: 'auto', aspectRatio: v.w + ' / ' + v.h }
    : { width: '100%', maxWidth: '300px', height: '148px' };
  return React.createElement(window.PhotoMenuSlot, {
    personId, idx, mode: 'story', shape: 'rounded', radius: '12',
    placeholder: 'Add a photo from this moment', onImageClick: onFocus,
    style,
  });
}

// approximate coordinates for the birthplaces / deathplaces in the record
const PLACE_LL = {
  'Vilnius, Lithuania': [54.6872, 25.2797],
  'Warsaw, Poland':     [52.2297, 21.0122],
  'London, England':    [51.5074, -0.1278],
  'Haifa, Israel':      [32.7940, 34.9896],
  'Tel Aviv, Israel':   [32.0853, 34.7818],
  'Jerusalem, Israel':  [31.7683, 35.2137],
  'Beersheba, Israel':  [31.2518, 34.7913],
};
// a small locator map, styled like a familiar street map (CARTO "Voyager"
// basemap, built on open OpenStreetMap data). Zoomed to city scale and centred
// on the exact point by stitching the 2×2 (or so) tiles that fall under a
// square viewport, then dropping a pin dead-centre. Tiles are shared/cached
// between people from the same place.
// one basemap tile, with transient-failure retry (the 4-tile burst sometimes
// drops a request; re-request with a cache-buster and short backoff).
function MapTile({ url, style }) {
  const [tries, setTries] = React.useState(0);
  const src = tries ? url + (url.includes('?') ? '&' : '?') + 'r=' + tries : url;
  return <img className="map-tile" src={src} width={256} height={256} alt="" draggable="false"
    style={style} onError={() => { if (tries < 4) setTimeout(() => setTries(t => t + 1), 350 * (tries + 1)); }} />;
}

function MapChip({ place, size = 148, zoom = 11 }) {
  const ll = PLACE_LL[place];
  if (!ll) return null;
  const TILE = 256, n = Math.pow(2, zoom);
  const [lat, lon] = ll;
  const latRad = lat * Math.PI / 180;
  const wx = n * ((lon + 180) / 360) * TILE;                                   // world pixel X
  const wy = n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * TILE; // world pixel Y
  const left = wx - size / 2, top = wy - size / 2;                             // viewport origin in world px
  const x0 = Math.floor(left / TILE), x1 = Math.floor((left + size) / TILE);
  const y0 = Math.floor(top / TILE), y1 = Math.floor((top + size) / TILE);
  const sub = ['a', 'b', 'c'];
  const tiles = [];
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
    const s = sub[(Math.abs(tx + ty)) % 3];
    tiles.push({ tx, ty, x: tx * TILE - left, y: ty * TILE - top,
      url: `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png` });
  }
  return (
    <div className="map-chip" title={place} style={{ width: size, height: size }}>
      {tiles.map(t => (
        <MapTile key={t.tx + '_' + t.ty} url={t.url}
          style={{ left: Math.round(t.x) + 'px', top: Math.round(t.y) + 'px' }} />
      ))}
      <span className="map-pin" style={{ left: '50%', top: '50%' }} />
      <span className="map-label" dir="auto">{place}</span>
    </div>
  );
}

// editable body for a user-authored moment (title, note, optional year & place,
// reorder, delete). Commits on blur so we don't log an op per keystroke.
function MomentBody({ personId, e }) {
  const S = window.FTStore;
  const [title, setTitle] = React.useState(e.label === 'Untitled moment' ? '' : e.label);
  const [text, setText] = React.useState(e.post || '');
  const [yr, setYr] = React.useState(e.year == null ? '' : String(e.year));
  const fresh = !e.post && (e.label === 'Untitled moment');
  const IB = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className="mm-edit">
      <input className="mm-title-in" value={title} placeholder="Title this moment…" autoFocus={fresh} dir="auto"
        onChange={ev => setTitle(ev.target.value)} onBlur={() => S.updateMoment(personId, e.mid, { title })} />
      <textarea className="mm-text-in" value={text} rows={3} dir="auto"
        placeholder="What happened? Write it down — you can add a year later."
        onChange={ev => setText(ev.target.value)} onBlur={() => S.updateMoment(personId, e.mid, { text })} />
      <div className="mm-when">{e.year == null ? (e.yearLabel || 'undated') : `dated · ${e.year}`}</div>
      <div className="mm-tools">
        <label className="mm-year"><span>Year</span>
          <input value={yr} placeholder="—" inputMode="numeric"
            onChange={ev => setYr(ev.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={() => S.updateMoment(personId, e.mid, { year: yr.trim() === '' ? null : +yr })} />
        </label>
        <select className="mm-place" value={e.place || ''} onChange={ev => S.updateMoment(personId, e.mid, { place: ev.target.value || null })}>
          <option value="">No place</option>
          {Object.keys(PLACE_LL).map(pl => <option key={pl} value={pl}>{pl}</option>)}
        </select>
        <span className="mm-spacer" />
        <button className="mm-ic" title="Move up" onClick={() => S.moveMoment(personId, e.mid, -1)}><svg width="15" height="15" viewBox="0 0 24 24" {...IB}><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        <button className="mm-ic" title="Move down" onClick={() => S.moveMoment(personId, e.mid, 1)}><svg width="15" height="15" viewBox="0 0 24 24" {...IB}><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
        <button className="mm-ic danger" title="Delete moment" onClick={() => S.removeMoment(personId, e.mid)}><svg width="15" height="15" viewBox="0 0 24 24" {...IB}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg></button>
      </div>
    </div>
  );
}

function FocusView({ personId, lang, nameMode, year, setYear, onClose, onOpenFull }) {
  const R = window.REL;
  const p = R.get(personId);
  const [filterMajor, setFilterMajor] = React.useState(false);
  const [toggled, setToggled] = React.useState({});
  const railRef = React.useRef(null);

  const now = personNow(R, personId, year, lang);
  const { status, age } = now;
  const [docVer, setDocVer] = React.useState(0);
  React.useEffect(() => { const h = () => setDocVer(v => v + 1); window.addEventListener('ft-doc-changed', h); return () => window.removeEventListener('ft-doc-changed', h); }, []);
  const allEvents = React.useMemo(() => R.lifeEvents(personId, lang).filter(e => !e.hideStory), [personId, lang, docVer]);
  const events = filterMajor ? allEvents.filter(e => e.tier === 'major') : allEvents;

  const birth = p.birth.year;
  const end = p.death ? p.death.year : R.NOW;
  const span = Math.max(end - birth, 1);
  const clampedYear = Math.min(Math.max(year, birth), end);
  const playPct = ((clampedYear - birth) / span) * 100;
  const era = status === 'unborn' ? 'young' : eraOf(Math.min(age, end - birth));
  const slotId = `ph-${personId}-${era}`;
  const recent = [...allEvents].filter(e => (e.effYear != null ? e.effYear : e.year) <= year).pop();

  const ticks = [];
  for (let y = Math.ceil(birth / 10) * 10; y <= end; y += 10) ticks.push(y);

  // ---- draggable bottom timeline ----
  const yearFromX = (clientX) => {
    const r = railRef.current.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(birth + t * span);
  };
  const railDrag = React.useRef(false);
  const onRailDown = (e) => { railDrag.current = true; railRef.current.setPointerCapture(e.pointerId); setYear(yearFromX(e.clientX)); };
  const onRailMove = (e) => { if (railDrag.current) setYear(yearFromX(e.clientX)); };
  const onRailUp = (e) => { railDrag.current = false; try { railRef.current.releasePointerCapture(e.pointerId); } catch(_){} };

  const firstName = (id) => R.fullName(R.get(id), lang).split(' ')[0];

  // prev/next event navigation — step between distinct event years,
  // and focus the matching milestone in the Life story log (open + scroll to it)
  const evYears = React.useMemo(() => [...new Set(events.map(e => Math.round(e.effYear != null ? e.effYear : e.year)))].sort((a, b) => a - b), [events]);
  const prevEvYear = [...evYears].reverse().find(y => y < year);
  const nextEvYear = evYears.find(y => y > year);
  const logRef = React.useRef(null);
  const postRefs = React.useRef({});
  const goEv = (y) => {
    if (y === undefined || y === null) return;
    const yr = Math.round(y);
    setYear(yr);
    let idx = events.findIndex(e => Math.round(e.effYear != null ? e.effYear : e.year) === yr);
    if (idx < 0) return;
    setToggled(t => ({ ...t, [idx]: true }));
  };
  // scrubbing (or nav) → highlight the current milestone and centre it vertically in the log
  const recentKey = recent ? recent.key : null;
  React.useEffect(() => {
    if (recentKey == null) return;
    const idx = events.findIndex(e => e.key === recentKey);
    if (idx < 0) return;
    const el = postRefs.current[idx], log = logRef.current;
    if (!el || !log) return;
    const r = el.getBoundingClientRect(), lr = log.getBoundingClientRect();
    const top = r.top - lr.top + log.scrollTop - Math.max(14, (log.clientHeight - r.height) / 2);
    log.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [recentKey]);
  // clicking a photo inside a log post brings that post to the top of the
  // scroller and flags it as "now" (keeps it expanded).
  const focusPost = (i, y) => {
    if (y !== undefined) setYear(Math.round(y));
    setToggled(t => ({ ...t, [i]: true }));
  };
  // insert a NEW (undated) moment between two merged items — anchor it after
  // `above` (or at the very start) with a fractional seq so it keeps its place.
  const addBetween = (above, below) => {
    let bucket, seq;
    if (!above) { bucket = 'start'; seq = 0; }
    else if (above.user && above.year == null) {
      bucket = above.bucket;
      seq = (below && below.user && below.year == null && below.bucket === above.bucket) ? (above.seq + below.seq) / 2 : above.seq + 1;
    } else {
      bucket = above.key;
      seq = (below && below.user && below.year == null && below.bucket === above.key) ? below.seq / 2 : 0;
    }
    window.FTStore.addMoment(personId, { bucket, seq });
  };
  const insertRow = (above, below, key) => (
    <div key={key} className="mm-insert" title="Add a moment here"
      onClick={() => addBetween(above, below)}>
      <span className="ln"></span>
      <span className="btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add a moment</span>
    </div>
  );

  return (
    <div className="focus">
      <button className="btn-back floating" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Back to tree
      </button>

      {/* body */}
      <div className="focus-body">
        <div className="focus-left">
          <LifeProjector personId={personId} year={year} lang={lang} onJump={goEv} />
        </div>

        <div className="focus-right">
          <div className="log-filter">
            <span className="lf-title">Life story</span>
            <div className="seg-mini">
              <button className={!filterMajor?'on':''} onClick={()=>setFilterMajor(false)}>All {allEvents.length}</button>
              <button className={filterMajor?'on':''} onClick={()=>setFilterMajor(true)}>Major</button>
            </div>
          </div>
          <div className="post-log" ref={logRef}>
            {events.map((e, i) => {
              const eY = e.effYear != null ? e.effYear : e.year;
              const passed = eY <= year;
              const isNow = recent && recent.key === e.key;
              const hasStory = !!e.post;
              const hasRef = e.refId && R.get(e.refId);
              const slotId = `ph-${personId}-e${e.ei}`;
              const hasPhoto = window.ImageSlotStore && window.ImageSlotStore.has(slotId);
              const dflt = hasStory || e.user;   // stories & user moments open by default
              const open = toggled[i] === undefined ? dflt : toggled[i];
              const onClick = () => { setYear(Math.round(eY)); setToggled(t => ({ ...t, [i]: !open })); };
              const mapPlace = e.cat === 'birth' ? p.birth.place : (e.cat === 'death' && p.death ? p.death.place : (e.user ? e.place : null));
              return (
                <React.Fragment key={e.key || i}>
                  {insertRow(events[i - 1] || null, e, 'ins-' + (e.key || i))}
                  <div ref={(el) => { postRefs.current[i] = el; }} className={'post' + (passed?'':' future') + (isNow?' now':'') + (e.user?' user':'') + ' clickable' + (open?' open':'')}>
                    <div className="post-top" onClick={onClick}>
                      <span className={'post-year' + (e.year==null?' undated':'')}>{e.year != null ? e.year : '~' + Math.round(eY)}</span>
                      <MilestoneIcon ev={e} />
                      <span className={'post-title' + (e.tier==='major'?' major':'')} dir="auto">{e.label}</span>
                      {e.user && <span className="mm-badge" title="Your moment">added</span>}
                      {hasPhoto && <span className="post-haspic" title="Has a photo">{'\u25C9'}</span>}
                      <span className="post-chev">{open ? '\u2212' : '\u203a'}</span>
                    </div>
                    {open && (
                      <div className="post-expand">
                        {e.user
                          ? <MomentBody key={e.mid} personId={personId} e={e} />
                          : (hasStory && <div className="post-story" dir="auto">{e.post}</div>)}
                        {hasRef && <PostPerson id={e.refId} year={year} lang={lang} onOpenFull={onOpenFull} />}
                        <div className="post-media">
                          <PostPhoto personId={personId} idx={e.ei} hasPhoto={hasPhoto} onFocus={() => focusPost(i, eY)} />
                          {mapPlace && <MapChip place={mapPlace} />}
                        </div>
                      </div>
                    )}
                  </div>
                  {i === events.length - 1 && insertRow(e, null, 'ins-last')}
                </React.Fragment>
              );
            })}
            {events.length === 0 && insertRow(null, null, 'ins-empty')}
          </div>
        </div>
      </div>

      {/* title + current state, sitting just above the timeline */}
      <div className="focus-footer">
        <div className="focus-title">
          <NameText person={p} lang={lang} className="focus-name" />
          {p.nameChange && p.names && p.names.birth && (
            <span className="focus-nee" dir="auto">
              {(R.usesBirthName ? R.usesBirthName(p, nameMode) : nameMode === 'birth')
                ? `later ${p.name.en.split(' ').slice(-1)[0]} \u00b7 ${p.nameChange.to} from ${p.nameChange.year}`
                : `${p.nameChange.kind === 'marriage' ? (p.sex==='f'?'n\u00e9e':'n\u00e9') : 'born'} ${p.names.birth.en.split(' ').slice(-1)[0]} \u00b7 ${p.nameChange.to} from ${p.nameChange.year}`}
            </span>
          )}
          <span className="focus-life">
            {birth}{p.death ? `\u2013${p.death.year}` : '\u2013present'} · {p.sex === 'f' ? 'Female' : 'Male'} · <span dir="auto">{p.birth.place}</span>
          </span>
        </div>
        <div className="focus-sep" />
        <div className="focus-now">
          {status === 'living' && (<>
            <div className="now-age">Age {age}<span className="now-year">in {year}</span>{!p.death && <span className="badge-live">Living</span>}</div>
            <div className="now-meta">
              {now.spouse && <span>{now.union.type==='marriage'?'Married to':'With'} <b className="link" onClick={()=>onOpenFull(now.spouse)}>{R.fullName(R.get(now.spouse),lang)}</b></span>}
              {now.kids.length>0 && <span>· {now.kids.length} {now.kids.length===1?'child':'children'}</span>}
            </div>
          </>)}
          {status === 'dead' && (<>
            <div className="now-age">Died {p.death.year}<span className="now-year">aged {p.death.year-birth}</span></div>
            <div className="now-meta"><span dir="auto">{p.death.place}</span></div>
          </>)}
          {status === 'unborn' && <div className="now-age">Not yet born<span className="now-year">arrives {birth}</span></div>}
        </div>
        <div className="ev-nav">
          <button className="ev-btn" disabled={prevEvYear === undefined} onClick={() => goEv(prevEvYear)} title="Previous event" aria-label="Previous event">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className="ev-btn" disabled={nextEvYear === undefined} onClick={() => goEv(nextEvYear)} title="Next event" aria-label="Next event">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>

      {/* bottom personal timeline (drag to scrub) */}
      <div className="focus-rail">
        <div className="prail-scale">
          <span>{birth}</span>
          <span className="prail-era">{ERA_LABEL[era]} · scrub this life</span>
          <span>{p.death ? p.death.year : R.NOW}</span>
        </div>
        <div className="prail" ref={railRef} onPointerDown={onRailDown} onPointerMove={onRailMove} onPointerUp={onRailUp} onPointerLeave={onRailUp}>
          <div className="prail-axis" />
          {R.lifeStageSegments(personId).map((s, i) => (
            <div key={'st'+i} className="prail-seg" title={`${s.label} · ${s.startYear}\u2013${s.endYear}`}
              style={{ left:`${((s.startYear-birth)/span)*100}%`, width:`${((s.endYear-s.startYear)/span)*100}%`, background:s.color }} />
          ))}
          {ticks.map(t => <div key={t} className="prail-tick" style={{ left:`${((t-birth)/span)*100}%` }}><span>{`'${String(t).slice(2)}`}</span></div>)}
          {events.map((e, i) => {
            const eY = e.effYear != null ? e.effYear : e.year;
            const undated = e.year == null;
            return (
            <button key={i} className={'prail-dot'+(eY<=year?' passed':'')+(e.tier==='major'?' major':'')+(undated?' undated':'')}
              title={`${undated ? (e.yearLabel || 'undated') : e.year} — ${e.label}`} onClick={(ev)=>{ev.stopPropagation(); setYear(Math.round(eY));}}
              style={{ left:`${((Math.min(Math.max(eY,birth),end)-birth)/span)*100}%`,
                background: eY<=year?CAT_FILL[e.cat]:'var(--surface)', borderColor: CAT_COLOR[e.cat] }} />
            );
          })}
          <div className="prail-head" style={{ left:`${playPct}%` }}>
            <div className="prail-flag">{year < birth ? birth : (year > end ? end : year)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FocusView });
