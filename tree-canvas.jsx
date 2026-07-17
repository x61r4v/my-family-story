/* tree-canvas.jsx — elastic, physics-driven family tree canvas
   A single requestAnimationFrame loop runs a spring simulation:
   - every node springs toward its computed generational target (structure preserved)
   - edges (marriage / parent-child) are springs at rest at the layout distance, so
     dragging a node tugs its neighbours and it all settles elastically
   - scale springs (under-damped) make nodes pop in / collapse out when born / un-scrubbed
   - the camera itself springs toward the fit framing
   All motion is written straight to the DOM (no per-frame React state). */
const { useState, useRef, useEffect, useMemo } = React;

// ---- shared name helper (RTL-aware) ----
function nameOf(person, lang) {return window.REL ? window.REL.fullName(person, lang) : (lang === 'he' ? person.name.he : person.name.en);}
function NameText({ person, lang, className, style }) {
  const isHe = lang === 'he';
  return (
    <span className={(className || '') + (isHe ? ' he' : '')} dir={isHe ? 'rtl' : 'ltr'} style={style}>
      {nameOf(person, lang)}
    </span>);

}
function initials(person) {
  const parts = person.name.en.split(' ');
  return ((parts[0] || '')[0] || '') + ((parts[parts.length - 1] || '')[0] || '');
}

// ---- monogram medallion ----
function Medallion({ person, size, deceased }) {
  const tint = person.sex === 'f' ? 'var(--sex-f)' : 'var(--sex-m)';
  return (
    <div className="medallion" style={{
      width: size, height: size, borderRadius: '50%', flex: '0 0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `color-mix(in srgb, ${tint} 14%, var(--surface))`,
      border: `1.5px solid ${tint}`, color: tint,
      fontFamily: 'var(--font-serif)', fontWeight: 500,
      fontSize: size * 0.4, letterSpacing: '.2px', position: 'relative'
    }}>
      {initials(person)}
      {deceased && <span style={{ position: 'absolute', bottom: -1, right: -1, fontSize: size * 0.26, color: 'var(--amber-d)' }}>{'\u2726'}</span>}
    </div>);

}

// ---- a single tree node, 4 styles ----
// Per-user preferences for which photos may represent someone on the tree.
// Routed through FTStore (shared sidecar doc + ops log) so hide/show is a
// committable change like any other. Keyed by `${personId}-e${eventIndex}`.
window.FTtree = window.FTtree || (function () {
  return {
    isExcluded(k) { return window.FTStore ? window.FTStore.isExcluded(k) : false; },
    setExcluded(k, ex) {
      if (window.FTStore) window.FTStore.setExcluded(k, ex);
      window.dispatchEvent(new Event('ft-tree-changed'));
    },
  };
})();

// Auto-pick the era-appropriate avatar photo for a person at a given year, from
// the photos already pinned to their life events (ph-<id>-e<idx>). Returns the
// chosen event index + its image url. The avatar changes as the tree is scrubbed:
// it holds the most recent photographed moment, falling back to the earliest
// photo before that (so a young child still shows their baby photo).
function autoAvatar(id, year) {
  const R = window.REL, store = window.ImageSlotStore;
  if (!R || !store) return { idx: -1, u: null };
  const ev = R.lifeEvents(id, 'en');
  let best = -1, firstWithPhoto = -1;
  for (let i = 0; i < ev.length; i++) {
    const ei = ev[i].ei; if (ei == null) continue;
    if (!store.has(`ph-${id}-e${ei}`)) continue;
    if (window.FTtree && window.FTtree.isExcluded(`${id}-e${ei}`)) continue; // hidden from tree
    if (firstWithPhoto === -1) firstWithPhoto = ei;
    if ((ev[i].effYear != null ? ev[i].effYear : ev[i].year) <= year) best = ei;
  }
  const idx = best !== -1 ? best : firstWithPhoto;
  return { idx, u: idx !== -1 ? (store.get(`ph-${id}-e${idx}`) || {}).u : null };
}
window.autoAvatar = autoAvatar;

// Default avatar framing for photos without a hand-set crop yet: zoom is the
// AVERAGE of every avatar crop in the album (baked seed + local edits), so a
// newly added photo starts at the family's typical head-framing zoom, pinned
// to the top of the image where faces usually are (y clamps to the top edge).
window.ImageSlotDefaultView = function (id) {
  if (!/^av-/.test(id || '')) return null;
  const store = window.ImageSlotStore;
  const seen = {};
  const seed = (window.FT_SEED && window.FT_SEED.slots) || {};
  for (const k in seed) {
    if (k.indexOf('av-') === 0 && k !== id) seen[k] = seed[k];
  }
  if (store && store.raw) {
    // local (unbaked) crops override / add to the seeded ones
    for (const k in seen) { const r = store.raw(k); if (r && Number.isFinite(r.s)) seen[k] = r; }
  }
  let sum = 0, n = 0;
  for (const k in seen) {
    const s = seen[k] && seen[k].s;
    if (Number.isFinite(s) && s > 1) { sum += s; n++; }
  }
  if (!n) return null;
  return { s: sum / n, x: 0, y: 9999 };
};

// Fullscreen avatar-crop overlay: dimmed scrim, large crop circle centred,
// ghost of the full photo spilling around it. Shared by PhotoMenuSlot and
// PhotoIconTools. Commits on Done / outside click / Escape.
window.AvatarCropOverlay = function AvatarCropOverlay({ personId, idx, onClose }) {
  const store = window.ImageSlotStore;
  const storyId = `ph-${personId}-e${idx}`;
  const avId = `av-${personId}-e${idx}`;
  const photoUrl = ((store && store.get(storyId)) || {}).u || '';
  const avRef = React.useRef(null);
  const [zoom, setZoom] = React.useState(1);
  React.useEffect(() => {
    const t = setTimeout(() => {
      const el = avRef.current;
      if (el && el._enterReframe) { try { el._enterReframe(); } catch (_) {} }
      if (el && el._view) setZoom(el._view.s);
    }, 90);
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(t); document.removeEventListener('keydown', esc); };
  }, []);
  const done = () => { const el = avRef.current; if (el && el._exitReframe) { try { el._exitReframe(true); } catch (_) {} } onClose(); };
  // zoom about the frame centre (same math as the slot's wheel-zoom with cx=cy=0).
  // Pressing the slider counts as an "outside" press for the slot and exits its
  // reframe mode (committing once) — re-enter so the crop session stays live and
  // the final state is committed by Done.
  const ensureReframe = (el) => { if (!el.hasAttribute('data-reframe') && el._enterReframe) { try { el._enterReframe(); } catch (_) {} } };
  const applyZoom = (next) => {
    const el = avRef.current; if (!el || !el._view) return;
    ensureReframe(el);
    next = Math.max(1, Math.min(5, next));
    const k = next / el._view.s;
    el._view.s = next; el._view.x *= k; el._view.y *= k;
    el._clampView(); el._applyView();
    setZoom(next);
  };
  // keep the slider in sync after hand-drags / wheel zooms inside the slot
  const syncZoom = () => { const el = avRef.current; if (el && el._view) setZoom(el._view.s); };
  // Close on backdrop CLICKS only if the press also STARTED on the backdrop —
  // a drag that starts on the photo and releases over the backdrop fires a
  // click on the overlay (common ancestor) and used to close it mid-crop.
  const downOnBackdrop = React.useRef(false);
  return ReactDOM.createPortal(
    <div className="crop-overlay"
      onPointerDownCapture={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onPointerUp={syncZoom} onWheel={() => setTimeout(syncZoom, 0)}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) done(); }}>
      <image-slot ref={avRef} key={avId} id={avId} src={photoUrl} shape="circle" fit="cover"
        style={{ width: '240px', height: '240px', flex: '0 0 auto' }}></image-slot>
      <div className="crop-card" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="crop-card-col">
          <div className="pm-crop-hint">Drag to reposition, drag a corner to zoom. Sets how this person appears on the tree.</div>
          <div className="crop-zoom">
            <button className="cz-btn" aria-label="Zoom out" onClick={() => applyZoom(zoom - 0.25)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14"/></svg>
            </button>
            <input type="range" min="1" max="5" step="0.01" value={zoom}
              aria-label="Zoom" onChange={(e) => applyZoom(+e.target.value)} />
            <button className="cz-btn" aria-label="Zoom in" onClick={() => applyZoom(zoom + 0.25)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
        <button className="pm-done" onClick={done}>Done</button>
      </div>
    </div>,
    document.body
  );
};

