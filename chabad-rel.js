/* ============================================================
   Family Tree — relationship engine + layout
   Pure JS. Exposes window.REL with:
     - people index + helpers (partners, children, siblings, steps)
     - derived relationships (full/half siblings, step-parents)
     - global event range
     - per-person life events (with intersections)
     - tidy top-down generational layout (positions + connectors)
   ============================================================ */
(function () {
  const F = window.FAMILY;
  const byId = {};
  F.people.forEach(p => { byId[p.id] = p; });

  const NOW = 5754;

  // ---------- basic helpers ----------
  const get = id => byId[id];
  const isLiving = p => p.death == null;

  // ---- name mode: 'current' (surname after any change) | 'birth' (born surname)
  //      | 'time' (surname as it was in the year being scrubbed) ----
  let NAME_MODE = 'time';
  try { const m = localStorage.getItem('ft.nameMode'); if (m === 'birth' || m === 'current' || m === 'time') NAME_MODE = m; } catch (e) {}
  function setNameMode(m) { NAME_MODE = (m === 'birth' || m === 'time') ? m : 'current'; try { localStorage.setItem('ft.nameMode', NAME_MODE); } catch (e) {} }
  function getNameMode() { return NAME_MODE; }
  // 'time' mode reads the current scrub year from NAME_YEAR (App keeps it synced).
  let NAME_YEAR = 3000;
  function setNameYear(y) { NAME_YEAR = y; }
  // whether a person's BIRTH surname should show, given a mode (+ the global year for 'time')
  function usesBirthName(p, mode) {
    const M = mode || NAME_MODE;
    if (!(p && p.nameChange && p.names && p.names.birth)) return false;
    if (M === 'birth') return true;
    if (M === 'time') return NAME_YEAR < p.nameChange.year;
    return false; // 'current'
  }
  // fullName(p, lang[, mode]) — mode falls back to the global NAME_MODE.
  // Works for every consumer without threading a prop.
  const fullName = (p, lang, mode) => {
    if (!p) return '';
    const src = (usesBirthName(p, mode) ? p.names.birth : p.name) || { en: '', he: '' };
    return lang === 'he' ? (src.he || src.en || '') : (src.en || '');
  };
  // name-change storytelling helpers
  const nameChangeOf = p => (p && p.nameChange) || null;
  const bornName = (p, lang) => { const s = (p && p.names && p.names.birth) ? p.names.birth : (p && p.name); return s ? (lang === 'he' ? s.he : s.en) : ''; };

  function unionsOf(id) { return F.unions.filter(u => u.a === id || u.b === id); }
  function partnerInUnion(u, id) { return u.a === id ? u.b : u.a; }
  function childrenOfUnion(u) {
    const set = new Set([u.a, u.b]);
    return F.people
      .filter(p => p.parents.length === 2 && set.has(p.parents[0]) && set.has(p.parents[1]))
      .map(p => p.id);
  }
  function childrenOf(id) {
    return F.people.filter(p => p.parents.includes(id)).map(p => p.id);
  }
  function parentsOf(id) { return get(id).parents.slice(); }

  // ---------- derived: siblings (full / half), step-parents ----------
  function siblings(id) {
    const me = get(id);
    if (!me.parents.length) return { full: [], half: [] };
    const myP = new Set(me.parents);
    const full = [], half = [];
    F.people.forEach(p => {
      if (p.id === id || !p.parents.length) return;
      const shared = p.parents.filter(x => myP.has(x));
      if (shared.length === 2) full.push(p.id);
      else if (shared.length === 1) half.push(p.id);
    });
    return { full, half };
  }
  function stepParents(id) {
    const me = get(id);
    const bio = new Set(me.parents);
    const steps = new Set();
    me.parents.forEach(par => {
      unionsOf(par).forEach(u => {
        const other = partnerInUnion(u, par);
        if (!bio.has(other)) steps.add(other);
      });
    });
    return [...steps];
  }
  function stepChildren(id) {
    // people for whom `id` is a step-parent
    return F.people.filter(p => stepParents(p.id).includes(id)).map(p => p.id);
  }

  function sideLinksOf(id) {
    return F.sideLinks
      .filter(s => s.from === id || s.to === id)
      .map(s => ({ other: s.from === id ? s.to : s.from, kind: s.kind, detail: s.detail, raw: s }));
  }

  // ---------- event range ----------
  const allYears = [];
  F.people.forEach(p => { allYears.push(p.birth.year); if (p.death) allYears.push(p.death.year); });
  F.unions.forEach(u => allYears.push(u.year));
  const MIN_YEAR = Math.min(...allYears.filter(Number.isFinite));
  const MAX_YEAR = NOW;

  // age of person at a given year (clamped to death). returns null if not yet born.
  function ageAt(p, year) {
    if (p.birth.year == null || year < p.birth.year) return null;
    const end = p.death ? Math.min(year, p.death.year) : year;
    return end - p.birth.year;
  }
  // life status at year: 'unborn' | 'living' | 'dead'
  function statusAt(p, year) {
    if (p.birth.year == null) return 'unknown';
    if (year < p.birth.year) return 'unborn';
    if (p.death && p.death.year != null && year >= p.death.year) return 'dead';
    return 'living';
  }

  // ---------- life stages (by age) ----------
  // childhood 0–11 · youth 12–18 · adulthood 19–59 · later years 60+
  const STAGES = [
    { key: 'child',  label: 'Childhood',   from: 0,  to: 11 },
    { key: 'youth',  label: 'Youth',       from: 12, to: 18 },
    { key: 'adult',  label: 'Adulthood',   from: 19, to: 59 },
    { key: 'later',  label: 'Later years', from: 60, to: 200 },
  ];
  const STAGE_COLOR = {
    child: 'var(--stage-child)', youth: 'var(--stage-youth)',
    adult: 'var(--stage-adult)', later: 'var(--stage-later)',
  };
  function stageOfAge(age) {
    if (age == null || age < 0) return null;
    if (age <= 11) return 'child';
    if (age <= 18) return 'youth';
    if (age <= 59) return 'adult';
    return 'later';
  }
  // segments of a person's life (by birth year), split at stage boundaries.
  // returns [{key,label,startYear,endYear,color}] across birth..end (death or NOW).
  function lifeStageSegments(id) {
    const p = get(id);
    if (p.birth.year == null) return null;
    const birth = p.birth.year;
    const end = p.death ? p.death.year : NOW;
    const segs = [];
    STAGES.forEach(st => {
      const s = birth + st.from;
      const e = Math.min(birth + st.to + 1, end); // exclusive upper, clamp to end
      if (e <= s) return;
      if (s > end) return;
      segs.push({ key: st.key, label: st.label, startYear: Math.max(s, birth), endYear: e, color: STAGE_COLOR[st.key] });
    });
    return segs;
  }

  // ---------- per-person life events (with intersections) ----------
  // category drives color: self / family / loss
  function lifeEvents(id, lang) {
    const me = get(id);
    const ev = [];
    const nm = pid => fullName(get(pid), lang).split(' ')[0]; // first name
    ev.push({ year: me.birth.year, cat: 'birth', kind: 'self', tier: 'major', label: `Born in ${me.birth.place}`, post: me.birthPost });
    (me.milestones || []).forEach(m => ev.push({ year: m.year, cat: 'self', kind: 'self', tier: m.tier || 'minor',
      label: (lang === 'he' && m.he) ? m.he : m.en, post: (lang === 'he' && m.postHe) ? m.postHe : m.post,
      heLabel: m.he || '', hePost: m.postHe || '', hideStory: !!m.hideStory }));

    unionsOf(id).forEach(u => {
      const sp = partnerInUnion(u, id);
      ev.push({ year: u.year, cat: 'union', kind: 'partner', refId: sp, tier: 'major', post: (lang === 'he' && u.postHe) ? u.postHe : u.post,
        label: (u.type === 'marriage' ? 'Married ' : 'Partnered with ') + nm(sp) });
      if (u.endYear && u.endReason === 'death') {
        const spp = get(sp);
        if (spp.death) ev.push({ year: spp.death.year, cat: 'loss', kind: 'spouse-death', refId: sp, tier: 'major', label: `${nm(sp)} died` });
      }
    });
    // children births
    childrenOf(id).forEach(cid => {
      const c = get(cid);
      ev.push({ year: c.birth.year, cat: 'family', kind: 'child', refId: cid, tier: 'major',
        label: `${c.sex === 'f' ? 'Daughter' : 'Son'} ${nm(cid)} born` });
    });
    // sibling births (intersections)
    const sib = siblings(id);
    [...sib.full.map(s => ({ s, half: false })), ...sib.half.map(s => ({ s, half: true }))].forEach(({ s, half }) => {
      const sp = get(s);
      ev.push({ year: sp.birth.year, cat: 'family', kind: 'sibling', refId: s, tier: 'minor',
        label: `${half ? 'Half-' : ''}${sp.sex === 'f' ? 'sister' : 'brother'} ${nm(s)} born`.replace(/^H/, 'H') });
    });
    // parent deaths during life
    me.parents.forEach(par => {
      const pp = get(par);
      if (pp.death) ev.push({ year: pp.death.year, cat: 'loss', kind: 'parent-death', refId: par, tier: 'minor',
        label: `${pp.sex === 'f' ? 'Mother' : 'Father'} ${nm(par)} died` });
    });
    if (me.death) ev.push({ year: me.death.year, cat: 'death', kind: 'self', tier: 'major', label: `Died in ${me.death.place}`, post: me.deathPost });

    // structural (derived) events keep a STABLE integer index `ei` (used for
    // photo slot ids ph-<id>-e<ei>) so baked photos never shift.
    ev.sort((a, b) => a.year - b.year);
    ev.forEach((e, i) => { e.ei = i; e.key = 'e' + i; e.derived = true; e.effYear = e.year; });

    // ---- merge user-authored moments (may be UNDATED) ----
    // A moment stores year|null + a bucket (the key of the dated event it
    // follows, or 'start') + seq (order among undated siblings). Undated
    // moments inherit an interpolated effYear so they still place on the
    // scrubber; dated ones behave like structural events.
    const store = window.FTStore;
    const ums = (store && store.momentsFor) ? store.momentsFor(id) : [];
    const end = me.death ? me.death.year : NOW;
    const birthY = me.birth.year;
    const items = ev.slice();
    ums.forEach(m => {
      items.push({ year: (m.year == null ? null : m.year), cat: 'self', kind: 'self', tier: m.tier || 'minor',
        label: (lang === 'he' && m.titleHe) ? m.titleHe : (m.title || 'Untitled moment'),
        post: (lang === 'he' && m.textHe) ? m.textHe : (m.text || ''),
        heLabel: m.titleHe || '', hePost: m.textHe || '',
        place: m.place || null, hideStory: !!m.hideStory,
        user: true, mid: m.id, ei: m.ei, key: 'm' + m.id, bucket: m.bucket || 'start', seq: m.seq || 0,
        derived: false, effYear: m.year });
    });
    if (!ums.length) return items;   // fast path: no user moments

    const dated = items.filter(it => it.year != null).sort((a, b) => a.year - b.year);
    const undated = items.filter(it => it.year == null);
    const byBucket = {};
    undated.forEach(u => { (byBucket[u.bucket] = byBucket[u.bucket] || []).push(u); });
    Object.keys(byBucket).forEach(k => byBucket[k].sort((x, y) => x.seq - y.seq));
    const res = [];
    (byBucket['start'] || []).forEach(u => { u.effYear = birthY; u.yearLabel = 'at the start'; res.push(u); });
    dated.forEach((d, di) => {
      d.effYear = d.year; res.push(d);
      const kids = byBucket[d.key] || [];
      const nextY = dated[di + 1] ? dated[di + 1].year : end;
      kids.forEach((u, ki) => {
        u.effYear = d.year + (nextY - d.year) * ((ki + 1) / (kids.length + 1));
        u.yearLabel = (nextY > d.year) ? `between ${d.year} & ${nextY}` : `after ${d.year}`;
        res.push(u);
      });
    });
    // orphans (bucket anchor missing) → drop in just after birth
    const seen = new Set(res);
    items.forEach(it => { if (!seen.has(it)) { it.effYear = birthY; it.yearLabel = 'after ' + birthY; res.push(it); } });
    return res;
  }

  // ---------- when a person "joins" the visible tree ----------
  // blood members & founders appear at birth; married-in spouses join at marriage;
  // outsiders (side-link only) appear at birth. Dead people stay visible (dimmed).
  function appearsAt(p) {
    if(p.birth.year==null)return p.layoutAnchor ?? MIN_YEAR;
    return p.birth.year;
    if (p.parents.length) return p.birth.year;        // blood
    if (p.gen === 0) return p.birth.year;             // founder
    const us = unionsOf(p.id);
    if (us.length) return Math.min(...us.map(u => u.year)); // married-in → joins at marriage
    return p.birth.year;                              // outsider / lone
  }
  function visibleSet(year) {
    const s = new Set();
    F.people.forEach(p => { if (year >= appearsAt(p)) s.add(p.id); });
    return s;
  }

  // ================= LAYOUT (tidy top-down generational) =================
  const NODE_W = 172, SPOUSE_GAP = 10, GROUP_GAP = 46, ROW_H = 202;

  // Determine spouse-in vs lineage anchor.
  // A person is an "anchor" if they have parents OR are a designated founder of the main line.
  // Founders with a partner: the one with children-bearing union acts as anchor; partner is spouse-in.
  // Outsiders (no parents, only side-links) are handled separately.
  function buildGroups(vis) {
    const People = F.people.filter(p => vis.has(p.id));
    const Unions = F.unions.filter(u => vis.has(u.a) && vis.has(u.b));
    const outsiderIds = new Set(F.sideLinks.map(s => s.from).filter(fid => vis.has(fid) && get(fid).parents.length === 0 && unionsOf(fid).length === 0 && childrenOf(fid).every(cid => !vis.has(cid))));

    // anchors = people with parents, plus root founders that are part of the lineage.
    // Identify spouse-in: no parents AND partnered with someone who is lineage.
    const lineage = new Set();
    People.forEach(p => { if (p.parents.length) lineage.add(p.id); });

    // ownerOf: personId -> anchorId (the group it renders within)
    const ownerOf = {};
    // First, lineage people anchor their own groups.
    lineage.forEach(id => { ownerOf[id] = id; });
    // Founders: for each union where neither has parents, make one anchor, other spouse-in.
    Unions.forEach(u => {
      const aP = get(u.a).parents.length, bP = get(u.b).parents.length;
      if (!aP && !bP) {
        // founding couple — anchor = a, spouse-in = b (Yosef anchor, Miriam spouse)
        ownerOf[u.a] = u.a;
        ownerOf[u.b] = u.a;
      }
    });
    // Spouse-in (no parents, partnered to a lineage anchor): owned by the anchor.
    Unions.forEach(u => {
      [[u.a, u.b], [u.b, u.a]].forEach(([x, y]) => {
        if (!get(x).parents.length && ownerOf[x] === undefined) {
          // x is spouse-in to y (y has parents or is founder-anchor)
          if (lineage.has(y) || ownerOf[y] === y) ownerOf[x] = y;
        }
      });
    });
    // Anyone still unowned & not outsider = own single group
    People.forEach(p => { if (ownerOf[p.id] === undefined && !outsiderIds.has(p.id)) ownerOf[p.id] = p.id; });

    // Build group objects keyed by anchor
    const groups = {};
    Object.keys(ownerOf).forEach(pid => {
      const anchor = ownerOf[pid];
      if (!groups[anchor]) groups[anchor] = { id: anchor, anchor, members: [], gen: get(anchor).gen };
    });
    // Assemble member order per group: [firstSpouse, anchor, laterSpouses...]
    Object.values(groups).forEach(g => {
      const anchor = g.anchor;
      const us = unionsOf(anchor)
        .filter(u => vis.has(u.a) && vis.has(u.b))
        .filter(u => ownerOf[partnerInUnion(u, anchor)] === anchor) // spouse owned by this group
        .sort((x, y) => x.year - y.year);
      const spouses = us.map(u => partnerInUnion(u, anchor));
      if (spouses.length <= 1) {
        g.members = spouses.length ? [anchor, spouses[0]] : [anchor];
      } else {
        // multiple spouses: first to the left, anchor, rest to the right
        g.members = [spouses[0], anchor, ...spouses.slice(1)];
      }
      g.unions = us.map(u => u.id);
    });

    return { groups, ownerOf, outsiderIds: [...outsiderIds] };
  }

  function computeLayout(visibleIds) {
    const vis = (visibleIds instanceof Set) ? visibleIds : new Set(F.people.map(p => p.id));
    const { groups, ownerOf, outsiderIds } = buildGroups(vis);
    const groupList = Object.values(groups);
    const groupWidth = g => g.members.length * NODE_W + (g.members.length - 1) * SPOUSE_GAP;

    // child groups of a group (unique anchors of VISIBLE children across its unions), ordered by birth year
    function childGroupsOf(g) {
      const kids = [];
      g.unions.forEach(uid => {
        const u = F.unions.find(x => x.id === uid);
        childrenOfUnion(u).forEach(cid => { if (vis.has(cid)) kids.push(cid); });
      });
      // single-parent children (no visible union covering both parents) hang off the member directly
      g.members.forEach(mid => {
        childrenOf(mid).forEach(cid => {
          if (!vis.has(cid) || kids.indexOf(cid) !== -1) return;
          const c = get(cid);
          const unitedVis = c.parents.length === 2 && F.unions.some(u => vis.has(u.a) && vis.has(u.b) && [u.a, u.b].every(x => c.parents.includes(x)));
          if (!unitedVis) kids.push(cid);
        });
      });
      const seen = new Set(), res = [];
      kids.sort((a, b) => get(a).birth.year - get(b).birth.year)
        .forEach(cid => { const owner = ownerOf[cid]; if (owner && !seen.has(owner)) { seen.add(owner); res.push(owner); } });
      return res;
    }

    // gens map
    const byGen = {};
    groupList.forEach(g => { (byGen[g.gen] = byGen[g.gen] || []).push(g); });
    const maxGen = Math.max(...groupList.map(g => g.gen));

    // initial x by DFS from roots (founders with no parents)
    const roots = groupList.filter(g => get(g.anchor).parents.length === 0);
    let cursor = 0;
    const visited = new Set();
    function dfs(g) {
      if (visited.has(g.id)) return; visited.add(g.id);
      const ch = childGroupsOf(g);
      if (!ch.length) { g.center = cursor + groupWidth(g) / 2; cursor += groupWidth(g) + GROUP_GAP; }
      else { ch.forEach(cid => dfs(groups[cid])); g.center = (groups[ch[0]].center + groups[ch[ch.length - 1]].center) / 2; }
    }
    roots.sort((a, b) => get(a.anchor).birth.year - get(b.anchor).birth.year).forEach(dfs);
    // any unvisited
    groupList.forEach(g => { if (!visited.has(g.id)) { g.center = cursor + groupWidth(g) / 2; cursor += groupWidth(g) + GROUP_GAP; } });

    function resolveRow(gen) {
      const row = (byGen[gen] || []).slice().sort((a, b) => a.center - b.center);
      for (let i = 1; i < row.length; i++) {
        const need = groupWidth(row[i - 1]) / 2 + GROUP_GAP + groupWidth(row[i]) / 2;
        if (row[i].center - row[i - 1].center < need) row[i].center = row[i - 1].center + need;
      }
    }

    // relaxation
    for (let pass = 0; pass < 60; pass++) {
      // bottom-up: parent center -> avg child centers
      for (let gen = maxGen - 1; gen >= 0; gen--) {
        (byGen[gen] || []).forEach(g => {
          const ch = childGroupsOf(g);
          if (ch.length) {
            const c = ch.map(cid => groups[cid].center);
            g.center = (Math.min(...c) + Math.max(...c)) / 2;
          }
        });
        resolveRow(gen);
      }
      // top-down: shift children block so its centroid sits under parent
      for (let gen = 0; gen < maxGen; gen++) {
        (byGen[gen] || []).forEach(g => {
          const ch = childGroupsOf(g);
          if (ch.length > 1) {
            const c = ch.map(cid => groups[cid].center);
            const mid = (Math.min(...c) + Math.max(...c)) / 2;
            const delta = g.center - mid;
            if (Math.abs(delta) > 0.5) ch.forEach(cid => { groups[cid].center += delta; });
          }
        });
        resolveRow(gen + 1);
      }
    }

    // place outsiders as satellites at the far-left edge of their generation row
    // (connected only by dashed side-links — keeps them out of the blood-sibling clusters)
    outsiderIds.forEach(oid => {
      const gen = get(oid).gen;
      const rowGroups = (byGen[gen] || []).filter(g => !g.outsider);
      const minEdge = rowGroups.length ? Math.min(...rowGroups.map(g => g.center - groupWidth(g) / 2)) : 0;
      const existing = (byGen[gen] || []).filter(g => g.outsider).length;
      const g = { id: oid, anchor: oid, members: [oid], gen, outsider: true,
        center: minEdge - NODE_W / 2 - 150 - existing * (NODE_W + GROUP_GAP) };
      groups[oid] = g; (byGen[gen] = byGen[gen] || []).push(g);
    });

    // compute node positions
    const pos = {}; // personId -> {x,y,cx,cy}
    Object.values(groups).forEach(g => {
      const gw = groupWidth(g);
      g.members.forEach((mid, i) => {
        const cx = g.center - gw / 2 + i * (NODE_W + SPOUSE_GAP) + NODE_W / 2;
        const cy = g.gen * ROW_H + NODE_W * 0; // y top of row band
        pos[mid] = { cx, cy: g.gen * ROW_H, gen: g.gen };
      });
    });

    // normalize: center the whole tree horizontally on the founders (gen-0),
    // so the tree grows symmetrically from the centre as people are added.
    const xs = Object.values(pos).map(p => p.cx);
    const minXraw = Math.min(...xs), maxXraw = Math.max(...xs);
    const gen0 = groupList.filter(g => g.gen === 0 && !g.outsider);
    const anchorX = gen0.length
      ? gen0.reduce((s, g) => s + g.center, 0) / gen0.length
      : (minXraw + maxXraw) / 2;
    Object.values(pos).forEach(p => { p.cx -= anchorX; });
    const minX = minXraw - anchorX, maxX = maxXraw - anchorX;
    const width = maxX - minX;
    const maxGenAll = Math.max(...Object.values(pos).map(p => p.gen));
    const height = (maxGenAll + 1) * ROW_H;

    // connectors (only unions whose both partners are visible)
    const parentLinks = [];
    F.unions.forEach(u => {
      if (!vis.has(u.a) || !vis.has(u.b)) return;
      const aPos = pos[u.a], bPos = pos[u.b];
      if (!aPos || !bPos) return;
      const kids = childrenOfUnion(u).filter(cid => vis.has(cid))
        .map(cid => ({ id: cid, cx: pos[cid].cx, cy: pos[cid].cy, year: get(cid).birth.year }));
      const jx = (aPos.cx + bPos.cx) / 2;
      parentLinks.push({ unionId: u.id, year: u.year, type: u.type,
        ax: aPos.cx, bx: bPos.cx, y: aPos.cy, jx, jy: aPos.cy, kids });
    });

    // side link endpoints (only when both ends visible)
    const sideLinkGeo = F.sideLinks.filter(s => vis.has(s.from) && vis.has(s.to)).map(s => ({
      from: s.from, to: s.to, kind: s.kind, detail: s.detail,
      x1: pos[s.from].cx, y1: pos[s.from].cy, x2: pos[s.to].cx, y2: pos[s.to].cy,
    }));

    return { pos, width, height, minX, maxX, maxY: height, parentLinks, sideLinkGeo, NODE_W, ROW_H, maxGen, outsiderIds };
  }

  // ---------- relationship of toId *to* fromId ("toId is the ___ of fromId") ----------
  function relationOf(fromId, toId, lang) {
    if (fromId === toId) return null;
    const me = get(fromId), t = get(toId);
    if (!me || !t) return null;
    const he = lang === 'he';
    // noun(en-male, en-female, he-male, he-female) — picks language then gender
    const noun = (em, ef, hm, hf) => he ? (t.sex === 'f' ? hf : hm) : (t.sex === 'f' ? ef : em);
    const has = (arr, id) => arr.indexOf(id) !== -1;

    // immediate family
    if (has(me.parents, toId)) return noun('Father', 'Mother', 'אבא', 'אמא');
    if (has(t.parents, fromId)) return noun('Son', 'Daughter', 'בן', 'בת');
    const sib = siblings(fromId);
    if (has(sib.full, toId)) return noun('Brother', 'Sister', 'אח', 'אחות');
    if (has(sib.half, toId)) return noun('Half-brother', 'Half-sister', 'אח למחצה', 'אחות למחצה');
    const u = unionsOf(fromId).find(x => partnerInUnion(x, fromId) === toId);
    if (u) return u.type === 'partnership' ? noun('Partner', 'Partner', 'בן זוג', 'בת זוג') : noun('Husband', 'Wife', 'בעל', 'אישה');

    // grandparents / grandchildren
    const gp = me.parents.flatMap(p => (get(p) ? get(p).parents : []));
    if (has(gp, toId)) return noun('Grandfather', 'Grandmother', 'סבא', 'סבתא');
    const gc = childrenOf(fromId).flatMap(c => childrenOf(c));
    if (has(gc, toId)) return noun('Grandson', 'Granddaughter', 'נכד', 'נכדה');
    const ggp = gp.flatMap(p => (get(p) ? get(p).parents : []));
    if (has(ggp, toId)) return noun('Great-grandfather', 'Great-grandmother', 'סבא רבא', 'סבתא רבתא');
    const ggc = gc.flatMap(c => childrenOf(c));
    if (has(ggc, toId)) return noun('Great-grandson', 'Great-granddaughter', 'נין', 'נינה');

    // aunts/uncles, nieces/nephews, cousins
    const parentSibs = new Set();
    me.parents.forEach(p => { const s = siblings(p); s.full.concat(s.half).forEach(x => parentSibs.add(x)); });
    if (parentSibs.has(toId)) return noun('Uncle', 'Aunt', 'דוד', 'דודה');
    const sibKids = new Set();
    sib.full.concat(sib.half).forEach(s => childrenOf(s).forEach(x => sibKids.add(x)));
    if (sibKids.has(toId)) return noun('Nephew', 'Niece', 'אחיין', 'אחיינית');
    const cousins = new Set();
    parentSibs.forEach(ps => childrenOf(ps).forEach(x => cousins.add(x)));
    if (cousins.has(toId)) return noun('Cousin', 'Cousin', 'בן דוד', 'בת דודה');

    // in-laws
    const spouses = unionsOf(fromId).map(x => partnerInUnion(x, fromId));
    const inlawParents = new Set();
    spouses.forEach(sp => (get(sp) ? get(sp).parents : []).forEach(x => inlawParents.add(x)));
    if (inlawParents.has(toId)) return noun('Father-in-law', 'Mother-in-law', 'חם', 'חמות');
    const childInlaw = new Set();
    childrenOf(fromId).forEach(c => unionsOf(c).forEach(x => childInlaw.add(partnerInUnion(x, c))));
    if (childInlaw.has(toId)) return noun('Son-in-law', 'Daughter-in-law', 'חתן', 'כלה');
    const sibInlaw = new Set();
    spouses.forEach(sp => { const s = siblings(sp); s.full.concat(s.half).forEach(x => sibInlaw.add(x)); });
    sib.full.concat(sib.half).forEach(s => unionsOf(s).forEach(x => sibInlaw.add(partnerInUnion(x, s))));
    if (sibInlaw.has(toId)) return noun('Brother-in-law', 'Sister-in-law', 'גיס', 'גיסה');

    // step relations
    if (has(stepParents(fromId), toId)) return noun('Step-father', 'Step-mother', 'אב חורג', 'אם חורגת');
    if (has(stepChildren(fromId), toId)) return noun('Step-son', 'Step-daughter', 'בן חורג', 'בת חורגת');

    // non-blood side links
    const sl = sideLinksOf(fromId).find(l => l.other === toId);
    if (sl && sl.kind) return sl.kind.charAt(0).toUpperCase() + sl.kind.slice(1);

    return noun('Relative', 'Relative', 'קרוב משפחה', 'קרובת משפחה');
  }

  window.REL = {
    F, byId, get, isLiving, fullName, NOW, MIN_YEAR, MAX_YEAR,
    setNameMode, getNameMode, setNameYear, usesBirthName, nameChangeOf, bornName,
    unionsOf, partnerInUnion, childrenOfUnion, childrenOf, parentsOf,
    siblings, stepParents, stepChildren, sideLinksOf,
    ageAt, statusAt, lifeEvents, computeLayout, appearsAt, visibleSet,
    stageOfAge, lifeStageSegments, STAGES, STAGE_COLOR,
    relationOf,
    NODE_W, ROW_H,
  };
})();
