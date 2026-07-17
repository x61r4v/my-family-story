// tree-store.js — change tracking + publish ("chat = server, baseline = database").
//
// The WORKING COPY of the family record is two shared sidecar files:
//   .image-slots.state.json  photo drops & crops (written by <image-slot>)
//   .ft-doc.state.json       this doc: ops log + tree-exclusion overrides
// The BASELINE is tree-seed.js (window.FT_SEED) — only Claude edits it, when
// someone pastes a change-set from the Save dialog into the project chat.
//
// Every change (photo add/replace/remove, avatar crop, hide/show on tree)
// is recorded as an op {ts, kind, id|key, label, prevRaw, pub}. Ops carry
// enough to REVERT (prevRaw = the raw sidecar value before the change) but
// not the new value — that lives in the slots sidecar itself, so the doc
// stays small and the pasted change-set is tiny.
(function () {
  const FILE = '.ft-doc.state.json';
  const OPS_CAP = 80;
  const PREV_KEEP = 25; // newest N photo-ops keep their revert payload

  const seed = () => window.FT_SEED || { seedStamp: 0, baseV: 0, slots: {}, excluded: [] };

  let doc = { v: 1, seedStamp: seed().seedStamp || 0, baseV: seed().baseV || 0, excluded: {}, ops: [], moments: {}, momentLog: [], edits: {}, struct: { people: {}, delPeople: {}, unions: {}, delUnions: {}, sides: [], delSides: [] }, migrated: 0 };
  let loaded = false;
  let loadP = null;
  const preOps = [];        // ops recorded before the sidecar fetch resolved
  const preExcl = {};       // ditto for exclusion overrides
  const future = [];        // in-memory redo stack: [{ op, nextRaw|nextOv }]
  const subs = new Set();
  const notify = () => {
    subs.forEach((f) => { try { f(); } catch (e) {} });
    try { window.dispatchEvent(new Event('ft-doc-changed')); } catch (e) {}
  };

  // Serialized writes, same pattern as image-slot.js.
  let saving = false, dirty = false;
  function save() {
    if (!loaded) return; // load() always ends in a save if anything queued
    if (saving) { dirty = true; return; }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(FILE, JSON.stringify(doc)))
      .catch(() => {})
      .then(() => { saving = false; if (dirty) { dirty = false; save(); } });
  }

  function prune() {
    if (doc.ops.length > OPS_CAP) doc.ops = doc.ops.slice(-OPS_CAP);
    const photo = doc.ops.filter((o) => o.id);
    const keep = new Set(photo.slice(-PREV_KEEP).map((o) => o.ts));
    doc.ops.forEach((o) => {
      if (o.id && o.prevRaw && o.prevRaw.u && !keep.has(o.ts)) {
        o.prevRaw = Object.assign({}, o.prevRaw);
        delete o.prevRaw.u;
        o.prevLost = 1;
      }
    });
  }

  // Human label for a slot id / exclusion key, resolved from the family data.
  function labelFor(kind, id, key) {
    const m = /^(ph|av)-(.+)-e(\d+)$/.exec(id || ('ph-' + (key || '') + '')) ||
              (key ? [null, 'ph', key.replace(/-e\d+$/, ''), (key.match(/-e(\d+)$/) || [])[1]] : null);
    let who = '', ev = '';
    try {
      const R = window.REL;
      if (m && R) {
        const p = R.get(m[2]);
        if (p) who = R.fullName(p, 'en');
        const e = R.lifeEvents(m[2], 'en').find((x) => x.ei === +m[3]);
        if (e) ev = `${e.label} (${e.year != null ? e.year : e.yearLabel || 'undated'})`;
      }
    } catch (e) {}
    const act = { 'photo-add': 'photo added', 'photo-replace': 'photo replaced', 'photo-remove': 'photo removed',
      'crop': 'avatar crop', 'tree-hide': 'hidden from tree', 'tree-show': 'shown on tree' }[kind] || kind;
    return [who, act, ev].filter(Boolean).join(' · ');
  }

  function recordOp(op) {
    future.length = 0;
    if (!loaded) preOps.push(op);
    doc.ops = [...doc.ops, op];
    prune();
    save();
    notify();
  }

  // Effective "has a visible photo" for a raw sidecar value (undefined = seed).
  function effHas(id, raw) {
    if (raw === undefined) { const s = seed().slots[id]; return !!(s && s.src); }
    if (raw && raw.del) return false;
    if (typeof raw === 'string') return !!raw;
    if (raw && raw.u) return true;
    const s = seed().slots[id]; return !!(s && s.src); // framing-only entry
  }

  function isExcludedBase(k) {
    const ov = doc.excluded[k];
    if (typeof ov === 'boolean') return ov;
    return (seed().excluded || []).indexOf(k) >= 0;
  }

  // Restore helpers (never record ops themselves).
  function restoreSlot(id, raw) {
    const S = window.ImageSlotStore;
    if (S && S.restore) S.restore(id, raw === undefined ? null : raw);
  }
  function restoreOv(key, ov) {
    if (ov === undefined) delete doc.excluded[key];
    else doc.excluded[key] = ov;
    try { window.dispatchEvent(new Event('ft-tree-changed')); } catch (e) {}
  }

  function revertOp(op) {
    if (STRUCT_KINDS[op.kind]) return revertStructOp(op);
    if (op.id) {
      if (op.prevLost) return false; // revert payload pruned — can't restore
      restoreSlot(op.id, op.prevNone ? undefined : op.prevRaw);
    } else if (op.ekey) {
      applyLive(op.ekey, op.prevV);
      if (op.prevENone) delete doc.edits[op.ekey]; else doc.edits[op.ekey] = op.prevV;
    } else if (op.key) {
      restoreOv(op.key, op.prevOvNone ? undefined : op.prevOv);
    }
    return true;
  }

  function load() {
    if (loadP) return loadP;
    loadP = fetch(FILE)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j === 'object' && j.v === 1) {
          doc = j;
          if (!doc.ops) doc.ops = [];
          if (!doc.excluded) doc.excluded = {};
          if (!doc.moments) doc.moments = {};
          if (!doc.momentLog) doc.momentLog = [];
          if (!doc.edits) doc.edits = {};
          if (!doc.struct) doc.struct = { people: {}, delPeople: {}, unions: {}, delUnions: {}, sides: [], delSides: [] };
          ['people', 'delPeople', 'unions', 'delUnions'].forEach((k) => { if (!doc.struct[k]) doc.struct[k] = {}; });
          ['sides', 'delSides'].forEach((k) => { if (!doc.struct[k]) doc.struct[k] = []; });
        }
        // Newer baseline arrived (Claude baked a change-set): published ops
        // are now part of the seed — drop them; unpublished ops survive.
        const sd = seed();
        if ((doc.seedStamp || 0) < (sd.seedStamp || 0)) {
          doc.ops = doc.ops.filter((o) => !o.pub);
          doc.momentLog = (doc.momentLog || []).filter((o) => !o.pub);
          doc.seedStamp = sd.seedStamp;
          doc.baseV = sd.baseV;
          // prune struct entries whose ops were published (they're in the seed now)
          const keepPid = new Set(doc.ops.filter((o) => o.pid).map((o) => o.pid));
          const keepUid = new Set(doc.ops.filter((o) => o.uid).map((o) => o.uid));
          Object.keys(doc.struct.people).forEach((id) => { if (!keepPid.has(id)) delete doc.struct.people[id]; });
          Object.keys(doc.struct.delPeople).forEach((id) => { if (!keepPid.has(id)) delete doc.struct.delPeople[id]; });
          Object.keys(doc.struct.unions).forEach((id) => { if (!keepUid.has(id)) delete doc.struct.unions[id]; });
          Object.keys(doc.struct.delUnions).forEach((id) => { if (!keepUid.has(id)) delete doc.struct.delUnions[id]; });
          const sideKey = (s) => s.from + '>' + s.to + '>' + s.kind;
          const keepSide = new Set(doc.ops.filter((o) => o.side).map((o) => sideKey(o.side)));
          doc.struct.sides = doc.struct.sides.filter((s) => keepSide.has(sideKey(s)));
          doc.struct.delSides = doc.struct.delSides.filter((s) => keepSide.has(sideKey(s)));
          // prune overrides that now match the baseline
          Object.keys(doc.excluded).forEach((k) => {
            if (doc.excluded[k] === ((sd.excluded || []).indexOf(k) >= 0)) delete doc.excluded[k];
          });
        }
        // Changes that raced ahead of the fetch.
        if (preOps.length) { doc.ops = [...doc.ops, ...preOps]; preOps.length = 0; }
        Object.assign(doc.excluded, preExcl);
        // One-time migration: photos already sitting in the slots sidecar
        // (from before this system existed) become pending "photo added" ops
        // so they can be committed too. Old localStorage exclusions move in.
        if (!doc.migrated) {
          doc.migrated = 1;
          try {
            const old = JSON.parse(localStorage.getItem('ft.treeExclude') || '[]');
            old.forEach((k) => {
              if (!isExcludedBase(k)) {
                doc.excluded[k] = true;
                doc.ops.push({ ts: Date.now(), kind: 'tree-hide', key: k, label: labelFor('tree-hide', null, k), prevOvNone: 1, pub: false });
              }
            });
          } catch (e) {}
          const S = window.ImageSlotStore;
          const seedMigration = () => {
            let added = false;
            (S.ids() || []).forEach((id, i) => {
              if (seed().slots[id]) return;
              if (!/^(ph|av)-/.test(id)) return;
              const kind = id.slice(0, 2) === 'av' ? 'crop' : 'photo-add';
              doc.ops.push({ ts: Date.now() - 1000 + i, kind, id, label: labelFor(kind, id), prevNone: 1, pub: false });
              added = true;
            });
            if (added) { prune(); save(); notify(); }
          };
          if (S) {
            if (S.ready()) seedMigration();
            else { const un = S.subscribe(() => { if (S.ready()) { un(); seedMigration(); } }); }
          }
        }
      })
      .catch(() => {})
      .then(() => { loaded = true; applyStructLive(); applyAllEdits(); save(); notify(); });
    return loadP;
  }

  // ---- field edits (Records Room) — doc.edits[ekey] = value ----
  // ekey grammar:  p:<personId>:<dot.path>   person field (name.en, bio.en, bio.he, birth.year, death.place, sheet.look …)
  //                m:<personId>:<idx>:<field> milestone field (en, he, post, postHe, year, tier, hideStory)
  //                u:<unionId>:<field>        union field (year, endYear)
  //                w:<evId>                   world-event on/off (bool; wevEnabled consults this)
  // Values are applied LIVE onto window.FAMILY objects (relationships.js reads them
  // by reference), and persist in the sidecar until Claude bakes them into family-data.js.
  function personOf(id) { return ((window.FAMILY && window.FAMILY.people) || []).find((x) => x.id === id); }
  function readLive(ekey) {
    const a = ekey.split(':');
    try {
      if (a[0] === 'p') { let o = personOf(a[1]); for (const k of a[2].split('.')) { if (o == null) return null; o = o[k]; } return o === undefined ? null : o; }
      if (a[0] === 'm') { const p = personOf(a[1]); const m = p && p.milestones && p.milestones[+a[2]]; return m ? (m[a[3]] === undefined ? null : m[a[3]]) : null; }
      if (a[0] === 'u') { const u = ((window.FAMILY && window.FAMILY.unions) || []).find((x) => x.id === a[1]); return u ? (u[a[2]] === undefined ? null : u[a[2]]) : null; }
      if (a[0] === 'w') { const e = (window.WORLD_EVENTS_ALL || []).find((x) => x.id === a[1]); if (a[2]) return e ? (e[a[2]] === undefined ? null : e[a[2]]) : null; const ov = doc.edits['w:' + a[1]]; return ov === undefined ? !(e && e.off) : !!ov; }
    } catch (e) {}
    return null;
  }
  function applyLive(ekey, v) {
    const a = ekey.split(':');
    try {
      if (a[0] === 'p') {
        const p = personOf(a[1]);
        if (p) {
          const path = a[2].split('.');
          if (path[0] === 'death' && path[1] === 'year' && (v == null || v === '')) { p.death = null; }
          else if (path[0] === 'death' && path[1] === 'place' && !p.death) { /* no death year yet — ignore */ }
          else if (path.length === 2) {
            if (!p[path[0]]) p[path[0]] = (path[0] === 'birth' || path[0] === 'death') ? { year: 0, place: '' } : {};
            p[path[0]][path[1]] = (path[1] === 'year') ? (v == null ? null : +v) : v;
          } else { p[path[0]] = v; }
        }
      } else if (a[0] === 'm') {
        const p = personOf(a[1]); const m = p && p.milestones && p.milestones[+a[2]];
        if (m) { if (a[3] === 'year') m.year = +v; else m[a[3]] = v; }
      } else if (a[0] === 'u') {
        const u = ((window.FAMILY && window.FAMILY.unions) || []).find((x) => x.id === a[1]);
        if (u) { if (v == null || v === '') delete u[a[2]]; else u[a[2]] = /year/i.test(a[2]) ? +v : v; }
      } else if (a[0] === 'w' && a[2]) {
        const e = (window.WORLD_EVENTS_ALL || []).find((x) => x.id === a[1]);
        if (e) { if (v == null || v === '') delete e[a[2]]; else e[a[2]] = v; }
      } // bare 'w:<id>' needs no live mutation — the wevEnabled wrapper reads doc.edits
    } catch (e) {}
    try { window.dispatchEvent(new Event('ft-tree-changed')); } catch (e) {}
  }
  function applyAllEdits() { Object.keys(doc.edits || {}).forEach((k) => { if (k[0] !== 'w') applyLive(k, doc.edits[k]); }); }

  // ---- structural layer (Edit mode): new/removed people, unions, side-links ----
  // Working-copy additions live in doc.struct and are applied LIVE onto window.FAMILY
  // (REL.byId re-indexed) until Claude bakes them into family-data.js.
  const STRUCT_KINDS = { 'person-add': 1, 'person-remove': 1, 'union-add': 1, 'union-remove': 1, 'side-add': 1, 'side-remove': 1 };
  function spliceOut(arr, pred) { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) arr.splice(i, 1); }
  function liveAddPerson(p) { const F = window.FAMILY; if (F && p && !F.people.some((x) => x.id === p.id)) { F.people.push(p); if (window.REL) window.REL.byId[p.id] = p; } }
  function liveRemovePerson(id) { const F = window.FAMILY; if (!F) return; spliceOut(F.people, (x) => x.id === id); if (window.REL) delete window.REL.byId[id]; }
  function treeChanged() { try { window.dispatchEvent(new Event('ft-tree-changed')); } catch (e) {} }
  function applyStructLive() {
    const F = window.FAMILY; if (!F) return;
    Object.keys(doc.struct.people).forEach((id) => liveAddPerson(doc.struct.people[id]));
    Object.keys(doc.struct.delPeople).forEach((id) => liveRemovePerson(id));
    Object.keys(doc.struct.unions).forEach((uid) => { if (!F.unions.some((u) => u.id === uid)) F.unions.push(doc.struct.unions[uid]); });
    Object.keys(doc.struct.delUnions).forEach((uid) => spliceOut(F.unions, (u) => u.id === uid));
    doc.struct.sides.forEach((s) => { if (!F.sideLinks.some((x) => x.from === s.from && x.to === s.to && x.kind === s.kind)) F.sideLinks.push(s); });
    doc.struct.delSides.forEach((s) => spliceOut(F.sideLinks, (x) => x.from === s.from && x.to === s.to && x.kind === s.kind));
    treeChanged();
  }
  function revertStructOp(op) {
    const F = window.FAMILY; if (!F) return false;
    if (op.kind === 'person-add') {
      delete doc.struct.people[op.pid];
      liveRemovePerson(op.pid);
    } else if (op.kind === 'person-remove') {
      if (op.prevNew) doc.struct.people[op.pid] = op.prevNew; else delete doc.struct.delPeople[op.pid];
      liveAddPerson(op.prevNew || op.prevPerson);
      (op.kids || []).forEach((k) => {
        const c = F.people.find((x) => x.id === k.id);
        if (c) c.parents = k.parents.slice();
        if (k.prevE === undefined) delete doc.edits['p:' + k.id + ':parents'];
        else doc.edits['p:' + k.id + ':parents'] = k.prevE;
      });
      (op.unions || []).forEach((e) => {
        if (e.wasNew) doc.struct.unions[e.u.id] = e.u; else delete doc.struct.delUnions[e.u.id];
        if (!F.unions.some((u) => u.id === e.u.id)) F.unions.push(e.u);
      });
      (op.sides || []).forEach((e) => {
        if (e.wasNew) doc.struct.sides.push(e.s);
        else doc.struct.delSides = doc.struct.delSides.filter((x) => !(x.from === e.s.from && x.to === e.s.to && x.kind === e.s.kind));
        F.sideLinks.push(e.s);
      });
    } else if (op.kind === 'union-add') {
      delete doc.struct.unions[op.uid];
      spliceOut(F.unions, (u) => u.id === op.uid);
    } else if (op.kind === 'union-remove') {
      if (op.prevNew) doc.struct.unions[op.uid] = op.prevNew; else delete doc.struct.delUnions[op.uid];
      const u = op.prevNew || op.prevUnion;
      if (u && !F.unions.some((x) => x.id === u.id)) F.unions.push(u);
    } else if (op.kind === 'side-add') {
      doc.struct.sides = doc.struct.sides.filter((x) => !(x.from === op.side.from && x.to === op.side.to && x.kind === op.side.kind));
      spliceOut(F.sideLinks, (x) => x.from === op.side.from && x.to === op.side.to && x.kind === op.side.kind);
    } else if (op.kind === 'side-remove') {
      if (op.wasNew) doc.struct.sides.push(op.side);
      else doc.struct.delSides = doc.struct.delSides.filter((x) => !(x.from === op.side.from && x.to === op.side.to && x.kind === op.side.kind));
      if (!F.sideLinks.some((x) => x.from === op.side.from && x.to === op.side.to && x.kind === op.side.kind)) F.sideLinks.push(op.side);
    }
    treeChanged();
    return true;
  }

  const FTStore = {
    get doc() { return doc; },
    ready() { return loaded; },
    subscribe(fn) { subs.add(fn); load(); return () => subs.delete(fn); },

    // Called by image-slot.js on EVERY slot write (raw values, before/after).
    onSlotChange(id, prevRaw, nextRaw) {
      if (FTStore._self) return;
      if (!/^(ph|av)-/.test(id)) return;
      if (JSON.stringify(prevRaw) === JSON.stringify(nextRaw)) return;
      const isAv = id.slice(0, 2) === 'av';
      const had = effHas(id, prevRaw), has = effHas(id, nextRaw);
      const kind = isAv ? 'crop' : (!had && has) ? 'photo-add' : (had && !has) ? 'photo-remove' : 'photo-replace';
      const op = { ts: Date.now(), kind, id, label: labelFor(kind, id), pub: false };
      if (prevRaw === undefined) op.prevNone = 1; else op.prevRaw = prevRaw;
      recordOp(op);
    },

    isExcluded(k) { return isExcludedBase(k); },    setExcluded(k, ex) {
      const prev = doc.excluded[k]; // may be undefined
      if (isExcludedBase(k) === !!ex) return;
      doc.excluded[k] = !!ex;
      if (!loaded) preExcl[k] = !!ex;
      const kind = ex ? 'tree-hide' : 'tree-show';
      const op = { ts: Date.now(), kind, key: k, label: labelFor(kind, null, k), pub: false };
      if (prev === undefined) op.prevOvNone = 1; else op.prevOv = prev;
      recordOp(op);
    },

    // ---- field edits (Records Room) ----
    editField(ekey, value, label) {
      const prevMap = doc.edits[ekey];
      const prevV = readLive(ekey);
      if (JSON.stringify(prevV == null ? null : prevV) === JSON.stringify(value == null ? null : value)) return false;
      const op = { ts: Date.now(), kind: 'edit', ekey, label: label || ekey, prevV: prevV === undefined ? null : prevV, pub: false };
      if (prevMap === undefined) op.prevENone = 1;
      doc.edits[ekey] = value;
      applyLive(ekey, value);
      recordOp(op);
      return true;
    },
    worldOn(ev) { const ov = doc.edits['w:' + ev.id]; return ov === undefined ? !ev.off : !!ov; },
    setWorldOn(ev, on) { return this.editField('w:' + ev.id, !!on, (ev.title || ev.id) + (on ? ' · added to the world band' : ' · removed from the world band')); },

    // ---- structural edits (Edit mode) ----
    setParents(id, arr, label) {
      let who = id; try { who = window.REL.fullName(window.REL.get(id), 'en'); } catch (e) {}
      return this.editField('p:' + id + ':parents', (arr || []).slice(), label || (who + ' · parents changed'));
    },
    structAddPerson(seed, label) {
      const F = window.FAMILY;
      if (!seed || !seed.id || F.people.some((p) => p.id === seed.id)) return false;
      seed.parents = seed.parents || []; seed.milestones = seed.milestones || [];
      doc.struct.people[seed.id] = seed;
      liveAddPerson(seed);
      recordOp({ ts: Date.now(), kind: 'person-add', pid: seed.id, label: label || (((seed.name && seed.name.en) || seed.id) + ' · added to the tree'), pub: false });
      treeChanged();
      return true;
    },
    // persist in-place mutations of a struct-added (not yet baked) person — the
    // person-add op covers the whole object, so no extra op is recorded
    structTouch(pid, label) {
      if (pid && label) { const op = doc.ops.find((o) => o.kind === 'person-add' && o.pid === pid); if (op) op.label = label; }
      save(); notify(); treeChanged();
    },
    structRemovePerson(id, label) {
      const F = window.FAMILY;
      const p = F.people.find((x) => x.id === id); if (!p) return false;
      let who = id; try { who = window.REL.fullName(p, 'en'); } catch (e) {}
      const op = { ts: Date.now(), kind: 'person-remove', pid: id, label: label || (who + ' · removed from the tree'), pub: false };
      if (doc.struct.people[id]) { op.prevNew = doc.struct.people[id]; delete doc.struct.people[id]; }
      else { op.prevPerson = p; doc.struct.delPeople[id] = 1; }
      op.kids = F.people.filter((c) => c.parents && c.parents.includes(id)).map((c) => ({ id: c.id, parents: c.parents.slice(), prevE: doc.edits['p:' + c.id + ':parents'] }));
      op.kids.forEach((k) => { const c = F.people.find((x) => x.id === k.id); c.parents = c.parents.filter((x) => x !== id); doc.edits['p:' + k.id + ':parents'] = c.parents.slice(); });
      op.unions = F.unions.filter((u) => u.a === id || u.b === id).map((u) => ({ u, wasNew: !!doc.struct.unions[u.id] }));
      op.unions.forEach((e) => { if (e.wasNew) delete doc.struct.unions[e.u.id]; else doc.struct.delUnions[e.u.id] = 1; });
      spliceOut(F.unions, (u) => u.a === id || u.b === id);
      op.sides = F.sideLinks.filter((s) => s.from === id || s.to === id).map((s) => ({ s, wasNew: doc.struct.sides.some((x) => x.from === s.from && x.to === s.to && x.kind === s.kind) }));
      op.sides.forEach((e) => { doc.struct.sides = doc.struct.sides.filter((x) => !(x.from === e.s.from && x.to === e.s.to && x.kind === e.s.kind)); if (!e.wasNew) doc.struct.delSides.push({ from: e.s.from, to: e.s.to, kind: e.s.kind }); });
      spliceOut(F.sideLinks, (s) => s.from === id || s.to === id);
      liveRemovePerson(id);
      recordOp(op);
      treeChanged();
      return true;
    },
    structAddUnion(u, label) {
      const F = window.FAMILY;
      if (!u || !u.id || F.unions.some((x) => x.id === u.id)) return false;
      doc.struct.unions[u.id] = u;
      F.unions.push(u);
      recordOp({ ts: Date.now(), kind: 'union-add', uid: u.id, label: label || 'Union added', pub: false });
      treeChanged();
      return true;
    },
    structRemoveUnion(uid, label) {
      const F = window.FAMILY;
      const u = F.unions.find((x) => x.id === uid); if (!u) return false;
      const op = { ts: Date.now(), kind: 'union-remove', uid, label: label || 'Union removed', pub: false };
      if (doc.struct.unions[uid]) { op.prevNew = doc.struct.unions[uid]; delete doc.struct.unions[uid]; }
      else { op.prevUnion = u; doc.struct.delUnions[uid] = 1; }
      spliceOut(F.unions, (x) => x.id === uid);
      recordOp(op);
      treeChanged();
      return true;
    },
    structAddSide(s, label) {
      const F = window.FAMILY;
      if (!s || !s.from || !s.to) return false;
      if (F.sideLinks.some((x) => x.from === s.from && x.to === s.to && x.kind === s.kind)) return false;
      doc.struct.sides.push(s);
      F.sideLinks.push(s);
      recordOp({ ts: Date.now(), kind: 'side-add', side: { from: s.from, to: s.to, kind: s.kind }, label: label || ('“' + s.kind + '” link added'), pub: false });
      treeChanged();
      return true;
    },
    structRemoveSide(s, label) {
      const F = window.FAMILY;
      const idx = F.sideLinks.findIndex((x) => x.from === s.from && x.to === s.to && x.kind === s.kind); if (idx < 0) return false;
      const wasNew = doc.struct.sides.some((x) => x.from === s.from && x.to === s.to && x.kind === s.kind);
      if (wasNew) doc.struct.sides = doc.struct.sides.filter((x) => !(x.from === s.from && x.to === s.to && x.kind === s.kind));
      else doc.struct.delSides.push({ from: s.from, to: s.to, kind: s.kind });
      const removed = F.sideLinks.splice(idx, 1)[0];
      recordOp({ ts: Date.now(), kind: 'side-remove', side: { from: removed.from, to: removed.to, kind: removed.kind }, wasNew, label: label || ('“' + removed.kind + '” link removed'), pub: false });
      treeChanged();
      return true;
    },

    canUndo() { return doc.ops.length > 0 && !doc.ops[doc.ops.length - 1].prevLost; },
    canRedo() { return future.length > 0; },
    undo() {
      const op = doc.ops[doc.ops.length - 1];
      if (!op) return null;
      if (STRUCT_KINDS[op.kind]) { // structural ops undo cleanly but are not redoable
        FTStore._self = true;
        const ok = revertStructOp(op);
        FTStore._self = false;
        if (!ok) return null;
        doc.ops = doc.ops.slice(0, -1);
        future.length = 0;
        save(); notify();
        return op.label;
      }
      const S = window.ImageSlotStore;
      const cur = op.id ? { nextRaw: S && S.raw ? S.raw(op.id) : undefined } : op.ekey ? { nextE: doc.edits[op.ekey] } : { nextOv: doc.excluded[op.key] };
      FTStore._self = true;
      const ok = revertOp(op);
      FTStore._self = false;
      if (!ok) return null;
      doc.ops = doc.ops.slice(0, -1);
      future.push(Object.assign({ op }, cur));
      save(); notify();
      return op.label;
    },
    redo() {
      const f = future.pop();
      if (!f) return null;
      FTStore._self = true;
      if (f.op.id) restoreSlot(f.op.id, f.nextRaw);
      else if (f.op.ekey) { doc.edits[f.op.ekey] = f.nextE; applyLive(f.op.ekey, f.nextE); }
      else restoreOv(f.op.key, f.nextOv);
      FTStore._self = false;
      doc.ops = [...doc.ops, f.op];
      save(); notify();
      return f.op.label;
    },

    // Discard specific ops (by ts). Reverts their effect where possible:
    // for each touched slot/key, if its LAST op was dropped, the value rolls
    // back to just before the earliest dropped op in that trailing run.
    discardOps(tsList) {
      const drop = new Set(tsList);
      const byTarget = {};
      doc.ops.forEach((o) => {
        const t = o.id ? 's:' + o.id : o.ekey ? 'e:' + o.ekey : o.key ? 'k:' + o.key : 'x:' + (o.pid || o.uid || (o.side ? o.side.from + '>' + o.side.to : o.ts));
        (byTarget[t] = byTarget[t] || []).push(o);
      });
      FTStore._self = true;
      Object.keys(byTarget).forEach((t) => {
        const list = byTarget[t];
        let lastKept = -1;
        for (let i = 0; i < list.length; i++) if (!drop.has(list[i].ts)) lastKept = i;
        if (lastKept === list.length - 1) return; // final state untouched
        const first = list[lastKept + 1]; // earliest dropped op after last kept
        revertOp(first);
      });
      FTStore._self = false;
      future.length = 0;
      doc.ops = doc.ops.filter((o) => !drop.has(o.ts));
      save(); notify();
    },

    // ---- user-authored moments (may be undated) ----
    momentsFor(id) { return (doc.moments[id] || []).map((m) => Object.assign({}, m)); },
    _ensureM(id) { if (!doc.moments[id]) doc.moments[id] = []; return doc.moments[id]; },
    _getM(id, mid) { return (doc.moments[id] || []).find((m) => m.id === mid); },
    _mLabel(personId, m, verb) {
      let who = ''; try { const R = window.REL; if (R) who = R.fullName(R.get(personId), 'en'); } catch (e) {}
      return [who, 'moment ' + verb, m && m.title].filter(Boolean).join(' \u00b7 ');
    },
    _recordM(kind, personId, mid, label) {
      doc.momentLog = [...(doc.momentLog || []), { ts: Date.now(), kind, mid, personId, label, pub: false }];
      save(); notify();
    },
    addMoment(personId, opts) {
      opts = opts || {};
      const arr = this._ensureM(personId);
      const ei = arr.reduce((mx, m) => Math.max(mx, m.ei || 0), 999) + 1;
      const id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      const m = { id, ei, title: opts.title || '', text: opts.text || '',
        year: (opts.year == null || opts.year === '' ? null : +opts.year),
        bucket: opts.bucket || 'start', seq: (opts.seq == null ? 0 : opts.seq), place: opts.place || null };
      arr.push(m);
      this._recordM('moment-add', personId, id, this._mLabel(personId, m, 'added'));
      return id;
    },
    updateMoment(personId, id, patch) {
      const m = this._getM(personId, id); if (!m) return;
      if (patch.year !== undefined) patch.year = (patch.year == null || patch.year === '' ? null : +patch.year);
      Object.assign(m, patch);
      this._recordM('moment-edit', personId, id, this._mLabel(personId, m, 'edited'));
    },
    removeMoment(personId, id) {
      const arr = doc.moments[personId]; if (!arr) return;
      const m = arr.find((x) => x.id === id);
      doc.moments[personId] = arr.filter((x) => x.id !== id);
      this._recordM('moment-remove', personId, id, this._mLabel(personId, m, 'removed'));
    },
    // place `id` directly AFTER merged item `pred` (null = very top).
    _placeAfter(personId, id, pred) {
      const arr = doc.moments[personId]; if (!arr) return;
      const m = arr.find((x) => x.id === id); if (!m) return;
      if (!pred) {
        m.bucket = 'start';
        const sibs = arr.filter((x) => x !== m && x.year == null && x.bucket === 'start').map((x) => x.seq);
        m.seq = (sibs.length ? Math.min(...sibs) : 1) - 1;
      } else if (pred.year != null) {
        m.bucket = pred.key;
        const sibs = arr.filter((x) => x !== m && x.year == null && x.bucket === pred.key).map((x) => x.seq);
        m.seq = (sibs.length ? Math.min(...sibs) : 1) - 1;
      } else {
        m.bucket = pred.bucket;
        const after = arr.filter((x) => x !== m && x.year == null && x.bucket === pred.bucket && x.seq > pred.seq).map((x) => x.seq);
        const next = after.length ? Math.min(...after) : pred.seq + 2;
        m.seq = (pred.seq + next) / 2;
      }
    },
    moveMoment(personId, id, dir) {
      const R = window.REL; if (!R) return;
      const list = R.lifeEvents(personId, 'en');
      const i = list.findIndex((it) => it.mid === id); if (i < 0) return;
      let pred;
      if (dir > 0) { if (!list[i + 1]) return; pred = list[i + 1]; }
      else { if (i - 1 < 0) return; pred = i - 2 >= 0 ? list[i - 2] : null; }
      this._placeAfter(personId, id, pred);
      this._recordM('moment-order', personId, id, this._mLabel(personId, this._getM(personId, id), 'reordered'));
    },

    pendingOps() { return [...doc.ops.filter((o) => !o.pub), ...(doc.momentLog || []).filter((o) => !o.pub)]; },
    changeSet() {
      return {
        type: 'ft-change-set',
        baseV: doc.baseV || null,
        seedStamp: doc.seedStamp || null,
        ts: Date.now(),
        note: 'Photo data lives in .image-slots.state.json; exclusion + field-edit overrides + structural additions in .ft-doc.state.json. See CLAUDE.md → Baking a change-set.',
        edits: Object.assign({}, doc.edits),
        struct: JSON.parse(JSON.stringify(doc.struct)),
        ops: [...doc.ops, ...(doc.momentLog || [])].map((o) => ({ ts: o.ts, kind: o.kind, id: o.id, key: o.key, ekey: o.ekey, mid: o.mid, personId: o.personId, pid: o.pid, uid: o.uid, side: o.side, label: o.label, pub: !!o.pub })),
      };
    },
    markPublished() { doc.ops.forEach((o) => { o.pub = true; }); (doc.momentLog || []).forEach((o) => { o.pub = true; }); save(); notify(); },
  };

  window.FTStore = FTStore;
  // world-event on/off consults the shared edits first, then the old behaviour
  if (typeof window.wevEnabled === 'function') {
    const origWev = window.wevEnabled;
    window.wevEnabled = function (e) {
      const ov = doc.edits && doc.edits['w:' + e.id];
      return ov === undefined ? origWev(e) : !!ov;
    };
  }
  load();
})();
