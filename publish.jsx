/* publish.jsx — Save chip + Save dialog ("commit with Claude").
   The working copy (photo sidecars + doc sidecar) accumulates ops; this UI
   lists them, offers undo/redo/discard, and copies a compact change-set to
   paste to Claude in the project chat — Claude bakes it into tree-seed.js
   + real photo files for everyone. */

/* Editor mode: ON by default — everyone in the family can edit; the record is
   only shared when changes are baked. Open with ?edit=0 to lock a session into
   viewer mode (persists via localStorage), ?edit=1 to switch back. */
window.FTEditorMode = (function () {
  try {
    const q = new URLSearchParams(location.search).get('edit');
    if (q === '1') localStorage.removeItem('ft-viewer');
    else if (q === '0') localStorage.setItem('ft-viewer', '1');
    return localStorage.getItem('ft-viewer') !== '1';
  } catch (e) { return true; }
})();

window.SaveChip = function SaveChip({ onOpen }) {
  const [, bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => (window.FTStore ? window.FTStore.subscribe(bump) : undefined), []);
  if (!window.FTStore || !window.FTEditorMode) return null;
  const S = window.FTStore;
  const ops = S.doc.ops || [];
  const n = S.pendingOps().length;
  const sent = ops.length - n;
  return (
    <button type="button" className={'pub-chip' + (n > 0 ? ' dirty' : sent > 0 ? ' sent' : '')}
      title={n > 0 ? 'You have unsaved changes — save them to the shared family record'
        : sent > 0 ? 'Copied to your clipboard — paste it to Claude in the project chat to bake it in for everyone'
        : 'This copy matches the shared family record'}
      onClick={onOpen}>
      <span className="dot"></span>
      {n > 0 ? <b>Save · {n}<span className="pub-word"> change{n > 1 ? 's' : ''}</span></b>
        : sent > 0 ? <span className="pub-word">{sent} awaiting paste</span>
        : <span className="pub-word">v{S.doc.baseV || '–'} · in sync</span>}
    </button>
  );
};

window.PublishDialog = function PublishDialog({ onClose, onToast }) {
  const S = window.FTStore;
  const [, bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => S.subscribe(bump), []);
  const [copied, setCopied] = React.useState(false);
  const [copiedOnce, setCopiedOnce] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const taRef = React.useRef(null);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const agoShort = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  const legacyCopy = (txt) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  };
  const doCopy = () => {
    const txt = JSON.stringify(S.changeSet());
    const done = () => { S.markPublished(); setCopyFailed(false); setCopied(true); setCopiedOnce(true); setTimeout(() => setCopied(false), 1600); };
    const fail = () => { setCopyFailed(true); setTimeout(() => { if (taRef.current) { taRef.current.focus(); taRef.current.select(); } }, 50); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, () => { legacyCopy(txt) ? done() : fail(); });
    } else { legacyCopy(txt) ? done() : fail(); }
  };

  const allOps = S.doc.ops || [];
  const pending = S.pendingOps();
  const sentN = allOps.length - pending.length;
  const doUndo = () => { const l = S.undo(); if (l && onToast) onToast(`Undone · ${l}`); };
  const doRedo = () => { const l = S.redo(); if (l && onToast) onToast(`Redone · ${l}`); };

  return (
    <div className="ftp-scrim" onClick={onClose}>
      <div className="ftp-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ftp-x" title="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
        </button>
        <h3 className="ftp-title">{allOps.length === 0 ? 'No unsaved changes' : `${allOps.length} unsaved change${allOps.length > 1 ? 's' : ''}`}</h3>
        {allOps.length === 0 ? (
          <p className="ftp-sub">Your copy matches the shared family record. Add photos, crops, or hide things from the tree — every change lands here so you can commit it for everyone.</p>
        ) : (
          <div className="ftp-list">
            <div className="ftp-bar">
              <span className="ftp-counts">
                {sentN > 0 && <b className="amber">{sentN} awaiting paste</b>}
                {sentN > 0 && pending.length > 0 && ' · '}
                {pending.length > 0 && <b className="blue">{pending.length} not copied yet</b>}
              </span>
              <span className="ftp-undo">
                <button type="button" title="Undo (⌘Z)" onClick={doUndo} disabled={!S.canUndo()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path></svg>
                  Undo
                </button>
                <button type="button" title="Redo (⇧⌘Z)" onClick={doRedo} disabled={!S.canRedo()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"></path><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"></path></svg>
                  Redo
                </button>
              </span>
              <button type="button" className="ftp-trash" title="Discard ALL local changes"
                onClick={() => {
                  if (!confirm(`Throw away all ${allOps.length} change${allOps.length > 1 ? 's' : ''} and revert to the shared record? This cannot be undone.`)) return;
                  S.discardOps(allOps.map((o) => o.ts));
                  onToast && onToast('All local changes discarded');
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
            {[...allOps].reverse().map((o) => (
              <div key={o.ts} className="ftp-item">
                <span className={'ftp-dot ' + (o.pub ? 'sent' : 'new')} title={o.pub ? 'Copied — awaiting paste to Claude' : 'Not copied yet'}></span>
                <span className="ftp-item-main">
                  <span className="ftp-item-label" dir="auto">{o.label}</span>
                  <small>You · {agoShort(o.ts)}{o.pub ? ' · awaiting paste' : ''}</small>
                </span>
                <button type="button" className="ftp-item-x" title="Discard this change — reverts it too"
                  onClick={() => { S.discardOps([o.ts]); onToast && onToast('Change discarded'); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="ftp-save-sec">
          <div className="ftp-save-title">Save to the shared family record</div>
          {allOps.length > 0 && (copyFailed ? (
            <p className="ftp-sub" style={{ color: '#b5462f', marginBottom: 10 }}><b>Couldn’t reach the clipboard.</b> Copy the save file below manually (⌘C / Ctrl+C), then paste it to Claude in the project chat.</p>
          ) : (
            <div className="ftp-steps">
              <div className={'st ' + (copiedOnce ? 'done' : 'cur')}>
                <i>{copiedOnce ? '✓' : '1'}</i>
                <b>Copy changes</b>
                <small>{copiedOnce ? 'on your clipboard' : 'with the button below'}</small>
              </div>
              <svg className="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              <div className={'st ' + (copiedOnce ? 'cur' : '')}>
                <i>2</i>
                <b>Paste to Claude</b>
                <small>in the project chat</small>
              </div>
              <svg className="arr" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              <div className="st">
                <i>3</i>
                <b>Baked for everyone</b>
                <small>arrives on next reload</small>
              </div>
            </div>
          ))}
          {copyFailed && (
            <textarea ref={taRef} readOnly value={JSON.stringify(S.changeSet())}
              onFocus={(e) => e.target.select()} onClick={(e) => e.target.select()}
              className="ftp-ta"></textarea>
          )}
          <div className="ftp-foot">
            {allOps.length > 0 && (
              <button type="button" className="ftp-copy" onClick={doCopy}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                {copied ? 'Copied ✓' : 'Copy changes (for Claude)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
