/* edit-canvas.jsx — Edit-mode layer. UI (plus, popovers, cards) renders in SCREEN space
   on top of the canvas, so it is agnostic to zoom; positions are computed from the
   sim's live camera. All writes go through FTStore (undoable, publishable). */

const EC_REL = {
  parent:  { lbl: 'Parent',  sub: 'Mother or father',    ic: 'M12 4v16M6 10l6-6 6 6' },
  child:   { lbl: 'Child',   sub: 'Son or daughter',     ic: 'M12 20V4M6 14l6 6 6-6' },
  sibling: { lbl: 'Sibling', sub: 'Shares parents',      ic: 'M7 20v-8M17 20v-8M7 8l5-5 5 5M12 3v9' },
  partner: { lbl: 'Partner', sub: 'Married or together', ic: 'M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4' },
};
const EC_EDGE_REL = { top: 'parent', bottom: 'child', left: 'partner', right: 'partner' };
function ecEst(a, rel) {
  const y = a.birth.year;
  return rel === 'child' ? y + 28 : rel === 'parent' ? y - 28 : rel === 'sibling' ? y + 2 : y;
}
function ecIcon(d, sz) {
  return <svg width={sz || 15} height={sz || 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>;
}
function ecFirst(p) { return (window.REL.fullName(p, 'en') || '').split(' ')[0]; }

// link an EXISTING person to the anchor as rel (used by the duplicate-merge path)
function ecLinkExisting(anchorId, rel, otherId) {
  const R = window.REL, S = window.FTStore, a = R.get(anchorId), o = R.get(otherId);
  const who = R.fullName(o, 'en'), aw = R.fullName(a, 'en');
  if (rel === 'child') { const u = R.unionsOf(anchorId).find((x) => !x.endYear); S.setParents(otherId, u ? [u.a, u.b] : [anchorId], who + ' \u00b7 linked as child of ' + aw); }
  else if (rel === 'parent') S.setParents(anchorId, (a.parents || []).concat(otherId), aw + ' \u00b7 parent linked: ' + who);
  else if (rel === 'sibling') S.setParents(otherId, (a.parents || []).slice(), who + ' \u00b7 linked as sibling of ' + aw);
  else if (rel === 'partner') S.structAddUnion({ id: 'u_' + anchorId + '_' + otherId, a: anchorId, b: otherId, year: Math.max(a.birth.year, o.birth.year) + 25, type: 'marriage' }, who + ' \u2194 ' + aw + ' \u00b7 union added');
}
function ecCommitNew(anchorId, rel, f) {
  const R = window.REL, S = window.FTStore, a = R.get(anchorId);
  const en = (f.en || '').trim(); if (!en || !S) return false;
  let id = (en.split(/\s+/)[0] || 'p').toLowerCase().replace(/[^a-z0-9]/g, '') || 'p';
  while (R.get(id)) id = id + Math.floor(Math.random() * 90 + 10);
  const year = parseInt(f.year, 10) || ecEst(a, rel);
  const gen = rel === 'child' ? (a.gen ?? 0) + 1 : rel === 'parent' ? (a.gen ?? 0) - 1 : (a.gen ?? 0);
  const seed = { id, gen, sex: f.sex || 'f', name: { en, he: (f.he || '').trim() || en },
    birth: { year, place: (f.place || '').trim() }, death: null, parents: [], milestones: [], bio: { en: '', he: '' } };
  if (rel === 'child') { const u = R.unionsOf(anchorId).find((x) => !x.endYear); seed.parents = u ? [u.a, u.b] : [anchorId]; }
  if (rel === 'sibling') seed.parents = (a.parents || []).slice();
  S.structAddPerson(seed, en + ' \u00b7 added \u00b7 ' + rel + ' of ' + R.fullName(a, 'en'));
  if (rel === 'parent') S.setParents(anchorId, (a.parents || []).concat(id), R.fullName(a, 'en') + ' \u00b7 parent linked: ' + en);
  if (rel === 'partner') S.structAddUnion({ id: 'u_' + anchorId + '_' + id, a: anchorId, b: id, year: Math.max(year, a.birth.year) + 25, type: 'marriage' }, en + ' \u2194 ' + R.fullName(a, 'en') + ' \u00b7 union added');
  return id;
}
// draft-node flow: the person appears on the tree IMMEDIATELY (glides in below/beside the
// anchor), the card rides next to the draft; cancel unwinds everything via undo
function ecCreateDraft(anchorId, rel) {
  const R = window.REL, S = window.FTStore, a = R.get(anchorId);
  const t0 = Date.now();
  let base = rel + '_of_' + anchorId, id = base, i = 1;
  while (R.get(id)) id = base + '_' + (++i);
  const year = ecEst(a, rel);
  const gen = rel === 'child' ? (a.gen ?? 0) + 1 : rel === 'parent' ? (a.gen ?? 0) - 1 : (a.gen ?? 0);
  const seed = { id, gen, sex: rel === 'partner' ? (a.sex === 'm' ? 'f' : 'm') : 'f',
    name: { en: 'New ' + rel, he: '' }, birth: { year, place: '' }, death: null, parents: [], milestones: [], bio: { en: '', he: '' } };
  if (rel === 'child') { const u = R.unionsOf(anchorId).find((x) => !x.endYear); seed.parents = u ? [u.a, u.b] : [anchorId]; }
  if (rel === 'sibling') seed.parents = (a.parents || []).slice();
  S.structAddPerson(seed, 'New ' + rel + ' of ' + R.fullName(a, 'en'));
  if (rel === 'parent') S.setParents(anchorId, (a.parents || []).concat(id), R.fullName(a, 'en') + ' \u00b7 parent linked');
  if (rel === 'partner') S.structAddUnion({ id: 'u_' + anchorId + '_' + id, a: anchorId, b: id, year: a.birth.year + 25, type: 'marriage' }, 'Union added');
  return { draftId: id, t0 };
}
function ecCancelDraft(t0) {
  const S = window.FTStore; let g = 0;
  while (g++ < 6) {
    const ops = S.doc.ops, last = ops[ops.length - 1];
    if (!last || last.ts < t0) break;
    if (S.undo() == null) break;
  }
}

function EcRelPop({ anchorId, edge, onPick, pos }) {
  const R = window.REL, a = R.get(anchorId);
  const suggested = EC_EDGE_REL[edge] || 'child';
  const can = (rel) => {
    if (rel === 'sibling') return (a.parents || []).length > 0;
    if (rel === 'parent') return (a.parents || []).length < 2;
    if (rel === 'partner') return !R.unionsOf(anchorId).some((u) => !u.endYear);
    return true;
  };
  const order = [suggested, ...Object.keys(EC_REL).filter((r) => r !== suggested)];
  return (
    <div className="ec-pop ec-ui" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ec-head">Grow from {ecFirst(a)}</div>
      {order.filter(can).map((rel, i) => (
        <button key={rel} className={'ec-opt' + (i === 0 ? ' hero' : '')} onClick={() => onPick(rel)}>
          <span className="ec-ic">{ecIcon(EC_REL[rel].ic)}</span>
          <span className="ec-txt"><b>{EC_REL[rel].lbl}</b><i>{EC_REL[rel].sub}</i></span>
          {i === 0 && <span className="ec-tag">this edge</span>}
        </button>
      ))}
    </div>
  );
}

function EcNewCard({ anchorId, rel, draftId, pos, onDone, onCancel }) {
  const R = window.REL, S = window.FTStore, a = R.get(anchorId);
  const [f, setF] = React.useState({ en: '', he: '', sex: (R.get(draftId) || {}).sex || 'f', year: '', place: '' });
  const [dup, setDup] = React.useState(null); // matched existing person → offer to link instead
  const est = ecEst(a, rel);
  // live-apply onto the draft node: the card writes straight into the working copy
  const apply = (patch) => {
    const p = R.get(draftId); if (!p) return;
    if (patch.en !== undefined) { p.name.en = patch.en.trim() || ('New ' + rel); if (!f.he.trim()) p.name.he = p.name.en; }
    if (patch.he !== undefined) p.name.he = patch.he.trim() || p.name.en;
    if (patch.sex) p.sex = patch.sex;
    if (patch.year !== undefined) { const v = parseInt(patch.year, 10); p.birth.year = (v && String(v).length === 4) ? v : est; }
    if (patch.place !== undefined) p.birth.place = patch.place.trim();
    S.structTouch();
  };
  const set = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); apply({ [k]: v }); };
  const ok = f.en.trim().length > 0;
  const commit = () => {
    if (!ok) return;
    const m = R.F.people.find((pp) => pp.id !== anchorId && pp.id !== draftId && (R.fullName(pp, 'en') || '').toLowerCase() === f.en.trim().toLowerCase());
    if (m && !dup) { setDup(m); return; }
    apply(f);
    S.structTouch(draftId, f.en.trim() + ' \u00b7 added \u00b7 ' + rel + ' of ' + R.fullName(a, 'en'));
    onDone();
  };
  return (
    <div className="ec-card ec-ui" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ec-card-head">
        <span className="ec-badge">New {EC_REL[rel].lbl.toLowerCase()}</span>
        <span className="ec-of">of {R.fullName(a, 'en')}</span>
        <button className="ec-x" onClick={onCancel} title="Cancel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
        </button>
      </div>
      <input className="ec-in" placeholder="Full name" value={f.en} onChange={set('en')} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      <input className="ec-in dashed he" dir="rtl" placeholder="שם בעברית — optional" value={f.he} onChange={set('he')} />
      <div className="ec-row">
        <div className="ec-seg"><button className={f.sex === 'm' ? 'on' : ''} onClick={() => { setF((v) => ({ ...v, sex: 'm' })); apply({ sex: 'm' }); }}>Male</button><button className={f.sex === 'f' ? 'on' : ''} onClick={() => { setF((v) => ({ ...v, sex: 'f' })); apply({ sex: 'f' }); }}>Female</button></div>
        <input className="ec-in yr" inputMode="numeric" maxLength="4" placeholder={'~' + est} value={f.year}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setF((s) => ({ ...s, year: v })); apply({ year: v }); }} title="Birth year — the ~estimate is used until you know it" />
      </div>
      <input className="ec-in dashed" placeholder="Birthplace — optional" value={f.place} onChange={set('place')} />
      {!dup && <div className="ec-note">No year yet? An estimate (~{est}) keeps them sorted until you know.</div>}
      {dup && (
        <div className="ec-dup">
          <b>{R.fullName(dup, 'en')}</b> already exists (b. {dup.birth.year}). Same person?
          <div className="ec-dup-row">
            <button className="ec-dup-link" onClick={() => { onCancel(); ecLinkExisting(anchorId, rel, dup.id); }}>Link the existing one</button>
            <button className="ec-dup-new" onClick={() => { apply(f); S.structTouch(draftId, f.en.trim() + ' \u00b7 added \u00b7 ' + rel + ' of ' + R.fullName(a, 'en')); onDone(); }}>Create another</button>
          </div>
        </div>
      )}
      {!dup && (
        <button className={'ec-add' + (ok ? '' : ' off')} onClick={commit}>
          <svg width="13" height="13" viewBox="0 0 14 14"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
          Add {EC_REL[rel].lbl.toLowerCase()}
        </button>
      )}
    </div>
  );
}