// Reusable photo surface with a single bottom-left options menu (replaces the
// image-slot's built-in Replace/Remove chrome). Menu: replace/add · change the
// tree-avatar crop · show/hide on the tree · remove. `mode='avatar'` shows the
// framed avatar (drawer/quick card); `mode='story'` shows the full photo (life
// story). Replace/remove always act on the underlying moment photo (ph-…).
window.PhotoMenuSlot = function PhotoMenuSlot({ personId, idx, mode = 'story', shape = 'rounded', radius = '12', style, placeholder, onImageClick }) {
  const store = window.ImageSlotStore;
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { if (store) return store.subscribe(() => force()); }, []);
  const storyId = `ph-${personId}-e${idx}`;
  const avId = `av-${personId}-e${idx}`;
  const key = `${personId}-e${idx}`;
  const hasPhoto = !!(store && store.has(storyId));
  const photoUrl = ((store && store.get(storyId)) || {}).u || '';
  const displayId = mode === 'avatar' ? avId : storyId;
  const [open, setOpen] = React.useState(false);
  const [crop, setCrop] = React.useState(false);
  const [inTree, setInTree] = React.useState(() => !(window.FTtree && window.FTtree.isExcluded(key)));
  const wrapRef = React.useRef(null);
  const storyRef = React.useRef(null);
  const avRef = React.useRef(null);

  const hideCtl = (el) => {
    if (el && el.shadowRoot && !el.shadowRoot.querySelector('style[data-hidectl]')) {
      const s = document.createElement('style'); s.setAttribute('data-hidectl', '');
      s.textContent = '.ctl{display:none!important}';
      el.shadowRoot.appendChild(s);
    }
  };
  const setDisp = (el) => { hideCtl(el); if (mode !== 'avatar') storyRef.current = el; };
  const setStory = (el) => { storyRef.current = el; };
  const setAv = (el) => { avRef.current = el; hideCtl(el); };

  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [open]);

  const shadowClick = (ref, act) => {
    const el = ref.current; if (!el) return;
    const b = el.shadowRoot && el.shadowRoot.querySelector('[data-act=' + act + ']');
    if (b) { b.click(); return; }
    if (act === 'replace' && el._input) el._input.click();
  };
  const doReplace = () => { setOpen(false); shadowClick(storyRef, 'replace'); };
  const doRemove = () => { setOpen(false); setCrop(false); shadowClick(storyRef, 'clear'); };
  const doCrop = () => { setOpen(false); setCrop((c) => !c); };
  const doTree = () => { const next = !inTree; setInTree(next); window.FTtree && window.FTtree.setExcluded(key, !next); setOpen(false); };

  return (
    <div className="pm-wrap" ref={wrapRef} onClick={(e) => { e.stopPropagation(); if (onImageClick) onImageClick(); }}>
      {mode === 'avatar'
        // Avatar surface: crops are square-authored (see crop overlay), so render
        // the slot as a centred square of the frame's longer side; .av-frame clips.
        ? <div className="av-frame ms-portrait" style={{ ...(style || {}), borderRadius: (parseFloat(radius) || 13) + 'px' }}>
            <image-slot ref={setDisp} key="disp" id={displayId} shape="rect" fit="cover" no-reframe=""
              placeholder={placeholder} src={photoUrl || 'assets/default-avatar.jpg'}></image-slot>
          </div>
        : <image-slot ref={setDisp} key="disp" id={displayId} shape={shape} radius={radius} fit="cover"
            style={style} placeholder={placeholder}></image-slot>}
      {mode === 'avatar' && <image-slot ref={setStory} id={storyId} fit="cover" style={{ display: 'none' }}></image-slot>}
      <button className="img-menu-btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} aria-label="Photo options" title="Photo options">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
      </button>
      {open && (
        <div className="img-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={doReplace}>{hasPhoto ? 'Replace photo' : 'Add photo'}</button>
          {hasPhoto && <button onClick={doCrop}>Change avatar crop</button>}
          {hasPhoto && <button onClick={doTree}>{inTree ? 'Hide from tree' : 'Show on tree'}</button>}
          {hasPhoto && <button className="danger" onClick={doRemove}>Remove photo</button>}
        </div>
      )}
      {crop && hasPhoto && React.createElement(window.AvatarCropOverlay, { personId, idx, onClose: () => setCrop(false) })}
    </div>
  );
};

// Icon-button photo tools overlaid on a photo surface (used on the focus-view
// projector's centre frame). Same actions as PhotoMenuSlot but as a row of
// individual icon buttons: replace · avatar crop · show/hide on tree · remove.
window.PhotoIconTools = function PhotoIconTools({ personId, idx }) {
  const store = window.ImageSlotStore;
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { if (store) return store.subscribe(() => force()); }, []);
  const storyId = `ph-${personId}-e${idx}`;
  const avId = `av-${personId}-e${idx}`;
  const key = `${personId}-e${idx}`;
  const hasPhoto = !!(store && store.has(storyId));
  const photoUrl = ((store && store.get(storyId)) || {}).u || '';
  const [crop, setCrop] = React.useState(false);
  const [inTree, setInTree] = React.useState(() => !(window.FTtree && window.FTtree.isExcluded(key)));
  const storyRef = React.useRef(null);
  const shadowClick = (ref, act) => {
    const el = ref.current; if (!el) return;
    const b = el.shadowRoot && el.shadowRoot.querySelector('[data-act=' + act + ']');
    if (b) { b.click(); return; }
    if (act === 'replace' && el._input) el._input.click();
  };
  const doReplace = () => shadowClick(storyRef, 'replace');
  const doRemove = () => { setCrop(false); shadowClick(storyRef, 'clear'); };
  const doTree = () => { const next = !inTree; setInTree(next); window.FTtree && window.FTtree.setExcluded(key, !next); };
  const stop = (e) => e.stopPropagation();
  const SW = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div onClick={stop} onPointerDown={stop}>
      <image-slot ref={storyRef} id={storyId} fit="cover" style={{ display: 'none' }}></image-slot>
      <div className="pit-btns">
        <button title={hasPhoto ? 'Replace photo' : 'Add photo'} aria-label="Replace photo" onClick={doReplace}>
          <svg width="16" height="16" viewBox="0 0 24 24" {...SW}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
        </button>
        {hasPhoto && <button title="Change avatar crop" aria-label="Change avatar crop" onClick={() => setCrop((c) => !c)}>
          <svg width="16" height="16" viewBox="0 0 24 24" {...SW}><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
        </button>}
        {hasPhoto && <button title={inTree ? 'Hide from tree' : 'Show on tree'} aria-label={inTree ? 'Hide from tree' : 'Show on tree'} onClick={doTree}>
          {inTree
            ? <svg width="16" height="16" viewBox="0 0 24 24" {...SW}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" {...SW}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>}
        </button>}
        {hasPhoto && <button className="danger" title="Remove photo" aria-label="Remove photo" onClick={doRemove}>
          <svg width="16" height="16" viewBox="0 0 24 24" {...SW}><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
        </button>}
      </div>
      {crop && hasPhoto && React.createElement(window.AvatarCropOverlay, { personId, idx, onClose: () => setCrop(false) })}
    </div>
  );
};

