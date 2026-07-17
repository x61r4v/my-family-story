/* edit-mode.jsx — grow-the-tree mode: top-bar chip + bottom toolbar shell.
   Node-level interactions (edge pluses, wires, detail card) live in tree-canvas.jsx;
   the toolbar talks to them through 'ft-edit-add' / 'ft-edit-find' window events. */

function EditChip({ editing, onToggle }) {
  const [nPend, setNPend] = React.useState(() => (window.FTStore ? window.FTStore.pendingOps().length : 0));
  React.useEffect(() => (window.FTStore ? window.FTStore.subscribe(() => setNPend(window.FTStore.pendingOps().length)) : undefined), []);
  return (
    <button className={'edit-chip' + (editing ? (nPend > 0 ? ' on' : ' quiet') : '')} onClick={onToggle}
      title={editing ? 'Back to viewing' : 'Edit the tree — add people & connections'}>
      {editing
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg>}
      <span>{editing ? 'Done' : 'Edit tree'}</span>
    </button>
  );
}

const EDIT_ADD_MODES = [
  { rel: 'person',  lbl: 'Add person',  ic: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21c0-3.9 3.6-7 8-7s8 3.1 8 7' },
  { rel: 'parent',  lbl: 'Add parent',  ic: 'M12 4v16M6 10l6-6 6 6' },
  { rel: 'partner', lbl: 'Add partner', ic: 'M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4' },
  { rel: 'child',   lbl: 'Add child',   ic: 'M12 20V4M6 14l6 6 6-6' },
  { rel: 'sibling', lbl: 'Add sibling', ic: 'M7 20v-8M17 20v-8M7 8l5-5 5 5M12 3v9' },
];

function EditToolbar({ onDone, onOpenPublish }) {
  const [menu, setMenu] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [armed, setArmed] = React.useState(null);
  const [nPend, setNPend] = React.useState(() => (window.FTStore ? window.FTStore.pendingOps().length : 0));
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => setArmed(e.detail);
    window.addEventListener('ft-edit-armed', h);
    return () => window.removeEventListener('ft-edit-armed', h);
  }, []);
  // entry slide — rAF-driven with a watchdog: if rAF never ticks (throttled/hidden
  // context), the timeout force-lands the final state so the toolbar is never stuck hidden
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const t0 = performance.now(), dur = 420; let raf, done = false;
    const land = () => { if (done) return; done = true; el.style.transform = 'translateX(-50%)'; el.style.opacity = ''; };
    const step = (ts) => {
      if (done) return;
      const u = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      el.style.transform = `translateX(-50%) translateY(${160 * (1 - e)}%)`;
      el.style.opacity = String(Math.min(1, u / 0.4));
      if (u < 1) raf = requestAnimationFrame(step); else land();
    };
    raf = requestAnimationFrame(step);
    const wd = setTimeout(land, dur + 200);
    return () => { cancelAnimationFrame(raf); clearTimeout(wd); land(); };
  }, []);
  React.useEffect(() => (window.FTStore ? window.FTStore.subscribe(() => setNPend(window.FTStore.pendingOps().length)) : undefined), []);
  React.useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [menu]);
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('ft-edit-find', { detail: q.trim() }));
  }, [q]);
  React.useEffect(() => () => window.dispatchEvent(new CustomEvent('ft-edit-find', { detail: '' })), []);
  const pick = (rel) => { setMenu(false); window.dispatchEvent(new CustomEvent('ft-edit-add', { detail: { rel } })); };
  return (
    <div className="edit-toolbar" ref={ref} style={{ transform: 'translateX(-50%) translateY(160%)', opacity: 0 }}>
      <div className="et-menu-wrap">
        <button className={'et-btn primary' + (menu ? ' on' : '')} onClick={() => setMenu((m) => !m)}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
          <span>Add</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
        </button>
        {menu && (
          <div className="et-menu">
            {EDIT_ADD_MODES.map((m) => (
              <button key={m.rel} className="et-mi" onClick={() => pick(m.rel)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={m.ic}></path></svg>
                {m.lbl}
              </button>
            ))}
          </div>
        )}
      </div>
      <input className="et-find" placeholder="Find a person…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="et-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <div className="zoom-pop">
          <button onClick={() => window.dispatchEvent(new CustomEvent('ft-edit-zoom', { detail: 1 }))} title="Zoom in">+</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('ft-edit-zoom', { detail: -1 }))} title="Zoom out">{'\u2212'}</button>
          <button onClick={() => window.dispatchEvent(new CustomEvent('ft-edit-zoom', { detail: 'fit' }))} title="Fit to screen" className="fit">Fit</button>
        </div>
        <button className="et-btn et-zoom-btn" title="Zoom" aria-label="Zoom controls">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.35-4.35"></path></svg>
        </button>
      </div>
      {armed && <span className="et-hint">Click a person to add their {armed === 'person' ? 'relative' : armed}</span>}
      <div className="et-sep"></div>
      {nPend > 0 && <button className="et-chip" onClick={onOpenPublish} title="Review & save your changes">{nPend} change{nPend === 1 ? '' : 's'}</button>}
      <button className="et-done" onClick={onDone}>Done</button>
    </div>
  );
}

Object.assign(window, { EditChip, EditToolbar, EDIT_ADD_MODES });
