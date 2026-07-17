/* story-panel.jsx — "My story" mode: a person-centred constellation over a
   bent-timeline scrubber with a rising feed of family events (incl. before
   birth). The orbit is a light physics field — avatar-cropped balls that
   repel each other elastically, settle, and re-flow when membership changes as
   you scrub. Ball size tracks relationship (children biggest once born, then
   siblings, parents, spouse; grandparents/in-laws smaller). */
(function () {
  const { useState, useRef, useEffect, useMemo } = React;
  const R = window.REL;
  const SLOTS = () => (window.FT_SEED && window.FT_SEED.slots) || {};

  const photoFor = (id, ei) => { const s = SLOTS()['ph-' + id + '-e' + ei]; return s ? s.src : null; };
  const firstOf = (id) => R.fullName(R.get(id), 'en').split(' ')[0];
  const lc = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const relLabel = (a, b) => { try { return R.relationOf(a, b, 'en') || null; } catch (e) { return null; } };
  const initialsOf = (p) => p.name.en.split(' ').map(w => w[0]).join('').slice(0, 2);

  // avatar slot id for a person at a given year (auto-picks the era photo, with
  // the hand-set crop the tree uses); falls back to earliest before birth.
  function avatarId(id, year) {
    const av = window.autoAvatar ? window.autoAvatar(id, year) : { idx: -1 };
    return av.idx !== -1 ? 'av-' + id + '-e' + av.idx : 'av-' + id;
  }
  function AvatarSlot({ id, year, className }) {
    // resolve the era photo. Prefer the hand-set avatar CROP (av-…-eN); if none
    // exists, fall back to the underlying milestone photo (photos/ph-…-eN) as the
    // slot's src — exactly what the tree does — so people who never had a crop made
    // still show their face instead of the empty "browse files" upload chrome.
    const av = window.autoAvatar ? window.autoAvatar(id, year) : { idx: -1, u: null };
    const slotId = av.idx !== -1 ? 'av-' + id + '-e' + av.idx : 'av-' + id;
    const store = window.ImageSlotStore;
    const hasImg = !!av.u || (store && store.has(slotId));
    if (!hasImg) return React.createElement('div', { className: (className || 'mys-slot') + ' mys-initials' }, initialsOf(R.get(id)));
    return React.createElement('image-slot', {
      id: slotId, key: 'as-' + id, shape: 'circle', fit: 'cover', 'no-reframe': '',
      src: av.u || undefined,
      placeholder: initialsOf(R.get(id)), class: className || 'mys-slot',
      style: { width: '100%', height: '100%' },
    });
  }

  // earliest / latest photo of a person (for the centre focus-in mechanic)
  function photoBounds(id) {
    const ev = R.lifeEvents(id, 'en');
    let earliest = null, latest = null, eYear = Infinity, lYear = -Infinity;
    ev.forEach(e => {
      if (e.ei == null) return; const src = photoFor(id, e.ei); if (!src) return;
      const y = e.effYear != null ? e.effYear : e.year;
      if (y < eYear) { eYear = y; earliest = src; }
      if (y > lYear) { lYear = y; latest = src; }
    });
    return { earliest, latest };
  }

  // ---- STRUCTURAL family membership: IMMEDIATE family + explicit side-links.
  // We don't parse the fuzzy relationOf() string and we don't walk the whole
  // blood tree (that flooded the arcs with distant nieces/cousins). The circle is:
  //   spouse · parents/step-parents · grandparents · children/step-children ·
  //   grandchildren · siblings (full+half)
  // PLUS anyone bound to the focal by an explicit SIDE LINK in the data (e.g.
  // Maya ↔ Sarah, "Like a mother · Helped raise her") — chosen bonds, not census.
  // Side-linked people band by generation: younger → bottom arc, older → top.
  const _ids = (a) => (a || []).map(x => (x && x.id) || x).filter(Boolean);
  function familyTiers(focalId) {
    const out = {}; // id -> { tier, score }
    const focal = R.get(focalId), fgen = focal ? focal.gen : 0;
    const add = (id, tier, score) => { if (id && id !== focalId && !(id in out)) out[id] = { tier, score }; };
    let partners = [];
    try { R.unionsOf(focalId).forEach(u => { const p = R.partnerInUnion(u, focalId); if (p) partners.push(p.id || p); }); } catch (e) {}
    partners.forEach(id => add(id, 'spouse', 0));
    const kids = _ids(R.childrenOf(focalId)).concat(_ids(R.stepChildren(focalId)));
    kids.forEach(id => add(id, 'child', 1));
    kids.forEach(k => _ids(R.childrenOf(k)).forEach(id => add(id, 'grandchild', 2)));
    const par = _ids(R.parentsOf(focalId)).concat(_ids(R.stepParents(focalId)));
    par.forEach(id => add(id, 'parent', 3));
    par.forEach(p => _ids(R.parentsOf(p)).forEach(id => add(id, 'gp', 5)));
    const sib = R.siblings(focalId) || { full: [], half: [] };
    _ids(sib.full).concat(_ids(sib.half)).forEach(id => add(id, 'sibling', 4));
    // explicit side-links (caretakers, "like a mother/daughter" bonds…)
    try {
      (R.sideLinksOf(focalId) || []).forEach(l => {
        const id = l.other; const p = id && R.get(id); if (!p) return;
        const g = fgen - (p.gen != null ? p.gen : fgen); // >0 older gen
        add(id, g >= 1 ? 'elder' : g <= -1 ? 'younger' : 'cousin', 6);
      });
    } catch (e) {}
    return out;
  }
  const REL_SHORT = { Mother: 'Mom', Father: 'Dad', Grandmother: 'Grandma', Grandfather: 'Grandpa',
    'Great-grandmother': 'Gt-gran', 'Great-grandfather': 'Gt-gramps', Son: 'Son', Daughter: 'Daughter',
    Brother: 'Brother', Sister: 'Sister', 'Half-brother': 'Half-bro', 'Half-sister': 'Half-sis',
    Grandson: 'Grandson', Granddaughter: 'G-daughter' };
  const shortTag = (relation, firstName) => REL_SHORT[relation] || firstName;

  const SPACING = 12; // min air gap between any two balls
  // sizes — children are the biggest orbit balls; siblings shrink once children
  // are present so the kids clearly read as the larger, closer generation.
  const rOf = (t, hasKids) => t === 'spouse' ? 62 : t === 'child' ? 36 : t === 'sibling' ? (hasKids ? 24 : 32) : t === 'grandchild' ? 26 : t === 'parent' ? 28 : t === 'gp' ? 24 : t === 'elder' ? 24 : t === 'younger' ? 26 : 24;
  // order an arc middle-out by closeness so the nearest relations sit at its apex
  function centeredOrder(arr) {
    const s = [...arr].sort((a, b) => a.score - b.score || b.age - a.age);
    const left = [], right = [], mid = [];
    s.forEach((x, i) => { if (i === 0) mid.push(x); else if (i % 2) right.push(x); else left.unshift(x); });
    return [...left, ...mid, ...right];
  }

  // Deterministic layout: the focal (+ spouse) form a centred UNIT; everyone
  // else sits on ONE clean arc ABOVE (parents, grandparents) or BELOW (children,
  // grandchildren, siblings). Arcs clear the unit entirely — nothing touches it.
  function computeBalls(focalId, year, size, centerR) {
    const C = size / 2, list = [];
    const tiers = familyTiers(focalId);
    Object.keys(tiers).forEach(id => {
      const p = R.get(id); if (!p) return;
      const c = tiers[id];
      const relation = relLabel(focalId, id);
      // living appear normally; the dead linger 3 years then fade out (skip once
      // gone). Unborn are never shown.
      let fade = 1, ageYr = year;
      if (R.statusAt(p, year) !== 'living') {
        const dy = p.death && p.death.year;
        if (dy == null) return;                       // unborn / unknown → hide
        const since = year - dy;
        if (since < 0 || since > 3) return;            // outside the 3-yr afterglow
        fade = Math.max(0.12, 1 - since / 3);          // 1 → ~0.12 across 3 years
        ageYr = dy;                                    // freeze age at death
      }
      list.push({ id: p.id, relation, age: R.ageAt(p, ageYr), fade, tag: shortTag(relation, firstOf(p.id)), tier: c.tier, score: c.score });
    });
    const hasKids = list.some(b => b.tier === 'child');
    const chosen = list.map(b => ({ ...b, r: rOf(b.tier, hasKids) }));
    const polar = (deg, dist) => { const th = deg * Math.PI / 180; return [C + dist * Math.cos(th), C + dist * Math.sin(th)]; };

    const spouse = chosen.filter(b => b.tier === 'spouse');
    const top = chosen.filter(b => b.tier === 'parent' || b.tier === 'gp' || b.tier === 'elder');
    const bottom = chosen.filter(b => b.tier === 'child' || b.tier === 'grandchild' || b.tier === 'sibling' || b.tier === 'younger' || b.tier === 'cousin');

    // spouse UNIT — sits close beside the focal and tucks a bit behind it (the
    // focal portrait overlaps its inner edge); both enlarged, spouse ≈ focal size.
    let cxOffset = 0, centerScale = 1, S = 0;
    if (spouse.length) {
      const sp = spouse[0]; sp.r = 62; sp.unit = true;
      centerScale = 1.08;
      S = centerR * centerScale + sp.r - 30; // < sum of radii ⇒ overlap ⇒ "a bit behind"
      cxOffset = -S / 2;
      sp.ax = C + S / 2; sp.ay = C;
      spouse.slice(1).forEach(b => { b.behind = true; b.ax = C + cxOffset; b.ay = C; });
    }
    const effCR = centerR * centerScale, Cx = C + cxOffset;

    // arc radii clear the whole unit (incl. the spouse's outer reach)
    const reach = spouse.length ? (S / 2 + spouse[0].r) : effCR;
    const maxTop = Math.max(24, ...top.map(b => b.r));
    const maxBot = Math.max(24, ...bottom.map(b => b.r));
    const Rtop = Math.max(effCR + maxTop + 22, 100);
    const Rbot = Math.max(effCR + maxBot + 38, 122);
    const BADGE = 46; // name pill + dates line hang below the portrait — keep the bottom arc clear of them

    const placeArc = (arr, cAng, Rad0) => {
      const n = arr.length; if (!n) return;
      if (n === 1) { const [x, y] = polar(cAng, Rad0); arr[0].ax = x; arr[0].ay = y; return; }
      const chord = Math.max(...arr.map(b => b.r)) * 2 + SPACING + 2;
      const maxSpan = 152 * Math.PI / 180;
      const stepAt = (Rd) => 2 * Math.asin(Math.min(0.92, chord / (2 * Rd)));
      let Rad = Rad0;
      while (stepAt(Rad) * (n - 1) > maxSpan && Rad < Rad0 * 2) Rad += 4; // grow radius so a crowded arc still fits without overlap
      const step = stepAt(Rad), span = step * (n - 1), c0 = cAng * Math.PI / 180;
      arr.forEach((b, i) => { const th = c0 - span / 2 + step * i; b.ax = C + Rad * Math.cos(th); b.ay = C + Rad * Math.sin(th); });
    };
    placeArc(centeredOrder(top), -90, Rtop);
    placeArc(centeredOrder(bottom), 90, Rbot);

    // keep anchors inside the field
    chosen.forEach(b => { b.ax = Math.max(b.r + 2, Math.min(size - b.r - 2, b.ax)); b.ay = Math.max(b.r + 2, Math.min(size - b.r - 2, b.ay)); });

    // pre-settle synchronously so the first paint is already de-overlapped
    chosen.forEach(b => { b.x = b.ax; b.y = b.ay; });
    for (let it = 0; it < 80; it++) {
      chosen.forEach(b => { if (!b.unit) { b.x += (b.ax - b.x) * 0.14; b.y += (b.ay - b.y) * 0.14; } });
      for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
        const a = chosen[i], b = chosen[j]; if (a.unit && b.unit) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r + SPACING;
        if (d < min) { const nx = dx / d, ny = dy / d, ov = min - d;
          if (a.unit) { b.x += nx * ov; b.y += ny * ov; }
          else if (b.unit) { a.x -= nx * ov; a.y -= ny * ov; }
          else { a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2; } }
      }
      chosen.forEach(b => {
        if (!b.unit && !b.behind) { let dx = b.x - Cx, dy = b.y - C, d = Math.hypot(dx, dy) || 0.01, min = effCR + b.r + 5 + Math.max(0, dy / d) * BADGE; if (d < min) { const nx = dx / d, ny = dy / d; b.x = Cx + nx * min; b.y = C + ny * min; } }
        b.x = Math.max(b.r, Math.min(size - b.r, b.x)); b.y = Math.max(b.r, Math.min(size - b.r, b.y));
      });
    }
    // vertical recentre — when an arc is empty (e.g. no parents above), pull the
    // whole group to the middle of the sky instead of leaving dead space up top.
    let minY = C - effCR, maxY = C + effCR;
    chosen.forEach(b => { minY = Math.min(minY, b.y - b.r); maxY = Math.max(maxY, b.y + b.r); });
    let yShift = C - (minY + maxY) / 2;
    if (minY + yShift < 2) yShift = 2 - minY;              // keep top in bounds
    if (maxY + yShift > size - 2) yShift = size - 2 - maxY; // keep bottom in bounds
    chosen.forEach(b => { b.ay += yShift; b.y += yShift; });
    chosen.meta = { cxOffset, centerScale, effCR, yShift };
    return chosen;
  }

  // ---- the physics constellation ----
  function OrbitField({ focalId, year, onSelect, centerR, renderCenter }) {
    const wrapRef = useRef(null), stateRef = useRef({}), nodeRefs = useRef({});
    const sizeRef = useRef(340), ballsRef = useRef([]), metaRef = useRef({ cxOffset: 0, centerScale: 1, effCR: centerR });
    const rafRef = useRef(0), idleRef = useRef(0), framesRef = useRef(0), runningRef = useRef(false), startRef = useRef(null);
    const [balls, setBalls] = useState([]);
    const [meta, setMeta] = useState({ cxOffset: 0, centerScale: 1 });

    // (re)compute membership whenever the focal person or the year changes
    useEffect(() => {
      if (wrapRef.current) { const w = wrapRef.current.getBoundingClientRect().width; if (w) sizeRef.current = w; }
      const b = computeBalls(focalId, year, sizeRef.current, centerR);
      ballsRef.current = b; metaRef.current = b.meta || metaRef.current; setBalls(b); setMeta(b.meta || { cxOffset: 0, centerScale: 1 });
      const ids = new Set(b.map(x => x.id));
      Object.keys(stateRef.current).forEach(id => { if (!ids.has(id)) delete stateRef.current[id]; });
      const C = sizeRef.current / 2, cx = C + ((b.meta && b.meta.cxOffset) || 0), cy = C + ((b.meta && b.meta.yShift) || 0);
      // new spouse starts hidden behind the focal, then springs out to its side
      b.forEach(x => { if (!stateRef.current[x.id]) stateRef.current[x.id] = x.unit ? { x: cx, y: cy, vx: 0, vy: 0 } : { x: x.x, y: x.y, vx: 0, vy: 0 }; });
      if (startRef.current) startRef.current(); // wake the loop so it eases to the new anchors
    }, [focalId, year, centerR]);

    // measure the field so physics runs in real px
    useEffect(() => {
      if (!wrapRef.current || !window.ResizeObserver) return;
      const ro = new ResizeObserver(entries => {
        const w = entries[0].contentRect.width; if (w) { sizeRef.current = w; if (startRef.current) startRef.current(); }
      });
      ro.observe(wrapRef.current); return () => ro.disconnect();
    }, []);

    // physics loop: spring to anchor + elastic collisions + damping, then SLEEP
    // once everything is at rest (so nothing jitters forever).
    useEffect(() => {
      const REST = 0.55;
      const step = () => {
        const size = sizeRef.current, C = size / 2, bs = ballsRef.current, st = stateRef.current;
        const mt = metaRef.current, Cx = C + (mt.cxOffset || 0), Cy = C + (mt.yShift || 0), eff = mt.effCR || centerR;
        bs.forEach(b => {
          if (!st[b.id]) st[b.id] = { x: b.ax, y: b.ay, vx: 0, vy: 0 };
          const s = st[b.id], k = b.unit ? 0.06 : 0.02; // spouse springs out from behind briskly
          s.vx += (b.ax - s.x) * k; s.vy += (b.ay - s.y) * k;
        });
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          const A = bs[i], B = bs[j], a = st[A.id], b = st[B.id]; if (!a || !b) continue;
          if (A.unit && B.unit) continue;
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
          const min = A.r + B.r + SPACING;
          if (d < min) {
            const nx = dx / d, ny = dy / d, ov = min - d;
            if (A.unit) { // A immovable — push only B off it
              b.x += nx * ov; b.y += ny * ov; const rv = b.vx * nx + b.vy * ny; if (rv < 0) { b.vx -= (1 + REST) * rv * nx; b.vy -= (1 + REST) * rv * ny; }
            } else if (B.unit) {
              a.x -= nx * ov; a.y -= ny * ov; const rv = a.vx * nx + a.vy * ny; if (rv > 0) { a.vx -= (1 + REST) * rv * nx; a.vy -= (1 + REST) * rv * ny; }
            } else {
              const h = ov / 2; a.x -= nx * h; a.y -= ny * h; b.x += nx * h; b.y += ny * h;
              const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (rel < 0) { const imp = -(1 + REST) * rel / 2; a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny; }
            }
          }
        }
        let maxE = 0;
        bs.forEach(b => {
          const s = st[b.id];
          if (!b.behind && !b.unit) { // spouse is part of the centre unit; everyone else clears the enlarged portrait (+ the badge hanging below it)
            let dx = s.x - Cx, dy = s.y - Cy, d = Math.hypot(dx, dy) || 0.01, min = eff + b.r + 5 + Math.max(0, dy / d) * 46;
            if (d < min) { const nx = dx / d, ny = dy / d, ov = min - d; s.x += nx * ov; s.y += ny * ov; const rv = s.vx * nx + s.vy * ny; if (rv < 0) { s.vx -= (1 + REST) * rv * nx; s.vy -= (1 + REST) * rv * ny; } }
          }
          s.vx *= b.unit ? 0.72 : 0.82; s.vy *= b.unit ? 0.72 : 0.82; s.x += s.vx; s.y += s.vy;
          s.x = Math.max(b.r, Math.min(size - b.r, s.x)); s.y = Math.max(b.r, Math.min(size - b.r, s.y));
          maxE = Math.max(maxE, Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(b.ax - s.x) + Math.abs(b.ay - s.y));
          const node = nodeRefs.current[b.id];
          if (node) node.style.transform = `translate(${(s.x - b.r).toFixed(1)}px, ${(s.y - b.r).toFixed(1)}px)`;
        });
        if (maxE < 0.4) idleRef.current++; else idleRef.current = 0;
        framesRef.current++;
        // sleep once at rest OR after a hard time cap, so nothing can jitter forever
        if (idleRef.current > 8 || framesRef.current > 150) { runningRef.current = false; rafRef.current = 0; return; }
        rafRef.current = requestAnimationFrame(step);
      };
      startRef.current = () => { idleRef.current = 0; framesRef.current = 0; if (!runningRef.current) { runningRef.current = true; rafRef.current = requestAnimationFrame(step); } };
      startRef.current();
      return () => { cancelAnimationFrame(rafRef.current); runningRef.current = false; };
    }, [centerR]);

    return (
      <div className="mys-sky" ref={wrapRef}>
        {balls.map(b => (
          <button key={b.id} className={'mys-orbit' + (b.unit ? ' unit' : '') + (b.behind ? ' behind' : '') + (b.fade < 1 ? ' gone' : '')} ref={el => { nodeRefs.current[b.id] = el; }}
            style={{ width: b.r * 2, height: b.r * 2, opacity: b.fade != null ? b.fade : 1, transform: `translate(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px)` }}
            onClick={() => onSelect && onSelect(b.id)} title={R.fullName(R.get(b.id), 'en')}>
            <AvatarSlot id={b.id} year={year} />
            <span className={'mys-tag' + (b.score <= 4 ? ' near' : '')}>{b.tag}{b.age != null ? ' ' + b.age : ''}</span>
          </button>
        ))}
        {renderCenter(meta.cxOffset || 0, meta.centerScale || 1, meta.yShift || 0)}
      </div>
    );
  }

  // ---- story beats (self + related), notable only, deduped ----
  function buildBeats(focalId) {
    const focal = R.get(focalId), bYear = focal.birth.year, beats = [];
    R.lifeEvents(focalId, 'en').forEach(e => beats.push({
      key: 'self-' + (e.key || e.year), year: e.effYear != null ? e.effYear : e.year,
      scope: 'self', cat: e.cat, kind: e.kind, refId: e.refId || null, tier: e.tier || 'minor', label: e.label, post: e.post || null,
      photo: e.ei != null ? photoFor(focalId, e.ei) : null,
    }));
    const seen = new Set();
    R.F.people.forEach(p => {
      if (p.id === focalId) return; const relation = relLabel(focalId, p.id); if (!relation) return;
      R.lifeEvents(p.id, 'en').forEach(e => {
        const yr = e.effYear != null ? e.effYear : e.year;
        const keep = e.cat === 'birth' || e.cat === 'death' || e.cat === 'union' || (e.cat === 'self' && e.tier === 'major');
        if (!keep) return;
        let dk = e.cat + '|' + yr + '|' + p.id;
        if (e.cat === 'union') dk = 'u|' + yr + '|' + [p.id, e.refId].sort().join('-');
        if (seen.has(dk)) return; seen.add(dk);
        // the focal's own timeline already tells this story ("Father Yosef died",
        // "Son Dan born"…) — don't repeat it from the relative's side; but if the
        // relative's version carries a photo and ours doesn't, borrow it.
        const selfDup = beats.find(sb => sb.scope === 'self' && sb.refId === p.id && Math.abs(sb.year - yr) < 1);
        if (selfDup) {
          if (!selfDup.photo && e.ei != null) selfDup.photo = photoFor(p.id, e.ei);
          return;
        }
        beats.push({
          key: p.id + '-' + (e.key || yr) + '-' + e.cat, year: yr, scope: yr < bYear ? 'world' : 'family',
          cat: e.cat, tier: e.tier || 'minor', relation, otherId: p.id, first: firstOf(p.id),
          label: e.label, post: e.post || null, photo: e.ei != null ? photoFor(p.id, e.ei) : null,
        });
      });
    });
    beats.sort((a, b) => a.year - b.year || (a.scope === 'self' ? -1 : 1));
    return beats;
  }
  function selfLine(b, first) {
    if (b.cat === 'birth') return first + ' is born.';
    if (b.cat === 'death') return first + ' dies.';
    if (b.cat === 'union') return first + ' ' + lc(b.label) + '.';
    return b.label + '.';
  }

  // ---- moving arc (years slide along the curve; apex = "now") ----
  const WIN = 16; // years visible across the panel
  function MovingArc({ fy, onDrag }) {
    const ref = useRef(null), drag = useRef(null);
    const down = (e) => {
      const rect = ref.current.getBoundingClientRect();
      drag.current = { x: e.clientX, ypp: WIN / rect.width, acc: fy };
      ref.current.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!drag.current) return; const d = drag.current; const dx = e.clientX - d.x; d.x = e.clientX;
      d.acc = Math.min(R.MAX_YEAR, Math.max(R.MIN_YEAR, d.acc - dx * d.ypp));
      onDrag(d.acc);
    };
    const up = (e) => { drag.current = null; try { ref.current.releasePointerCapture(e.pointerId); } catch (x) {} };
    const P0 = 0, PC = 150, P2 = 300, CY = -10;
    const xAt = (t) => (1 - t) * (1 - t) * P0 + 2 * (1 - t) * t * PC + t * t * P2;
    const yAt = (t) => (1 - t) * (1 - t) * 52 + 2 * (1 - t) * t * CY + t * t * 52;
    const ticks = [];
    for (let y = Math.ceil((fy - WIN / 2) / 4) * 4; y <= fy + WIN / 2; y += 4) ticks.push(y);
    return (
      <div className="mys-arc" ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="mys-arc-svg">
          <path d={`M${P0} 52 Q${PC} ${CY} ${P2} 52`} fill="none" stroke="var(--line-2)" strokeWidth="1.5" />
        </svg>
        {ticks.map(y => {
          const t = .5 + (y - fy) / WIN;
          if (t < .04 || t > .96 || Math.abs(y - fy) < 2.4) return null;
          const edge = Math.min(t, 1 - t);
          return (
            <div key={y} className="mys-tick" style={{ left: (xAt(t) / 3) + '%', top: (yAt(t) / 60 * 100) + '%', opacity: Math.max(0, Math.min(1, (edge - .04) / .12)) }}>
              <span className="mys-tick-node"></span><span className="mys-tick-yr">{y}</span>
            </div>
          );
        })}
        <div className="mys-apex" style={{ left: (xAt(.5) / 3) + '%', top: (yAt(.5) / 60 * 100) + '%' }}>
          <span className="mys-tick-node mid"></span><span className="mys-apex-yr">{Math.round(fy)}</span>
        </div>
        <div className="mys-arc-hint">drag to move through time</div>
      </div>
    );
  }

  // ---- event lanes: pills that unfold into cards at "now" ----
  function clusterizeBeats(list) {
    const out = []; let cur = null;
    [...list].sort((a, b) => a.year - b.year).forEach(b => {
      if (cur && b.year - cur.items[cur.items.length - 1].year <= 2) cur.items.push(b);
      else { cur = { items: [b] }; out.push(cur); }
    });
    out.forEach(c => { c.y = c.items.reduce((s, b) => s + b.year, 0) / c.items.length; });
    return out;
  }
  function beatText(b, focalFirst) {
    if (b.scope === 'self') return selfLine(b, focalFirst);
    return <>{focalFirst}’s {lc(b.relation)} <b>{b.first}</b> {b.cat === 'birth' ? 'is born.' : b.cat === 'death' ? 'dies.' : b.cat === 'union' ? 'marries.' : '— ' + lc(b.label) + '.'}</>;
  }
  function Deck({ c, fy, open, onGlide, focalId }) {
    const [active, setActive] = useState(0);
    const dy = c.y - fy;
    const fade = Math.max(0, Math.min(1, (7.9 - Math.abs(dy)) / 1.2));
    if (fade <= 0) return null;
    const b = c.items[active % c.items.length];
    const multi = c.items.length > 1;
    const y0 = c.items[0].year, y1 = c.items[c.items.length - 1].year;
    const isLoss = b.cat === 'loss' || b.cat === 'death';
    const avId = b.cat === 'birth' ? (b.otherId || focalId)
      : isLoss ? (b.refId || b.otherId || null)
      : ((b.kind === 'child' || b.kind === 'sibling') && b.refId ? b.refId : null);
    const avYr = isLoss ? b.year - 1 : b.year + 1; // for a loss, show them as they were
    return (
      <div className={'sla-deck' + (open ? ' open' : '') + (multi ? ' multi' : '') + (c.items.some(i => i.scope === 'self') ? ' self' : '')} style={{ left: (50 + dy / WIN * 100) + '%', opacity: fade }}>
        <button className="sla-pk" onClick={() => onGlide(c.y)}>
          {multi ? y0 + '–' + String(y1).slice(2) : y0}{multi && <span className="n"> · {c.items.length}</span>}
        </button>
        <div className="sla-cards" onClick={multi ? () => setActive(a => (a + 1) % c.items.length) : undefined}>
          {c.items.length > 2 && <span className="sla-edge e2"></span>}
          {multi && <span className="sla-edge e1"></span>}
          <div className={'sla-card' + (b.scope === 'world' ? ' world' : '') + (b.scope === 'self' ? ' self' : '')} title={b.post || undefined}>
            <div className="cy">{b.year}</div>
            <div className="ct">{beatText(b, firstOf(focalId))}</div>
            {avId && <div className="cav"><span className="cavbox"><AvatarSlot id={avId} year={avYr} /></span></div>}
            {b.photo && <div className="cph"><img src={b.photo} alt="" draggable="false" /></div>}
          </div>
          {multi && <span className="sla-count">{c.items.length > 9 ? '9+' : c.items.length}</span>}
        </div>
      </div>
    );
  }
  function Lane({ clusters, fy, onGlide, focalId }) {
    let best = null, bd = 2.4;
    clusters.forEach(c => { const d = Math.abs(c.y - fy); if (d < bd) { bd = d; best = c; } });
    return (
      <div className={'sla-lane' + (best ? ' has-open' : '')}>
        <span className="sla-axis"></span>
        {clusters.map((c, i) => <Deck key={c.items[0].key} c={c} fy={fy} open={c === best} onGlide={onGlide} focalId={focalId} />)}
      </div>
    );
  }

  function StoryPanel({ personId, year, setYear, lang, onSelect, onOpenFull }) {
    const focal = R.get(personId);
    const beats = useMemo(() => buildBeats(personId), [personId]);
    const status = R.statusAt(focal, year);
    const age = R.ageAt(focal, year);
    const bYear = focal.birth.year;
    const bounds = useMemo(() => photoBounds(personId), [personId]);
    const centerR = 62;
    let blur = 0, gray = 0, op = 1, ring = 'live', label, sub;
    if (status === 'unborn') {
      const away = bYear - year;
      blur = Math.min(11, away * 0.6); gray = Math.min(0.85, away / 26); op = Math.max(0.5, 1 - away / 40);
      ring = 'pre'; label = away <= 1 ? 'Arrives next year' : 'Arrives in ' + away + ' years'; sub = 'born ' + bYear;
    } else if (status === 'dead') {
      ring = 'gone'; label = 'No longer here'; sub = 'died ' + focal.death.year + ' · aged ' + (focal.death.year - bYear);
    } else {
      ring = 'live'; label = 'Age ' + age; sub = 'in ' + year + (focal.death ? '' : ' · living');
    }
    const hasPhoto = status === 'unborn' ? bounds.earliest : (bounds.earliest || bounds.latest);

    // float "display year" — the arc & lanes slide sub-year smooth while the
    // app-wide integer year follows (rounded). External year changes re-sync it.
    const [fy, setFy] = useState(year);
    const fyRef = useRef(fy); fyRef.current = fy;
    useEffect(() => { if (year !== Math.round(fyRef.current)) setFy(year); }, [year]);
    const setFromDrag = (v) => {
      setFy(v);
      const r = Math.round(v); if (r !== year) setYear(r);
    };
    const glideRaf = useRef(0);
    useEffect(() => () => cancelAnimationFrame(glideRaf.current), []);
    const glideTo = (target) => {
      cancelAnimationFrame(glideRaf.current);
      const from = fyRef.current, dur = 550, t0 = performance.now();
      const step = (ts) => {
        const u = Math.min(1, (ts - t0) / dur), e = .5 - .5 * Math.cos(u * Math.PI);
        setFromDrag(from + (target - from) * e);
        if (u < 1) glideRaf.current = requestAnimationFrame(step);
      };
      glideRaf.current = requestAnimationFrame(step);
    };
    // single event lane — all moments together; the focal's own are tinted amber
    const allClusters = useMemo(() => clusterizeBeats(beats), [beats]);
    const laneDrag = useRef(null), lanesRef = useRef(null);
    const laneDown = (e) => {
      if (e.target.closest('.sla-pk') || e.target.closest('.sla-cards')) return;
      const rect = lanesRef.current.getBoundingClientRect();
      laneDrag.current = { x: e.clientX, ypp: WIN / rect.width, acc: fyRef.current };
      lanesRef.current.setPointerCapture(e.pointerId);
    };
    const laneMove = (e) => {
      if (!laneDrag.current) return; const d = laneDrag.current; const dx = e.clientX - d.x; d.x = e.clientX;
      d.acc = Math.min(R.MAX_YEAR, Math.max(R.MIN_YEAR, d.acc - dx * d.ypp));
      setFromDrag(d.acc);
    };
    const laneUp = () => { laneDrag.current = null; };

    // panel-wide scrub — a horizontal drag anywhere in the panel moves time.
    // Arc & lanes keep their own handlers; taps/clicks still work (threshold +
    // click suppression only after an actual scrub).
    const panelRef = useRef(null), panelDrag = useRef(null), scrubbed = useRef(false);
    const pDown = (e) => {
      if (e.target.closest('.mys-arc') || e.target.closest('.sla-lanes') || e.target.closest('.mys-cta')) return;
      const rect = panelRef.current.getBoundingClientRect();
      panelDrag.current = { x: e.clientX, y: e.clientY, ypp: WIN / rect.width, acc: fyRef.current, on: false, id: e.pointerId };
    };
    const pMove = (e) => {
      const d = panelDrag.current; if (!d) return;
      if (!d.on) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        d.on = true; d.x = e.clientX;
        try { panelRef.current.setPointerCapture(d.id); } catch (x) {}
        return;
      }
      const dx = e.clientX - d.x; d.x = e.clientX;
      d.acc = Math.min(R.MAX_YEAR, Math.max(R.MIN_YEAR, d.acc - dx * d.ypp));
      setFromDrag(d.acc);
    };
    const pUp = () => { const d = panelDrag.current; panelDrag.current = null; if (d && d.on) { scrubbed.current = true; setTimeout(() => { scrubbed.current = false; }, 0); } };
    const pClickCap = (e) => { if (scrubbed.current) { e.stopPropagation(); e.preventDefault(); } };

    const renderCenter = (cxOffset = 0, scale = 1, yShift = 0) => (
      <div className="mys-center" style={{ width: centerR * 2, height: centerR * 2, transform: `translate(-50%,-50%) translate(${cxOffset}px, ${yShift}px)` }}>
        <div className={'mys-cwrap ' + ring} style={{ opacity: op, transform: `scale(${scale})` }}>
          <div className="mys-cinner" style={{ filter: `blur(${blur}px) grayscale(${gray})` }}>
          {hasPhoto
            ? <AvatarSlot id={personId} year={status === 'unborn' ? bYear : year} className="mys-cimg" />
            : <div className="mys-cph">{initialsOf(focal)}</div>}
          </div>
        </div>
        <div className="mys-badge">
          <div className="mys-badge-pill">
            <span className="mys-badge-name"><NameText person={focal} lang={lang} /></span>
            {status !== 'unborn' && <b>{age}</b>}
          </div>
          {status === 'unborn'
            ? <div className="mys-badge-sub mys-arr">
                <span className="mys-arrive">{bYear - year <= 1 ? 'Arrives next year' : <>Arrives in <b>{bYear - year}</b> years</>}</span>
                <span className="mys-born">{sub}</span>
              </div>
            : <div className="mys-badge-sub">{bYear}{focal.death ? '–' + focal.death.year : '–present'}{status === 'living' && <span className="mys-live">● Living</span>}</div>}
        </div>
      </div>
    );

    const feed = beats.filter(b => b.year <= year).slice(-3).reverse();
    return (
      <div className="mystory" ref={panelRef} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp} onClickCapture={pClickCap}>
        <div className="mys-head">
          <div className="mys-year">{year}</div>
          <div className="mys-title"><NameText person={focal} lang={lang} />’s family story</div>
        </div>

        <OrbitField focalId={personId} year={year} onSelect={onSelect} centerR={centerR} renderCenter={renderCenter} />

        <MovingArc fy={fy} onDrag={setFromDrag} />

        <div className="sla-lanes" ref={lanesRef} onPointerDown={laneDown} onPointerMove={laneMove} onPointerUp={laneUp} onPointerCancel={laneUp}>
          <Lane clusters={allClusters} fy={fy} onGlide={glideTo} focalId={personId} />
        </div>

        {onOpenFull && <button className="mys-cta" onClick={() => onOpenFull(personId)}>
          Open full life timeline
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>}
      </div>
    );
  }

  window.StoryPanel = StoryPanel;
})();