function TreeNode({ person, lang, style, year, selected, dimmed, onSelect, onOpenFocus, relation, selMode }) {
  const R = window.REL;
  const status = R.statusAt(person, year);
  const dead = status === 'dead';
  const age = R.ageAt(person, year);
  const years = dead ? `${person.birth.year}\u2013${person.death.year}` :
  status === 'unborn' ? `b. ${person.birth.year}` : `Age ${age}`;
  const subLine = dead ? `aged ${person.death.year - person.birth.year}` : `b. ${person.birth.year}`;
  // living → stage-coloured chip; dead → cream-grey pill with age at death; unborn → plain text.
  const stage = status === 'living' ? R.stageOfAge(age) : null;
  const ageLabel = `Age ${age}`;
  const yearsEl = status === 'living' ?
  <span className="age-chip" style={{ '--chip': R.STAGE_COLOR[stage], '--chip-ink': stage === 'later' ? '#0B4A52' : '#fff' }}>{ageLabel}</span> :
  status === 'dead' ?
  <span className="age-chip dead">{ageLabel}</span> :
  <span className="tn-years">{years}</span>;
  // when a person is selected, the relation to them rides on the card's top edge
  const relEl = relation ? <span className={'node-rel-overlay' + (lang === 'he' ? ' he' : '')} dir="auto">{relation}</span> : null;
  // photo growth: stays a circle through age 5 (just growing), then morphs into the
  // full-width rounded rectangle by adulthood (19). Only the image container changes.
  const A = status === 'unborn' ? 0 : age || 0;
  let fW, fH, fRad;
  if (A <= 5) {
    const d = Math.round(64 + (92 - 64) * (A / 5)); // growing circle
    fW = d;fH = d;fRad = Math.round(d / 2);
  } else {
    const t = Math.min(1, (A - 5) / 14); // circle → rounded rect
    fW = Math.round(92 + (156 - 92) * t);
    fH = Math.round(92 + (120 - 92) * t);
    fRad = Math.round(46 * (1 - t) + 6 * t);
  }
  // childhood card is ~10% narrower with tighter side margins, growing to 100% by adulthood
  const prog = Math.min(1, A / 19);
  const cardW = Math.round(172 * (0.8 + 0.2 * prog));
  const padX = (4 + 4 * prog).toFixed(1) + 'px';
  const baseSel = selected ? { boxShadow: '0 0 0 2px var(--blue), var(--shadow-pop)', borderColor: 'var(--blue)' } : null;
  const click = (e) => {e.stopPropagation(); if (selected) {onOpenFocus && onOpenFocus(person.id);} else {onSelect(person.id);}};
  const cls = (base) => base + (selected ? ' sel' : '') + (dead ? ' dead' : '');
  const sty = { opacity: dimmed ? 0.28 : 1, ...(baseSel || {}) };

  if (style === 'photo') {
    return (
      <div className={cls('tnode tnode-photo')} onClick={click} style={{ ...sty, width: cardW, paddingLeft: padX, paddingRight: padX }}>
        {relEl}
        {dead && <span className="halo" />}
        <div className="photo-frame" style={{ width: fW, height: fH, borderRadius: fRad }}>
          {(() => {
            const av = autoAvatar(person.id, year);
            // Per-photo avatar slot: auto-fills from the added era photo (src),
            // but the user can drop a different image or drag/resize to reframe —
            // that override + crop persist per photo, independent of the story view.
            const avId = av.idx !== -1 ? `av-${person.id}-e${av.idx}` : `av-${person.id}`;
            // key is stable per person (NOT per photo) so scrubbing across
            // milestones updates id/src on the same mounted element instead of
            // remounting — a remount paints an empty frame until the new
            // data-URL decodes.
            // Crops are authored on a SQUARE canvas (the crop overlay), and the
            // slot's framing offsets are frame-relative. Render the slot as a
            // centred square FIXED at the adult frame's longer side — the photo
            // itself never scales while the circle grows; the animating frame
            // just unmasks more of it, and the saved crop reproduces at every
            // frame aspect.
            const S = 156;
            // Ages 0–10: render slightly more zoomed OUT than the stored crop —
            // the tight head crop clips small faces in the little circle frame.
            // 20% out at age 0, easing linearly to 0% by age 10. Display-only.
            const zoomMult = A < 10 ? 1 - 0.2 * (1 - A / 10) : 1;
            const props = { key: 'av-' + person.id, id: avId, shape: 'rect', fit: 'cover', 'no-reframe': '', 'zoom-mult': zoomMult.toFixed(3),
              style: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                width: S + 'px', height: S + 'px' }, placeholder: initials(person) };
            // auto-picked face-framed avatar when a photo exists; otherwise the
            // shared default/empty-state image (still droppable to replace).
            props.src = av.u || 'assets/default-avatar.jpg';
            return React.createElement('image-slot', props);
          })()}
        </div>
        <div className="tn-name por"><NameText person={person} lang={lang} /></div>
        <div className="tn-years-row">{yearsEl}</div>
      </div>);

  }
  if (style === 'minimal') {
    return (
      <div className={cls('tnode tnode-min')} onClick={click} style={sty}>
        {relEl}
        <Medallion person={person} size={28} deceased={dead} />
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div className="tn-name"><NameText person={person} lang={lang} /></div>
          <div className="tn-years-row">{yearsEl}</div>
        </div>
      </div>);

  }
  if (style === 'portraits') {
    return (
      <div className={cls('tnode tnode-por')} onClick={click} style={sty}>
        {relEl}
        <Medallion person={person} size={62} deceased={dead} />
        <div className="tn-name por"><NameText person={person} lang={lang} /></div>
        <div className="tn-years-row">{yearsEl}</div>
        <div className="tn-sub">{dead ? `${person.birth.place.split(',')[0]}` : subLine}</div>
      </div>);

  }
  // cards (default)
  return (
    <div className={cls('tnode tnode-card')} onClick={click} style={sty}>
      {relEl}
      <Medallion person={person} size={44} deceased={dead} />
      <div style={{ minWidth: 0 }}>
        <div className="tn-name"><NameText person={person} lang={lang} /></div>
        <div className="tn-meta">
          {yearsEl}
        </div>
        <div className="tn-sub">{subLine}{!dead ? `, ${person.birth.place.split(',')[0]}` : ''}</div>
      </div>
    </div>);

}

const NODE_H = { cards: 78, portraits: 152, minimal: 52, photo: 188 };
const ROWGAP_FOR = (style) => style === 'minimal' ? 60 : style === 'photo' ? 96 : 86;