// one connection pill; clicking expands its actions inline
function EcPill({ ic, txt, open, onToggle, children }) {
  return (
    <div className={'ec-pill-wrap' + (open ? ' open' : '')}>
      <button className="ec-pill" onClick={onToggle}>
        {ecIcon(ic, 12)}<span dangerouslySetInnerHTML={{ __html: txt }}></span>
        <svg className="ec-pc" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
      </button>
      {open && <div className="ec-pill-menu">{children}</div>}
    </div>
  );
}

function EcEditCard({ personId, pos, onClose, onAddRel, onOpenFocus }) {
  const R = window.REL, S = window.FTStore, p = R.get(personId);
  const [rm, setRm] = React.useState(false);
  const [openPill, setOpenPill] = React.useState(null);
  const [uYear, setUYear] = React.useState(null); // union id being year-edited
  const [, force] = React.useState(0);
  if (!p) return null;
  const who = R.fullName(p, 'en');
  const bump = () => force((n) => n + 1);
  const txt = (ekey, label) => (e) => { const v = e.target.value.trim(); S.editField(ekey, v || null, who + ' \u00b7 ' + label); };
  const yr = (ekey, label) => (e) => { const v = parseInt(e.target.value, 10); if (v && String(v).length === 4) S.editField(ekey, v, who + ' \u00b7 ' + label); };
  const kids = R.childrenOf(personId);
  const unions = R.unionsOf(personId);
  const sides = R.sideLinksOf(personId);
  const nMoments = (p.milestones || []).length + (S.momentsFor ? S.momentsFor(personId).length : 0);
  const canAdd = (rel) => {
    if (rel === 'sibling') return (p.parents || []).length > 0;
    if (rel === 'parent') return (p.parents || []).length < 2;
    if (rel === 'partner') return !unions.some((u) => !u.endYear);
    return true;
  };
  const mi = (lbl, fn, danger) => (
    <button key={lbl} className={'ec-mi' + (danger ? ' danger' : '')} onClick={() => { fn(); setOpenPill(null); setUYear(null); bump(); }}>{lbl}</button>
  );
  return (
    <div className="ec-card ec-ui wide" style={{ left: pos.x, top: pos.y }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="ec-card-head">
        <span className="ec-badge">Edit</span>
        <span className="ec-of">{who}</span>
        <button className="ec-x" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
        </button>
      </div>
      <div className="ec-scroll">
        <div className="ec-lbl">Name</div>
        <input className="ec-in" defaultValue={p.name.en} onBlur={txt('p:' + personId + ':name.en', 'name')} placeholder="Full name" />
        <input className="ec-in he" dir="rtl" defaultValue={p.name.he} onBlur={txt('p:' + personId + ':name.he', 'Hebrew name')} placeholder="שם בעברית" />
        <div className="ec-lbl">Years</div>
        <div className="ec-row">
          <label className="ec-mini">Born<input className="ec-in yr" inputMode="numeric" maxLength="4" defaultValue={p.birth.year} onBlur={yr('p:' + personId + ':birth.year', 'birth year')} /></label>
          <label className="ec-mini">Died<input className="ec-in yr dashed" inputMode="numeric" maxLength="4" defaultValue={p.death ? p.death.year : ''} placeholder="Living"
            onBlur={(e) => { const v = parseInt(e.target.value, 10); S.editField('p:' + personId + ':death.year', (v && String(v).length === 4) ? v : null, who + ' \u00b7 death year'); bump(); }} /></label>
        </div>
        <div className="ec-lbl">Places</div>
        <input className="ec-in dashed" defaultValue={p.birth.place || ''} onBlur={txt('p:' + personId + ':birth.place', 'birthplace')} placeholder="Birthplace" />
        {p.death && <input className="ec-in dashed" defaultValue={p.death.place || ''} onBlur={txt('p:' + personId + ':death.place', 'death place')} placeholder="Place of death" />}
        <div className="ec-lbl">About</div>
        <textarea className="ec-in ec-ta" rows="1" defaultValue={(p.bio && p.bio.en) || ''}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; } }}
          onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = (e.target.scrollHeight + 2) + 'px'; }}
          onBlur={txt('p:' + personId + ':bio.en', 'bio')}
          placeholder="A line or two about them — optional"></textarea>
        <div className="ec-lbl">Connections</div>
        <div className="ec-pills">
          {(p.parents || []).length > 0 && (
            <EcPill ic={EC_REL.parent.ic} txt={'Child of <b>' + p.parents.map((id) => ecFirst(R.get(id))).join(' & ') + '</b>'}
              open={openPill === 'parents'} onToggle={() => setOpenPill(openPill === 'parents' ? null : 'parents')}>
              {p.parents.map((id) => mi('Unlink ' + ecFirst(R.get(id)), () => S.setParents(personId, p.parents.filter((x) => x !== id), who + ' \u00b7 parent unlinked'), true))}
            </EcPill>
          )}
          {unions.map((u) => {
            const o = R.get(R.partnerInUnion(u, personId)); if (!o) return null;
            const ended = !!u.endYear;
            const txt2 = (ended ? 'Formerly <b>' : 'Partner of <b>') + ecFirst(o) + '</b>' + (u.year ? ' \u00b7 ' + u.year + (ended ? '\u2013' + (u.endReason === 'death' ? '\u271D' : u.endYear) : '') : '');
            return (
              <EcPill key={u.id} ic={EC_REL.partner.ic} txt={txt2}
                open={openPill === u.id} onToggle={() => setOpenPill(openPill === u.id ? null : u.id)}>
                {uYear === u.id
                  ? <input className="ec-in yr" autoFocus inputMode="numeric" maxLength="4" defaultValue={u.year || ''} placeholder="Year"
                      onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseInt(e.target.value, 10); if (v) S.editField('u:' + u.id + ':year', v, who + ' \u2194 ' + ecFirst(o) + ' \u00b7 marriage year'); setUYear(null); setOpenPill(null); bump(); } }} />
                  : <button className="ec-mi" onClick={() => setUYear(u.id)}>Set the year{'\u2026'}</button>}
                {!ended && mi('Mark as ended (divorce)', () => S.editField('u:' + u.id + ':endYear', (u.year || R.NOW) + 1, who + ' \u2194 ' + ecFirst(o) + ' \u00b7 marriage ended'))}
                {mi('Remove this link', () => S.structRemoveUnion(u.id, who + ' \u2194 ' + ecFirst(o) + ' \u00b7 union removed'), true)}
              </EcPill>
            );
          })}
          {kids.map((cid) => (
            <EcPill key={cid} ic={EC_REL.child.ic} txt={'Parent of <b>' + ecFirst(R.get(cid)) + '</b>'}
              open={openPill === 'k' + cid} onToggle={() => setOpenPill(openPill === 'k' + cid ? null : 'k' + cid)}>
              {mi('Unlink ' + ecFirst(R.get(cid)), () => { const c = R.get(cid); S.setParents(cid, (c.parents || []).filter((x) => x !== personId), ecFirst(c) + ' \u00b7 parent unlinked'); }, true)}
            </EcPill>
          ))}
          {sides.map((l, i) => (
            <EcPill key={'s' + i} ic="M8 12a4 4 0 100-8 4 4 0 000 8zM16 20a4 4 0 100-8 4 4 0 000 8zM10.5 10.5l3 3" txt={'<b>' + l.kind + '</b> \u00b7 ' + ecFirst(R.get(l.other))}
              open={openPill === 's' + i} onToggle={() => setOpenPill(openPill === 's' + i ? null : 's' + i)}>
              {mi('Remove this link', () => S.structRemoveSide(l.raw, '\u201C' + l.kind + '\u201D link removed'), true)}
            </EcPill>
          ))}
        </div>
        <div className="ec-relrow">
          {Object.keys(EC_REL).filter(canAdd).map((r) => (
            <button key={r} className="ec-relbtn" title={'Add ' + EC_REL[r].lbl.toLowerCase()} onClick={() => onAddRel(r)}>
              {ecIcon(EC_REL[r].ic, 13)}<span>{EC_REL[r].lbl}</span>
            </button>
          ))}
        </div>
        <button className="ec-stories" onClick={() => { onClose(); onOpenFocus && onOpenFocus(personId); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14z"></path><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-4.5"></path></svg>
          <span>{nMoments ? <b>{nMoments} moments</b> : 'No moments yet'} on their timeline</span>
          <em>Open their story {'\u2192'}</em>
        </button>
        {!rm
          ? <button className="ec-remove" onClick={() => setRm(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>
              Remove from tree</button>
          : <button className="ec-remove confirm" onClick={() => { S.structRemovePerson(personId); onClose(); }}>
              Really remove {ecFirst(p)}{kids.length ? ' (' + kids.length + ' children stay)' : ''}?</button>}
      </div>
    </div>
  );
}

function EditLayer({ simRef, nodeEls, nodeH, wrapRef, onOpenFocus }) {
  const R = window.REL;
  const [hover, setHover] = React.useState(null); // {id, edge}
  const [ui, setUi] = React.useState(null);       // {type, id, edge?, rel?, draftId?, t0?, pos}
  const [, force] = React.useState(0);
  const armedRef = React.useRef(null);
  const uiRef = React.useRef(null); uiRef.current = ui;
  const idOf = (el) => { const m = nodeEls.current; for (const k in m) if (m[k] === el) return k; return null; };
  // node rect in SCREEN coordinates (zoom-agnostic UI)
  const rectOf = (id) => {
    const s = simRef.current; const n = s.nodes[id]; const el = nodeEls.current[id];
    if (!n || !el) return null;
    const v = s.view;
    return { x: n.x * v.scale + v.tx, y: n.y * v.scale + v.ty, w: (el.offsetWidth || 180) * v.scale, h: nodeH * v.scale };
  };
  // keep whatever is open FULLY on screen: estimate per type, then measure & refine
  const sizeRef = React.useRef({ w: 286, h: 420 });
  React.useEffect(() => {
    if (!ui) return;
    sizeRef.current = ui.type === 'rel' ? { w: 232, h: 300 } : ui.type === 'new' ? { w: 286, h: 430 } : { w: 286, h: 620 };
  }, [ui && ui.type]);
  React.useEffect(() => {
    if (!ui) return;
    const wrap = wrapRef.current;
    const measure = () => {
      const el = wrap && wrap.querySelector('.ec-ui');
      if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      if (Math.abs(w - sizeRef.current.w) > 4 || Math.abs(h - sizeRef.current.h) > 4) { sizeRef.current = { w, h }; force((n) => n + 1); }
    };
    measure();
    const iv = setInterval(measure, 250);
    return () => clearInterval(iv);
  }, [ui]);
  const clampPos = (p) => {
    const wrap = wrapRef.current; if (!wrap || !p) return p || { x: 20, y: 20 };
    const { w, h } = sizeRef.current;
    return { x: Math.max(10, Math.min(p.x, wrap.clientWidth - w - 10)),
             y: Math.max(10, Math.min(p.y, wrap.clientHeight - h - 10)) };
  };
  const posFor = (id, edge) => {
    const r = rectOf(id); const wrap = wrapRef.current;
    if (!r || !wrap) return { x: 20, y: 20 };
    const x = edge === 'left' ? r.x - r.w / 2 - sizeRef.current.w - 14 : r.x + r.w / 2 + 14;
    const y = r.y - r.h / 2;
    return { x, y };
  };
  const ecCan = (id, rel) => {
    const a = R.get(id);
    if (rel === 'sibling') return (a.parents || []).length > 0;
    if (rel === 'parent') return (a.parents || []).length < 2;
    if (rel === 'partner') return !R.unionsOf(id).some((u) => !u.endYear);
    return true;
  };
  const startDraft = (anchorId, rel) => {
    const d = ecCreateDraft(anchorId, rel);
    setUi({ type: 'new', id: anchorId, rel, draftId: d.draftId, t0: d.t0, pos: posFor(anchorId) });
    // if the draft lands outside the comfortable viewport, nudge the camera to it
    setTimeout(() => {
      const s = simRef.current, wrap = wrapRef.current, n = s && s.nodes[d.draftId];
      if (!s || !n || !wrap) return;
      const v = s.viewT;
      const sx = n.tx * v.scale + v.tx, sy = n.ty * v.scale + v.ty;
      const W = wrap.clientWidth, H = wrap.clientHeight, M = 140, CARD = 320;
      let dx = 0, dy = 0;
      if (sx < M) dx = M - sx; else if (sx > W - M - CARD) dx = (W - M - CARD) - sx;
      if (sy < M) dy = M - sy; else if (sy > H - M) dy = (H - M) - sy;
      if (dx || dy) { s.viewT = { scale: v.scale, tx: v.tx + dx, ty: v.ty + dy }; }
    }, 420);
  };
  const dismiss = () => {
    const u = uiRef.current;
    if (u && u.type === 'new' && u.t0) ecCancelDraft(u.t0); // unwind the draft node
    setUi(null);
  };
  // the card rides beside the DRAFT node while it glides into place
  React.useEffect(() => {
    if (!ui || !ui.draftId) return;
    const iv = setInterval(() => force((n) => n + 1), 150);
    return () => clearInterval(iv);
  }, [ui && ui.draftId]);
  React.useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const mv = (e) => {
      if (uiRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.closest && el.closest('.ec-plus, .ec-ui')) return; // don't drop the plus while reaching for it
      const np = el && el.closest ? el.closest('.node-pos') : null;
      const id = np ? idOf(np) : null;
      if (!id) { setHover((h) => (h ? null : h)); return; }
      const r = np.getBoundingClientRect();
      const dT = e.clientY - r.top, dB = r.bottom - e.clientY, dL = e.clientX - r.left, dR = r.right - e.clientX;
      const m = Math.min(dT, dB, dL, dR);
      const edge = m === dT ? 'top' : m === dB ? 'bottom' : m === dL ? 'left' : 'right';
      setHover((h) => (h && h.id === id && h.edge === edge ? h : { id, edge }));
    };
    wrap.addEventListener('pointermove', mv);
    return () => wrap.removeEventListener('pointermove', mv);
  }, []);
  React.useEffect(() => {
    const onAdd = (e) => { armedRef.current = e.detail.rel; setUi(null); window.dispatchEvent(new CustomEvent('ft-edit-armed', { detail: e.detail.rel })); };
    const onOpen = (e) => {
      const id = e.detail;
      const armed = armedRef.current; armedRef.current = null;
      window.dispatchEvent(new CustomEvent('ft-edit-armed', { detail: null }));
      if (armed && armed !== 'person' && ecCan(id, armed)) startDraft(id, armed);
      else if (armed) setUi({ type: 'rel', id, edge: 'bottom', pos: posFor(id) });
      else setUi({ type: 'card', id, pos: posFor(id) });
    };
    const onFind = (e) => {
      const raw = (e.detail || '').trim(), q = raw.toLowerCase(), m = nodeEls.current;
      for (const id in m) {
        const el = m[id]; if (!el) continue;
        const p = R.get(id);
        const hit = q && p && ((R.fullName(p, 'en') || '').toLowerCase().includes(q) || (R.fullName(p, 'he') || '').includes(raw));
        el.classList.toggle('find-hit', !!hit);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') { dismiss(); armedRef.current = null; window.dispatchEvent(new CustomEvent('ft-edit-armed', { detail: null })); } };
    const onDown = (e) => { if (!e.target.closest || !e.target.closest('.ec-ui')) dismiss(); };
    const wrap = wrapRef.current;
    window.addEventListener('ft-edit-add', onAdd);
    window.addEventListener('ft-edit-open', onOpen);
    window.addEventListener('ft-edit-find', onFind);
    window.addEventListener('keydown', onKey);
    wrap && wrap.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('ft-edit-add', onAdd);
      window.removeEventListener('ft-edit-open', onOpen);
      window.removeEventListener('ft-edit-find', onFind);
      window.removeEventListener('keydown', onKey);
      wrap && wrap.removeEventListener('pointerdown', onDown, true);
      const m = nodeEls.current; for (const id in m) m[id] && m[id].classList.remove('find-hit');
    };
  }, []);
  const plus = hover && !ui ? (() => {
    const r = rectOf(hover.id); if (!r) return null;
    const at = hover.edge === 'top' ? { l: r.x, t: r.y - r.h / 2 } : hover.edge === 'bottom' ? { l: r.x, t: r.y + r.h / 2 }
      : hover.edge === 'left' ? { l: r.x - r.w / 2, t: r.y } : { l: r.x + r.w / 2, t: r.y };
    return (
      <button className="ec-plus" style={{ left: at.l, top: at.t }}
        title={'Add a ' + (EC_EDGE_REL[hover.edge] || 'relative')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setUi({ type: 'rel', id: hover.id, edge: hover.edge, pos: posFor(hover.id, hover.edge) }); }}>
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5v11M1.5 7h11" stroke="#fff" strokeWidth="2" strokeLinecap="round"></path></svg>
      </button>
    );
  })() : null;
  return (
    <div className="ec-layer">
      {plus}
      {ui && ui.type === 'rel' && <EcRelPop anchorId={ui.id} edge={ui.edge} pos={clampPos(ui.pos)}
        onPick={(rel) => startDraft(ui.id, rel)} />}
      {ui && ui.type === 'new' && <EcNewCard anchorId={ui.id} rel={ui.rel} draftId={ui.draftId}
        pos={clampPos(R.get(ui.draftId) ? posFor(ui.draftId) : ui.pos)}
        onDone={() => setUi(null)} onCancel={dismiss} />}
      {ui && ui.type === 'card' && <EcEditCard personId={ui.id} pos={clampPos(ui.pos)} onOpenFocus={onOpenFocus}
        onClose={() => setUi(null)} onAddRel={(rel) => startDraft(ui.id, rel)} />}
    </div>
  );
}

Object.assign(window, { EditLayer });