function TreeCanvas({ layout, lang, style, year, showSideLinks, focusBranch, familyFocus, selectedId, onSelect, onOpenFocus, lifeEffects, editMode }) {
  const R = window.REL;
  // Re-render when saved photos finish loading (or any slot changes), so the
  // auto-picked node avatars appear once the image store's sidecar lands.
  const [, forceStore] = useState(0);
  useEffect(() => window.ImageSlotStore && window.ImageSlotStore.subscribe(() => forceStore((n) => n + 1)), []);
  // recompute avatars when a photo is shown/hidden from the tree in the person page
  useEffect(() => {
    const h = () => forceStore((n) => n + 1);
    window.addEventListener('ft-tree-changed', h);
    return () => window.removeEventListener('ft-tree-changed', h);
  }, []);
  const nodeH = NODE_H[style];
  const rowH = nodeH + ROWGAP_FOR(style);
  const yTop = (cy) => cy / R.ROW_H * rowH;
  const yCenter = (cy) => yTop(cy) + nodeH / 2;

  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const nodeEls = useRef({}); // id -> wrapper DOM node
  const connEls = useRef({}); // connId -> DOM node
  const sim = useRef(null);
  const [conns, setConns] = useState([]);
  // celebrations while scrubbing forward: fireworks (+ pixel heart) when a
  // couple marries · boy/girl confetti when a baby is born
  const confettiRef = useRef(null);
  const prevYearRef = useRef(year);
  useEffect(() => {
    const prev = prevYearRef.current;
    prevYearRef.current = year;
    if (year <= prev || !sim.current) return;   // forward crossings only
    if (editMode) return;                        // edit mode: no celebrations (incl. the enter-edit year jump)
    const fx = lifeEffects || 'hurray';
    if (fx === 'off') return;                    // celebrations muted
    // Nodes may not be in the sim yet (people enter the visible set AT the
    // event year and pop in from scale 0) — retry on rAF until every node
    // involved exists and has grown in, then run the effect.
    const whenReady = (ids, fn) => {
      const t0 = performance.now();
      const tryIt = () => {
        const N = (sim.current && sim.current.nodes) || {};
        const ns = ids.map((i) => N[i]);
        if (ns.every((n) => n && (n.s ?? 0) > 0.35)) fn(ns, (sim.current.geom && sim.current.geom.nodeH) || 0);
        else if (performance.now() - t0 < 1600) requestAnimationFrame(tryIt);
      };
      tryIt();
    };
    // marriage → fireworks bursting above the couple, leaving a small pixel heart
    R.F.unions.forEach((u) => {
      if (!(prev < u.year && u.year <= year)) return;
      whenReady([u.a, u.b], (ns, nodeH) => {
        const mx = (ns[0].x + ns[1].x) / 2, my = (ns[0].y + ns[1].y) / 2;
        // heart anchor: live midpoint between the two cards, riding on their TOP edge
        const track = () => {
          const N = (sim.current && sim.current.nodes) || {};
          const a = N[u.a], b = N[u.b];
          return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - nodeH / 2 } : { x: mx, y: my - nodeH / 2 };
        };
        // rocket launches from the middle of the couple's cards and bursts right above them
        if (fx === 'hurray') fireworksAt(confettiRef.current, mx, my - nodeH / 2 - 58 * FX_SCALE, my, track);
        else confettiBurst(confettiRef.current, mx, my - nodeH / 2, ['#EB5757', '#F5928B', 'var(--amber)', '#FFFFFF'], { count: 16, scale: 0.72 }); // mild: a gentle warm puff, no rocket
      });
    });
    // birth → confetti from the top of the newborn's card, blue/white for boys, pink/white for girls.
    // A newborn card spawns near the parents and glides to its layout spot —
    // wait until it has (nearly) arrived so the confetti pops where the card
    // actually appears, not over the parents.
    R.F.people.forEach((p) => {
      if (!(prev < p.birth.year && p.birth.year <= year)) return;
      const t0 = performance.now();
      const colors = p.sex === 'f' ? GIRL_CONFETTI : BOY_CONFETTI;
      const cfOpts = fx === 'mild' ? { count: 12, scale: 0.7 } : undefined;
      const tryIt = () => {
        const N = (sim.current && sim.current.nodes) || {};
        const n = N[p.id];
        const nodeH = (sim.current && sim.current.geom && sim.current.geom.nodeH) || 0;
        if (n && (n.s ?? 0) > 0.5 && Math.hypot(n.tx - n.x, n.ty - n.y) < 24) {
          confettiBurst(confettiRef.current, n.x, n.y - nodeH / 2 + 74, colors, cfOpts);
        } else if (performance.now() - t0 >= 2600) {
          if (n) confettiBurst(confettiRef.current, n.tx, n.ty - nodeH / 2 + 74, colors, cfOpts); // fallback: at the layout target
        } else {
          requestAnimationFrame(tryIt);
        }
      };
      tryIt();
    });
  }, [year, lifeEffects]);
  const [tip, setTip] = useState(null);

  // one-time sim init
  if (!sim.current) {
    const nodes = {};
    R.F.people.forEach((p) => {nodes[p.id] = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, s: 0.01, sv: 0, tx: 0, ty: 0, ts: 0, init: false, dim: 1 };});
    sim.current = { nodes, edges: [], conns: [], view: { scale: 1, tx: 0, ty: 0, vs: 0, vtx: 0, vty: 0 }, viewT: { scale: 1, tx: 0, ty: 0 }, viewInit: false, drag: null, pan: null, geom: { nodeH, year } };
  }
  sim.current.geom = { nodeH, year };

  // fit → camera target (founders centred; eases via spring)
  const computeFit = () => {
    const el = wrapRef.current;if (!el) return null;
    // while the side panel is open, fit into the space left of it. The fit
    // target only refreshes on layout changes (scrubbing), resize or "Fit" —
    // opening the panel alone does NOT move the camera.
    const dEl = document.querySelector('.drawer');
    const inset = dEl ? Math.min(el.clientWidth * 0.55, dEl.getBoundingClientRect().width + 28) : 0;
    const W = el.clientWidth - inset,H = el.clientHeight,pad = 56;
    const NH = NODE_H[style],rGap = ROWGAP_FOR(style);
    const maxG = Math.max(0, ...Object.values(layout.pos).map((p) => p.gen));
    const cw = Math.max(layout.width, 420),ch = Math.max((maxG + 1) * (NH + rGap), 240);
    const scale = Math.max(Math.min((W - pad * 2) / cw, (H - pad * 2) / ch, 1.3), 0.25);
    const midX = (layout.minX + layout.maxX) / 2;
    return { scale, tx: W / 2 - midX * scale, ty: Math.max(pad * 0.7, (H - ch * scale) / 2) };
  };

  // ---- on layout / style change: update targets, edges, connectors, camera target ----
  useEffect(() => {
    const s = sim.current;
    // people added in edit mode need sim entries before anything touches them
    R.F.people.forEach((p) => { if (!s.nodes[p.id]) s.nodes[p.id] = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, s: 0.01, sv: 0, tx: 0, ty: 0, ts: 0, init: false, dim: 1 }; });
    const cyC = (cy) => cy / R.ROW_H * rowH + nodeH / 2;
    // targets
    R.F.people.forEach((p) => {
      const n = s.nodes[p.id];
      const pos = layout.pos[p.id];
      if (pos) {
        n.btx = pos.cx;
        n.tx = pos.cx + (n.txOff || 0);n.ty = cyC(pos.cy);n.ts = 1;
        if (!n.init) {
          const par = R.parentsOf(p.id).map((id) => s.nodes[id]).find((pn) => pn && pn.init && pn.s > 0.15);
          if (par) {n.x = par.x;n.y = par.y;} else {n.x = n.tx;n.y = n.ty;}
          n.s = 0.01;n.sv = 0;n.init = true;
        }
      } else {
        n.ts = 0;
        const par = R.parentsOf(p.id).map((id) => s.nodes[id]).find((pn) => pn);
        if (par) {n.tx = par.tx;n.ty = par.ty;}
      }
    });
    // edges (springs at rest at the layout distance) — only among visible nodes
    const edges = [];
    const dist = (a, b) => Math.hypot(s.nodes[a].tx - s.nodes[b].tx, s.nodes[a].ty - s.nodes[b].ty) || 1;
    R.F.unions.forEach((u) => {
      if (!layout.pos[u.a] || !layout.pos[u.b]) return;
      edges.push({ a: u.a, b: u.b, rest: dist(u.a, u.b), k: 0.022, year: u.year });
      R.childrenOfUnion(u).forEach((cid) => {
        if (!layout.pos[cid]) return;
        edges.push({ a: u.a, b: cid, rest: dist(u.a, cid), k: 0.013 });
        edges.push({ a: u.b, b: cid, rest: dist(u.b, cid), k: 0.013 });
      });
    });
    // single-parent springs — keep un-partnered parents' children hanging below them
    R.F.people.forEach((p) => {
      if (!layout.pos[p.id] || !p.parents.length) return;
      const unitedVis = p.parents.length === 2 && R.F.unions.some((u) => layout.pos[u.a] && layout.pos[u.b] && [u.a, u.b].every((x) => p.parents.includes(x)));
      if (unitedVis) return;
      p.parents.forEach((pid) => { if (layout.pos[pid]) edges.push({ a: pid, b: p.id, rest: dist(pid, p.id), k: 0.013 }); });
    });
    s.edges = edges;
    // connectors metadata
    s.conns = buildConnMeta(layout, showSideLinks, R);
    setConns(s.conns);
    // camera
    const f = computeFit();
    if (f) {s.viewT = { ...f };s.minScale = f.scale;if (!s.viewInit) {s.view = { ...f, vs: 0, vtx: 0, vty: 0 };s.viewInit = true;}}
  }, [layout, style, showSideLinks]);

  // before a couple marries, hold their cards apart — so the moment they wed,
  // the two cards visibly glide together (they'd otherwise sit side-by-side
  // from birth as if married at age 0)
  const UNWED_GAP = 34; // px each, ~68px extra daylight per couple
  useEffect(() => {
    const s = sim.current; if (!s) return;
    const off = {};
    R.F.unions.forEach((u) => {
      if (year >= u.year) return;
      const pa = layout.pos[u.a], pb = layout.pos[u.b];
      if (!pa || !pb) return;
      const dir = pa.cx <= pb.cx ? -1 : 1;
      off[u.a] = (off[u.a] || 0) + dir * UNWED_GAP;
      off[u.b] = (off[u.b] || 0) - dir * UNWED_GAP;
    });
    R.F.people.forEach((p) => {
      const n = s.nodes[p.id];
      if (!n || !layout.pos[p.id] || n.btx === undefined) return;
      n.txOff = off[p.id] || 0;
      n.tx = n.btx + n.txOff;
    });
  }, [year, layout, style]);

  // ---- the animation loop ----
  useEffect(() => {
    const KT = 0.045,DAMP = 0.8,KS = 0.16,SDAMP = 0.74,KV = 0.16,VDAMP = 0.86;
    const frame = () => {
      const s = sim.current,N = s.nodes,g = s.geom;
      const v = s.view,vt = s.viewT;
      // sleep when fully settled — stops touching the DOM at rest (keeps image-slots calm)
      let active = !!(s.drag || s.pan || s.repaint) ||
      Math.abs(vt.scale - v.scale) > 0.0004 || Math.abs(vt.tx - v.tx) > 0.15 || Math.abs(vt.ty - v.ty) > 0.15;
      if (!active) {
        for (const id in N) {const n = N[id];
          if (Math.abs(n.tx - n.x) > 0.15 || Math.abs(n.ty - n.y) > 0.15 || Math.abs(n.ts - n.s) > 0.004 ||
          Math.abs(n.vx) > 0.04 || Math.abs(n.vy) > 0.04 || Math.abs(n.sv) > 0.004) {active = true;break;}
        }
      }
      if (!active) return; // at rest — nothing to do
      s.repaint = false; // one-shot wake (e.g. dim/connector refresh on selection)
      // camera — smooth exponential ease toward target (no overshoot / no bounce)
      const CAM = 0.18;
      v.vs = 0;v.scale += (vt.scale - v.scale) * CAM;
      const minS = s.minScale || 0.25;
      if (v.scale < minS) v.scale = minS;
      if (v.scale > 2.2) v.scale = 2.2;
      v.vtx = 0;v.tx += (vt.tx - v.tx) * CAM;
      v.vty = 0;v.ty += (vt.ty - v.ty) * CAM;
      if (contentRef.current) contentRef.current.style.transform = `translate(${v.tx}px,${v.ty}px) scale(${v.scale})`;
      // accumulate target-spring accel
      for (const id in N) {const n = N[id];n.ax = (n.tx - n.x) * KT;n.ay = (n.ty - n.y) * KT;}
      // edge springs (coupling) — only when both endpoints are present
      for (const e of s.edges) {
        const a = N[e.a],b = N[e.b];if (a.s < 0.05 || b.s < 0.05) continue;
        if (e.year && g.year < e.year) continue; // marriage spring engages only once wed
        const dx = b.x - a.x,dy = b.y - a.y,d = Math.hypot(dx, dy) || 1;
        const f = (d - e.rest) / d * e.k;
        a.ax += dx * f;a.ay += dy * f;b.ax -= dx * f;b.ay -= dy * f;
      }
      // integrate
      for (const id in N) {
        const n = N[id];
        if (!(s.drag && s.drag.id === id)) {
          n.vx = (n.vx + n.ax) * DAMP;n.vy = (n.vy + n.ay) * DAMP;
          n.x += n.vx;n.y += n.vy;
        }
        const as = (n.ts - n.s) * KS;n.sv = (n.sv + as) * SDAMP;n.s += n.sv;
        if (n.s < 0) {n.s = 0;n.sv = 0;}
        const el = nodeEls.current[id];
        if (el) {
          el.style.transform = `translate(${n.x}px,${n.y}px) translate(-50%,-50%) scale(${n.s.toFixed(3)})`;
          el.style.opacity = n.s < 0.02 ? '0' : '1';
          el.style.pointerEvents = n.s > 0.55 ? 'auto' : 'none';
        }
      }
      // connectors
      updateConns(s, N, connEls.current, g);
    };
    let iv = null;
    // defer the loop start so it doesn't race the image-slot web components mounting on load
    const startT = setTimeout(() => {if (!window.__NOPHYS) iv = setInterval(frame, 1000 / 60);}, 450);
    return () => {clearTimeout(startT);clearInterval(iv);};
  }, []);

  // resize → recompute camera target
  useEffect(() => {
    const onResize = () => {const f = computeFit();if (f) sim.current.viewT = { ...f };};
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layout, style]);

  // ---- pointer: pan bg / drag node, with spring-back ----
  const toTree = (e) => {
    const r = wrapRef.current.getBoundingClientRect(),v = sim.current.view;
    return { x: (e.clientX - r.left - v.tx) / v.scale, y: (e.clientY - r.top - v.ty) / v.scale };
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    wrapRef.current.setPointerCapture(e.pointerId);
    sim.current.drag = { id, moved: false, sx: e.clientX, sy: e.clientY };
  };
  const onWrapDown = (e) => {
    if (sim.current.drag) return;
    wrapRef.current.setPointerCapture(e.pointerId);
    const v = sim.current.view;
    sim.current.pan = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
    wrapRef.current.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    const s = sim.current;
    if (s.drag) {
      if (Math.hypot(e.clientX - s.drag.sx, e.clientY - s.drag.sy) > 4) s.drag.moved = true;
      const p = toTree(e);const n = s.nodes[s.drag.id];
      n.x = p.x;n.y = p.y;n.vx = 0;n.vy = 0;
    } else if (s.pan) {
      const dx = e.clientX - s.pan.x,dy = e.clientY - s.pan.y;
      if (Math.hypot(dx, dy) > 4) s.pan.moved = true;
      s.view.tx = s.pan.tx + dx;s.view.ty = s.pan.ty + dy;
      s.view.vtx = 0;s.view.vty = 0;
      s.viewT.tx = s.view.tx;s.viewT.ty = s.view.ty;
    }
  };
  const onUp = (e) => {
    const s = sim.current;
    try {wrapRef.current.releasePointerCapture(e.pointerId);} catch (_) {}
    if (s.drag) {if (!s.drag.moved) {
      if (editMode) { window.dispatchEvent(new CustomEvent('ft-edit-open', { detail: s.drag.id })); }
      else if (selectedId === s.drag.id) {onOpenFocus && onOpenFocus(s.drag.id);} else {onSelect(s.drag.id);}}s.drag = null;} else
    if (s.pan && !s.pan.moved) {onSelect(null);}
    if (s.pan) {s.pan = null;if (wrapRef.current) wrapRef.current.style.cursor = 'grab';}
  };
  const onWheel = (e) => {
    e.preventDefault();
    const s = sim.current,r = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left,my = e.clientY - r.top,vt = s.viewT;
    const ns = Math.min(2.2, Math.max(s.minScale || 0.25, vt.scale * (e.deltaY < 0 ? 1.12 : 0.9)));
    const k = ns / vt.scale;
    s.viewT = { scale: ns, tx: mx - (mx - vt.tx) * k, ty: my - (my - vt.ty) * k };
  };
  const zoom = (dir) => {
    const s = sim.current,el = wrapRef.current,W = el.clientWidth / 2,H = el.clientHeight / 2,vt = s.viewT;
    const ns = Math.min(2.2, Math.max(s.minScale || 0.25, vt.scale * (dir > 0 ? 1.2 : 0.83)));
    const k = ns / vt.scale;
    s.viewT = { scale: ns, tx: W - (W - vt.tx) * k, ty: H - (H - vt.ty) * k };
  };
  const doFit = () => {const f = computeFit();if (f) sim.current.viewT = { ...f };};
  // edit-toolbar zoom buttons (mag glass lives in the toolbar during edit mode)
  useEffect(() => {
    const h = (e) => { const d = e.detail; if (d === 'fit') doFit(); else zoom(d); };
    window.addEventListener('ft-edit-zoom', h);
    return () => window.removeEventListener('ft-edit-zoom', h);
  }, []);

  // branch highlighting
  const litSet = useMemo(() => {
    if (!focusBranch) return null;
    const lit = new Set([focusBranch]);
    const addLineage = (seed) => {
      (function up(id) {R.parentsOf(id).forEach((p) => {if (!lit.has(p)) {lit.add(p);up(p);}});})(seed);
      (function down(id) {R.childrenOf(id).forEach((c) => {if (!lit.has(c)) {lit.add(c);down(c);}});})(seed);
    };
    addLineage(focusBranch);
    // add immediate spouses of everyone lit
    const spouses = new Set();
    [...lit].forEach((id) => R.unionsOf(id).forEach((u) => {[u.a, u.b].forEach((s) => {if (!lit.has(s)) spouses.add(s);lit.add(s);});}));
    // family focus: also light each married-in spouse's own family (the in-law branches)
    if (familyFocus) {
      [...spouses].forEach(addLineage);
      [...lit].forEach((id) => R.unionsOf(id).forEach((u) => {lit.add(u.a);lit.add(u.b);}));
    }
    return lit;
  }, [focusBranch, familyFocus]);

  // mirror the dim state onto the sim nodes so connectors fade with the cards they pass behind
  useEffect(() => {
    const N = sim.current.nodes;
    for (const id in N) N[id].dim = litSet ? (litSet.has(id) ? 1 : 0.28) : 1;
    sim.current.repaint = true;
  }, [litSet]);

  const tipAt = (e, text) => {const r = wrapRef.current.getBoundingClientRect();setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text });};
  const hideTip = () => setTip(null);

  if (window.__STUB) return <div className="canvas-wrap" ref={wrapRef}>stub</div>;
  return (
    <div className="canvas-wrap" ref={wrapRef}
    onPointerDown={onWrapDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}>
      <div className="canvas-content" ref={contentRef} style={{ width: 0, height: 0, transformOrigin: '0 0' }}>
        <svg className="conn" width="1" height="1" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {conns.map((c) => {
            if (c.kind === 'marriage') return (
              <g key={c.id}>
                <line ref={(el) => connEls.current[c.id] = el} stroke="var(--amber)" strokeWidth="2"
                strokeDasharray={c.type === 'partnership' ? '2 5' : 'none'} strokeLinecap="round" opacity="0" />
                <line ref={(el) => connEls.current[c.id + '_h'] = el} stroke="transparent" strokeWidth="16"
                style={{ pointerEvents: 'stroke', cursor: 'help' }}
                onMouseEnter={(e) => tipAt(e, c.label)} onMouseMove={(e) => tipAt(e, c.label)} onMouseLeave={hideTip} />
                <circle ref={(el) => connEls.current[c.id + '_r'] = el} r="3.5" fill="var(--surface)" stroke="var(--amber)" strokeWidth="1.6" opacity="0" />
              </g>);

            if (c.kind === 'child') return (
              <path key={c.id} ref={(el) => connEls.current[c.id] = el} fill="none" stroke="var(--line-3)" strokeWidth="1.6" opacity="0" />);

            if (c.kind === 'solo') return (
              <path key={c.id} ref={(el) => connEls.current[c.id] = el} fill="none" stroke="var(--line-3)" strokeWidth="1.6" strokeDasharray="1 5" strokeLinecap="round" opacity="0" />);

            return (
              <g key={c.id}>
                <path ref={(el) => connEls.current[c.id] = el} fill="none" stroke="var(--plum)" strokeWidth="1.5" strokeDasharray="2 6" opacity="0" />
                <path ref={(el) => connEls.current[c.id + '_h'] = el} fill="none" stroke="transparent" strokeWidth="18"
                style={{ pointerEvents: 'stroke', cursor: 'help' }}
                onMouseEnter={(e) => tipAt(e, c.label)} onMouseMove={(e) => tipAt(e, c.label)} onMouseLeave={hideTip} />
              </g>);

          })}
        </svg>
        {R.F.people.map((p) =>
        <div key={p.id} className="node-pos" ref={(el) => nodeEls.current[p.id] = el}
        style={{ left: 0, top: 0, opacity: 0 }} onPointerDown={(e) => onNodeDown(e, p.id)}
        onDoubleClick={() => onOpenFocus && onOpenFocus(p.id)}>
            <TreeNode person={p} lang={lang} style={style} year={year}
          selected={selectedId === p.id}
          dimmed={litSet ? !litSet.has(p.id) : false}
          relation={selectedId && selectedId !== p.id ? R.relationOf(selectedId, p.id, lang) : null}
          selMode={!!selectedId}
          onSelect={onSelect} onOpenFocus={onOpenFocus} />
          </div>
        )}
        <div className="confetti-layer" ref={confettiRef}
          style={{ position: 'absolute', left: 0, top: 0, zIndex: 60, pointerEvents: 'none' }}></div>
      </div>

      {editMode && window.EditLayer && React.createElement(window.EditLayer, { simRef: sim, nodeEls, nodeH, wrapRef, onOpenFocus })}

      {!editMode && <div className="zoom-ctl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="zoom-pop">
          <button onClick={() => zoom(1)} title="Zoom in">+</button>
          <button onClick={() => zoom(-1)} title="Zoom out">{'\u2212'}</button>
          <button onClick={doFit} title="Fit to screen" className="fit">Fit</button>
        </div>
        <button className="zoom-main" title="Zoom" aria-label="Zoom controls">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path></svg>
        </button>
      </div>}

      {tip && <div className="conn-tip" style={{ left: tip.x, top: tip.y - 12 }}>{tip.text}</div>}
    </div>);

}

// helpers (module scope)
// small celebratory burst at (x,y) in canvas-content coordinates — pure DOM +
// WAAPI, no React state, particles remove themselves. Each bit gets its own
// velocity, fall depth, duration and a rotateX "twist" so it flutters down
// like paper rather than moving in lockstep.
const FX_SCALE = 0.75;   // all celebration effects render at 75%
const CONFETTI_COLORS = ['var(--amber)', 'var(--blue)', 'var(--plum)', 'var(--amber-d)', 'var(--blue-h)'];
const BOY_CONFETTI = ['var(--stage-adult)', '#0055CC', '#3D8BFF', '#2E75E6'];
const GIRL_CONFETTI = ['var(--stage-child)', '#E45C9C', '#FF5CA3', '#D6236F'];
function confettiBurst(layer, x, y, colors, opts) {
  if (!layer) return;
  const o = opts || {};
  const count = o.count || 30;
  const sc = FX_SCALE * (o.scale || 1);
  const palette = colors || CONFETTI_COLORS;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-bit';
    el.style.width = (5 * sc) + 'px';
    el.style.height = (8 * sc) + 'px';
    el.style.background = palette[i % palette.length];
    el.style.left = (x + (Math.random() * 44 - 22) * sc) + 'px';   // spawn along the top edge, not one point
    el.style.top = y + 'px';
    layer.appendChild(el);
    const ang = (-90 + (Math.random() * 120 - 60)) * Math.PI / 180;  // narrower upward fan
    const v = (34 + Math.random() * 96) * sc;    // pop strength varies (wider reach)
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
    const fall = (65 + Math.random() * 95) * sc; // fall depth varies
    const sway = (Math.random() * 52 - 26) * sc; // sideways drift while falling
    const spin = Math.random() * 640 - 320;            // in-plane rotation
    const twist = (240 + Math.random() * 720) * (Math.random() < 0.5 ? -1 : 1); // paper flutter
    const dur = 1100 + Math.random() * 900;            // each bit falls at its own speed
    const tf = (tx, ty, rz, rx) =>
      `translate(-50%,-50%) translate(${tx}px,${ty}px) rotateZ(${rz}deg) rotateX(${rx}deg)`;
    const anim = el.animate([
      { transform: tf(0, 0, 0, 0), opacity: 1 },
      { transform: tf(dx, dy, spin * 0.3, twist * 0.25), opacity: 1, offset: 0.22 },
      { transform: tf(dx * 1.15 + sway * 0.6, dy + fall * 0.45, spin * 0.62, twist * 0.6), opacity: 1, offset: 0.6 },
      { transform: tf(dx * 1.25 + sway, dy + fall, spin, twist), opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.22,.55,.5,1)' });
    anim.onfinish = () => el.remove();
  }
}

// ---- marriage fireworks: rocket climbs out of the union ring, triple burst,
// and a small 8-bit pixel heart remains for a beat before floating away ----
function fxEl(layer, css) {
  const d = document.createElement('div');
  Object.assign(d.style, { position: 'absolute', pointerEvents: 'none' }, css);
  layer.appendChild(d);
  return d;
}
// wedding fireworks: white, with the occasional red burst
const FW_COLORS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#EB5757'];
function fwBoom(layer, bx, by, k) {
  const n = Math.round(16 * k) + 6;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const dist = (46 + Math.random() * 34) * k * 1.4 * FX_SCALE;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    const rot = 'rotate(' + (ang + Math.PI / 2) + 'rad)';
    const col = FW_COLORS[i % FW_COLORS.length];
    // streaks of light: bright head fading into a translucent tail + soft same-color glow
    const st = fxEl(layer, { left: bx + 'px', top: by + 'px', width: (3 * FX_SCALE) + 'px', height: (11 * FX_SCALE) + 'px',
      borderRadius: '2px', zIndex: 8,
      background: 'linear-gradient(to bottom, #fff, ' + col + ' 45%, transparent)',
      filter: 'blur(.4px) drop-shadow(0 0 ' + (5 * FX_SCALE) + 'px ' + col + ')',
      transform: 'translate(-50%,-50%) ' + rot });
    st.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) ' + rot + ' scaleY(1.6)', opacity: 1, easing: 'cubic-bezier(.1,.7,.3,1)' },
      { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px) ' + rot + ' scaleY(1)', opacity: .95, offset: .45 },
      { transform: 'translate(-50%,-50%) translate(' + (dx * 1.12) + 'px,' + (dy + 30) + 'px) ' + rot + ' scaleY(.6)', opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.25,.6,.45,1)' }).onfinish = () => st.remove();
  }
  for (let j = 0; j < Math.round(6 * k) + 2; j++) {
    const col = FW_COLORS[j % FW_COLORS.length];
    // glowing ember dots — a hot white core fading through the color into nothing
    const s = fxEl(layer, { left: (bx + (Math.random() * 90 - 45) * k * FX_SCALE) + 'px', top: (by + (Math.random() * 60 - 30) * k * FX_SCALE) + 'px',
      width: (12 * FX_SCALE) + 'px', height: (12 * FX_SCALE) + 'px', zIndex: 9, borderRadius: '50%',
      background: 'radial-gradient(circle, #fff 0%, ' + col + ' 42%, transparent 72%)',
      transform: 'translate(-50%,-50%)' });
    s.animate([
      { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .4 },
      { transform: 'translate(-50%,-50%) translateY(14px) scale(.25)', opacity: 0 },
    ], { duration: 700 + Math.random() * 500, delay: 120 + Math.random() * 260, fill: 'backwards', easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
const HEART_PX = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
// pixel heart whose pixels are confetti bits: they pop in to form the heart,
// hold for a beat, then each one flutters slowly down and fades. `track()`
// returns the live anchor point — the heart rides between the couple's cards
// even while they're still gliding together.
function pixelHeartConfetti(layer, track, px) {
  const p0 = track();
  // slightly tighter grid + smaller jitter — a denser, still hand-scattered heart
  const cell = px + Math.max(1, Math.round(px * 0.2));
  const wrap = fxEl(layer, { left: p0.x + 'px', top: p0.y + 'px', width: (7 * cell) + 'px', height: (6 * cell) + 'px',
    transform: 'translate(-50%,-50%)', zIndex: 10 });
  const follow = () => {
    if (!wrap.isConnected) return;
    const p = track();
    wrap.style.left = p.x + 'px';
    wrap.style.top = p.y + 'px';
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
  const bits = [];
  HEART_PX.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== 'X') continue;
      const b = document.createElement('div');
      const jx = (Math.random() - .5) * px * 0.6, jy = (Math.random() - .5) * px * 0.6;
      const r0 = Math.random() * 26 - 13;
      Object.assign(b.style, { position: 'absolute', left: (c * cell + jx) + 'px', top: (r * cell + jy) + 'px',
        width: px + 'px', height: px + 'px', borderRadius: '1px', transform: 'rotate(' + r0 + 'deg)',
        background: (r < 2 && (c === 1 || c === 4)) ? '#F5928B' : '#EB5757',   // shades of the firework red
        boxShadow: '0 1px 2px rgba(38,33,26,.18)' });
      b._r0 = r0;
      wrap.appendChild(b);
      bits.push(b);
    }
  });
  bits.forEach((b, i) => {
    b.animate([
      { transform: 'scale(0) rotate(' + b._r0 + 'deg)', opacity: 0 },
      { transform: 'scale(1.35) rotate(' + b._r0 + 'deg)', opacity: 1, offset: .6 },
      { transform: 'scale(1) rotate(' + b._r0 + 'deg)' },
    ], { duration: 240, delay: i * 13, fill: 'backwards', easing: 'cubic-bezier(.2,.9,.3,1)' });
  });
  const HOLD = 950;
  bits.forEach((b) => {
    const fall = (60 + Math.random() * 85) * FX_SCALE, sway = (Math.random() * 38 - 19) * FX_SCALE, rot = Math.random() * 360 - 180;
    const dur = 1700 + Math.random() * 1200, delay = HOLD + Math.random() * 400;
    const r0 = b._r0;
    b.animate([
      { transform: `translate(0,0) rotateZ(${r0}deg) rotateX(0deg)`, opacity: 1 },
      { transform: `translate(${sway * .5}px,${fall * .42}px) rotateZ(${r0 + rot * .5}deg) rotateX(${rot * 2}deg)`, opacity: .95, offset: .55 },
      { transform: `translate(${sway}px,${fall}px) rotateZ(${r0 + rot}deg) rotateX(${rot * 4}deg)`, opacity: 0 },
    ], { duration: dur, delay: delay, fill: 'forwards', easing: 'cubic-bezier(.3,.4,.6,1)' });
  });
  setTimeout(() => wrap.remove(), HOLD + 400 + 3000);
}
// x/y = burst point (right above the cards) · fromY = launch height (middle of
// the cards) · track() = live anchor for the heart (midpoint between the couple)
function fireworksAt(layer, x, y, fromY, track) {
  if (!layer) return;
  const rocket = fxEl(layer, { width: (5 * FX_SCALE) + 'px', height: (12 * FX_SCALE) + 'px', borderRadius: '3px',
    background: '#FFFFFF', filter: 'drop-shadow(0 0 ' + (5 * FX_SCALE) + 'px #FFF6DE)', transform: 'translate(-50%,-50%)', zIndex: 9 });
  const x0 = x, y0 = fromY == null ? y + 118 : fromY, t0 = performance.now(), CLIMB = 280;
  const climb = (now) => {
    if (!layer.isConnected) { rocket.remove(); return; }
    const t = Math.min(1, (now - t0) / CLIMB);
    const e = 1 - Math.pow(1 - t, 2);
    const cx = x0 + (x - x0) * e + Math.sin(t * Math.PI * 2.5) * 5;
    const cy = y0 + (y - y0) * e;
    rocket.style.left = cx + 'px';
    rocket.style.top = cy + 'px';
    rocket.style.transform = 'translate(-50%,-50%) rotate(' + (Math.sin(t * Math.PI * 2.5) * 10) + 'deg)';
    if (Math.random() < .7) {
      const sp = fxEl(layer, { left: cx + 'px', top: (cy + 7 * FX_SCALE) + 'px', width: (3.5 * FX_SCALE) + 'px', height: (3.5 * FX_SCALE) + 'px',
        borderRadius: '50%', background: 'radial-gradient(circle, #fff 0%, #FFF3D6 45%, transparent 72%)',
        transform: 'translate(-50%,-50%)', zIndex: 8 });
      sp.animate([
        { opacity: .9, transform: 'translate(-50%,-50%) translateY(0)' },
        { opacity: 0, transform: 'translate(-50%,-50%) translateY(12px) scale(.4)' },
      ], { duration: 420 }).onfinish = () => sp.remove();
    }
    if (t < 1) { requestAnimationFrame(climb); return; }
    rocket.remove();
    fwBoom(layer, x, y, 1);
    setTimeout(() => fwBoom(layer, x - 46 * FX_SCALE, y - 24 * FX_SCALE, .55), 150);
    setTimeout(() => fwBoom(layer, x + 50 * FX_SCALE, y - 10 * FX_SCALE, .5), 260);
    // the heart forms early, while the embers are still flying — anchored
    // between the two cards, sitting on their top edge
    setTimeout(() => pixelHeartConfetti(layer, track || (() => ({ x: x, y: y })), 5 * FX_SCALE), 220);
  };
  requestAnimationFrame(climb);
}

function buildConnMeta(layout, showSideLinks, R) {
  const meta = [];
  layout.parentLinks.forEach((link) => {
    const u = R.F.unions.find((x) => x.id === link.unionId);
    meta.push({ id: 'm' + link.unionId, kind: 'marriage', a: u.a, b: u.b, union: link.unionId, year: link.year, type: link.type,
      label: link.type === 'partnership' ? `Partners \u00b7 since ${link.year}` : `Married \u00b7 ${link.year}` });
    R.childrenOfUnion(u).forEach((cid) => {
      if (!layout.pos[cid]) return;
      meta.push({ id: 'c' + link.unionId + cid, kind: 'child', a: u.a, b: u.b, child: cid, union: link.unionId, year: link.year });
    });
  });
  // single-parent children — a solo drop-line from the parent's card
  R.F.people.forEach((c) => {
    if (!layout.pos[c.id] || !c.parents.length) return;
    const unitedVis = c.parents.length === 2 && R.F.unions.some((u) => layout.pos[u.a] && layout.pos[u.b] && [u.a, u.b].every((x) => c.parents.includes(x)));
    if (unitedVis) return;
    c.parents.forEach((pid) => {
      if (!layout.pos[pid]) return;
      meta.push({ id: 'solo' + pid + c.id, kind: 'solo', a: pid, child: c.id });
    });
  });
  if (showSideLinks) {
    layout.sideLinkGeo.forEach((sl, i) => {
      meta.push({ id: 's' + i, kind: 'side', from: sl.from, to: sl.to, label: sl.detail || sl.kind });
    });
  }
  return meta;
}

function updateConns(s, N, els, g) {
  const nodeH = g.nodeH,year = g.year;
  const set = (el, attrs) => {if (el) for (const k in attrs) el.setAttribute(k, attrs[k]);};
  s.conns.forEach((c) => {
    if (c.kind === 'marriage') {
      const a = N[c.a],b = N[c.b];if (!a || !b) return;
      const dim = Math.min(a.dim ?? 1, b.dim ?? 1);
      const married = year >= c.year,vis = Math.min(a.s, b.s) * dim;
      const op = married ? vis * 0.85 : 0;
      const jx = (a.x + b.x) / 2,jy = (a.y + b.y) / 2;
      set(els[c.id], { x1: a.x, y1: a.y, x2: b.x, y2: b.y, opacity: op });
      set(els[c.id + '_h'], { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      set(els[c.id + '_r'], { cx: jx, cy: jy, opacity: married ? vis : 0 });
    } else if (c.kind === 'child') {
      const a = N[c.a],b = N[c.b],ch = N[c.child];if (!a || !b || !ch) return;
      const dim = Math.min(a.dim ?? 1, b.dim ?? 1, ch.dim ?? 1);
      const married = year >= c.year,vis = Math.min(a.s, b.s, ch.s) * dim;
      const jx = (a.x + b.x) / 2,jy = (a.y + b.y) / 2 + nodeH / 2; // junction at couple's lower edge
      const x2 = ch.x,y2 = ch.y - nodeH / 2;
      const my = jy + (y2 - jy) * 0.5;
      set(els[c.id], { d: `M ${jx} ${jy} C ${jx} ${my} ${x2} ${my} ${x2} ${y2}`, opacity: married ? vis : 0 });
    } else if (c.kind === 'solo') {
      const a = N[c.a],ch = N[c.child];if (!a || !ch) return;
      const dim = Math.min(a.dim ?? 1, ch.dim ?? 1);
      const vis = Math.min(a.s, ch.s) * dim;
      const jx = a.x,jy = a.y + nodeH / 2;
      const x2 = ch.x,y2 = ch.y - nodeH / 2;
      const my = jy + (y2 - jy) * 0.5;
      set(els[c.id], { d: `M ${jx} ${jy} C ${jx} ${my} ${x2} ${my} ${x2} ${y2}`, opacity: vis * 0.9 });
    } else {
      const a = N[c.from],b = N[c.to];if (!a || !b) return;
      const dim = Math.min(a.dim ?? 1, b.dim ?? 1);
      const vis = Math.min(a.s, b.s) * dim;
      const x1 = a.x,y1 = a.y,x2 = b.x,y2 = b.y;
      const dx = x2 - x1,dy = y2 - y1,len = Math.hypot(dx, dy) || 1,off = Math.min(80, len * 0.2);
      const c1x = x1 + dx * 0.25 - dy / len * off,c1y = y1 + dy * 0.25 + dx / len * off;
      const c2x = x1 + dx * 0.75 - dy / len * off,c2y = y1 + dy * 0.75 + dx / len * off;
      const d = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
      set(els[c.id], { d, opacity: vis * 0.6 });
      set(els[c.id + '_h'], { d });
    }
  });
}

Object.assign(window, { TreeCanvas, NameText, nameOf, initials, Medallion });