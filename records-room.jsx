/* records-room.jsx — the behind-the-scenes editor ("Records Room"), editor mode only.
   Field edits go through FTStore.editField (op kind 'edit', shared sidecar, Save pipeline);
   moments reuse FTStore moment APIs; photo visibility reuses setExcluded. */

function rrSlotSrc(id) {
  const S = window.ImageSlotStore;
  const seed = (window.FT_SEED && window.FT_SEED.slots) || {};
  const raw = S && S.raw ? S.raw(id) : undefined;
  if (raw === undefined) return (seed[id] && seed[id].src) || null;
  if (raw && raw.del) return null;
  if (typeof raw === 'string') return raw || null;
  if (raw && raw.u) return raw.u;
  return (seed[id] && seed[id].src) || null; // framing-only entry
}
function rrPersonPhoto(pid) {
  const R = window.REL;
  const evs = R.lifeEvents(pid, 'en');
  for (const e of evs) { const s = rrSlotSrc('ph-' + pid + '-e' + e.ei); if (s) return s; }
  return null;
}
/* adult-first avatar for non-time-scrubbed contexts: prefer a photo aged 20–32
   (closest to ~26), then the next older one, then the oldest younger one —
   rendered through the av- slot so the hand-set avatar framing applies. */
function rrAdultAvatar(pid) {
  const R = window.REL, store = window.ImageSlotStore;
  const p = R.get(pid);
  if (!p || !store) return { idx: -1, u: null };
  const cands = [];
  R.lifeEvents(pid, 'en').forEach((e) => {
    if (e.ei == null || !store.has('ph-' + pid + '-e' + e.ei)) return;
    if (window.FTtree && window.FTtree.isExcluded(pid + '-e' + e.ei)) return; // no authored crop for tree-hidden photos
    const y = e.effYear != null ? e.effYear : e.year;
    if (y == null) return;
    cands.push({ ei: e.ei, age: y - p.birth.year });
  });
  if (!cands.length) return { idx: -1, u: null };
  const sweet = cands.filter((c) => c.age >= 20 && c.age <= 32).sort((a, b) => Math.abs(a.age - 26) - Math.abs(b.age - 26));
  const older = cands.filter((c) => c.age > 32).sort((a, b) => a.age - b.age);
  const younger = cands.filter((c) => c.age < 20).sort((a, b) => b.age - a.age);
  const pick = sweet[0] || older[0] || younger[0];
  return { idx: pick.ei, u: (store.get('ph-' + pid + '-e' + pick.ei) || {}).u };
}
function RrAvatar({ pid, size }) {
  const R = window.REL, p = R.get(pid);
  const av = rrAdultAvatar(pid);
  if (av.idx === -1 || !av.u) return <span className="rr-pav empty" style={{ width: size, height: size }}>{R.fullName(p, 'en').slice(0, 1)}</span>;
  return <image-slot key={'rrav-' + pid} id={`av-${pid}-e${av.idx}`} src={av.u} shape="circle" fit="cover" no-reframe="" placeholder="" style={{ width: size, height: size, flex: '0 0 auto', pointerEvents: 'none' }}></image-slot>;
}
function rrYears(p) {
  return p.death ? `${p.birth.year}–${p.death.year}` : `b. ${p.birth.year}`;
}

function RrFld({ label, value, onCommit, he, area, num, ph, hint, full }) {
  const [v, setV] = React.useState(value == null ? '' : String(value));
  React.useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
  const commit = () => {
    const nv = num ? (String(v).trim() === '' ? null : +v) : v;
    if (String(nv == null ? '' : nv) === String(value == null ? '' : value)) return;
    onCommit(nv);
  };
  const props = { value: v, placeholder: ph || '', onChange: (e) => setV(e.target.value), onBlur: commit,
    onKeyDown: (e) => { if (e.key === 'Enter' && !area) e.target.blur(); } };
  return (
    <div className={'rr-fld' + (he ? ' he-f' : '') + (full ? ' full' : '')}>
      <label>{label}</label>
      {area ? <textarea rows={3} {...props}></textarea> : <input type="text" {...props} />}
      {hint ? <div className="rr-hint">{hint}</div> : null}
    </div>
  );
}

/* ---------- People ---------- */
function RrPeopleList({ pid, setPid }) {
  const R = window.REL;
  const [q, setQ] = React.useState('');
  const all = window.FAMILY.people;
  const match = (p) => !q || R.fullName(p, 'en').toLowerCase().includes(q.toLowerCase());
  const gens = {};
  all.filter(match).forEach((p) => { (gens[p.gen] = gens[p.gen] || []).push(p); });
  return (
    <div className="rr-list">
      <div className="rr-lhead">
        <div className="rr-ltitle"><h2>People</h2><span className="rr-cnt">{all.length} records</span></div>
        <input className="rr-search" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rr-lscroll">
        {Object.keys(gens).sort((a, b) => a - b).map((g) => (
          <div key={g}>
            <div className="rr-gen">Gen {g}{g === '0' ? ' · Founders' : ''}</div>
            {gens[g].map((p) => {
              return (
                <button key={p.id} type="button" className={'rr-prow' + (p.id === pid ? ' sel' : '')} onClick={() => setPid(p.id)}>
                  <RrAvatar pid={p.id} size={34} />
                  <span className="rr-pmeta">
                    <span className="rr-pname">{R.fullName(p, 'en')}</span>
                    <span className="rr-pyears">{rrYears(p)} · {p.birth.place || '—'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- image-prompt composer ---------- */
function rrDecadeLook(y) {
  if (y < 1940) return 'grainy monochrome photograph, 1930s glass-plate feel, soft vignette';
  if (y < 1960) return 'black-and-white silver-print photograph, mid-century, slight grain';
  if (y < 1975) return 'faded early color or warm-toned black-and-white, 1960s–70s snapshot';
  if (y < 1990) return 'warm faded Kodachrome color, 1970s–80s family snapshot';
  if (y < 2008) return 'consumer 35mm color photograph, 1990s–2000s, direct flash feel';
  return 'modern digital family photo, natural light, candid';
}
function rrComposePrompt(p, e) {
  const R = window.REL;
  const name = R.fullName(p, 'en');
  const y = Math.round(e.effYear != null ? e.effYear : (e.year != null ? e.year : p.birth.year));
  const age = Math.max(0, y - p.birth.year);
  const sheet = p.sheet || {};
  const bits = [];
  bits.push(`Vintage family-album photograph, ${y}.`);
  bits.push(`${name}, ${age === 0 ? 'newborn' : age + ' years old'}${p.sex === 'f' ? ', woman' : ', man'}${age > 0 && age < 13 ? ' (child)' : age >= 13 && age < 20 ? ' (teenager)' : ''}.`);
  if (sheet.look) bits.push(sheet.look.trim().replace(/\.?$/, '.'));
  if (sheet.items) bits.push(`Recurring items: ${sheet.items.trim().replace(/\.?$/, '.')}`);
  bits.push(`Scene: ${e.label}.`);
  if (e.post) bits.push(e.post.trim().replace(/\.?$/, '.'));
  const place = e.place || (e.cat === 'birth' ? p.birth.place : e.cat === 'death' && p.death ? p.death.place : null);
  if (place) bits.push(`Location: ${place}.`);
  bits.push(`Style: ${rrDecadeLook(y)}, period-correct clothing and surroundings, candid natural framing, no text or watermarks.`);
  return bits.join(' ');
}
function RrPromptBox({ p, e, onToast }) {
  const [txt, setTxt] = React.useState(() => rrComposePrompt(p, e));
  const hasSheet = p.sheet && p.sheet.look;
  const copy = () => {
    try { navigator.clipboard.writeText(txt); onToast && onToast('Prompt copied — paste it to your image generator'); } catch (err) {}
  };
  return (
    <div className="rr-prompt">
      <textarea value={txt} onChange={(ev) => setTxt(ev.target.value)}></textarea>
      <div className="rr-prompt-foot">
        <span className="rr-prompt-hint">{hasSheet ? 'Composed from the year, story, place and the character sheet — tweak freely, then copy.' : 'Tip: fill in the character sheet above so the face and build stay consistent across generated photos.'}</span>
        <button className="rr-ai" onClick={copy}>Copy prompt</button>
      </div>
    </div>
  );
}

function RrEvent({ p, e, open, onOpen, onToast }) {
  const R = window.REL, S = window.FTStore;
  const pid = p.id, name = R.fullName(p, 'en');
  const mi = (e.derived && e.cat === 'self') ? (p.milestones || []).findIndex((m) => m.en === e.label && m.year === e.year) : -1;
  const slotId = 'ph-' + pid + '-e' + e.ei;
  const src = rrSlotSrc(slotId);
  const exKey = pid + '-e' + e.ei;
  const hidden = S.isExcluded(exKey);
  const editable = mi >= 0 || e.mid;
  const [showPrompt, setShowPrompt] = React.useState(false);
  React.useEffect(() => { if (!open) setShowPrompt(false); }, [open]);
  const mset = (field, label) => (v) => {
    if (e.mid) S.updateMoment(pid, e.mid, { [field === 'en' ? 'title' : field === 'post' ? 'text' : field === 'he' ? 'titleHe' : field === 'postHe' ? 'textHe' : field]: v });
    else S.editField('m:' + pid + ':' + mi + ':' + field, v, name + ' · “' + (e.label || '') + '” ' + label);
    onToast && onToast('Saved · ' + name + ' · ' + label);
  };
  const tierFlip = () => {
    const nt = (e.tier === 'major') ? 'minor' : 'major';
    if (e.mid) S.updateMoment(pid, e.mid, { tier: nt });
    else if (mi >= 0) S.editField('m:' + pid + ':' + mi + ':tier', nt, name + ' · “' + e.label + '” tier → ' + nt);
  };
  const storyFlip = () => {
    const nv = !e.hideStory;
    if (e.mid) S.updateMoment(pid, e.mid, { hideStory: nv });
    else if (mi >= 0) S.editField('m:' + pid + ':' + mi + ':hideStory', nv, name + ' · “' + e.label + '” ' + (nv ? 'hidden from' : 'shown in') + ' life story');
  };
  return (
    <div className="rr-ev">
      <button type="button" className="rr-evhead" onClick={() => onOpen(open ? null : e.key)}>
        <span className={'rr-evyr' + (e.year == null ? ' soft' : '')}>{e.year != null ? e.year : (e.yearLabel || 'undated')}</span>
        {src ? <img className="rr-evth" src={src} alt="" /> : <span className="rr-evth empty"></span>}
        <span className="rr-evt">
          <span className="rr-evtitle">{e.label}{e.mid ? ' · moment' : ''}{!editable ? ' · derived' : ''}</span>
          <span className="rr-evsub">{e.post ? e.post : (editable ? 'No story text yet' : 'From the record structure')}</span>
        </span>
        <span className="rr-evflags">
          {editable && <span className={'rr-chip ' + (e.tier === 'major' ? 'major' : 'minor')} onClick={(ev) => { ev.stopPropagation(); tierFlip(); }}>{e.tier === 'major' ? 'Major' : 'Minor'}</span>}
          {editable && <span className={'rr-eye story' + (e.hideStory ? ' off' : '')} title={e.hideStory ? 'Hidden from the life story — click to show' : 'Shown in the life story — click to hide'}
            onClick={(ev) => { ev.stopPropagation(); storyFlip(); }}>▤</span>}
          {src && <span className={'rr-eye' + (hidden ? ' off' : '')} title={hidden ? 'Hidden from tree — click to show' : 'Shown on tree — click to hide'}
            onClick={(ev) => { ev.stopPropagation(); S.setExcluded(exKey, !hidden); }}>{hidden ? '⊘' : '◉'}</span>}
        </span>
      </button>
      {open && (
        <div className="rr-evbody">
          {editable ? (
            <React.Fragment>
              <div className="rr-grid">
                <RrFld label="Title" value={e.label} onCommit={mset('en', 'title edited')} />
                <RrFld he label="Title · עברית" value={e.heLabel || ''} onCommit={mset('he', 'title (HE) edited')} ph="כותרת בעברית" />
                <RrFld label="Year" num value={e.year} onCommit={mset('year', 'year edited')}
                  hint={e.mid && e.year == null ? 'Undated — placed ' + (e.yearLabel || 'by order') : 'Changing the year re-orders events; photos follow their event'} />
                <div></div>
                <RrFld area label="Story" value={e.post || ''} onCommit={mset('post', 'story edited')} />
                <RrFld area he label="Story · עברית" value={e.hePost || ''} onCommit={mset('postHe', 'story (HE) edited')} ph="הסיפור בעברית — מוצג כשהממשק בעברית" />
              </div>
              <div className="rr-evfoot">
                <button className="rr-ai" onClick={() => setShowPrompt((s) => !s)}>✦ Image prompt</button>
                {e.mid && <button className="rr-del" onClick={() => { S.removeMoment(pid, e.mid); onOpen(null); }}>Delete moment</button>}
                <span className="rr-lock">Photo &amp; crop are edited on the tree and focus view — this panel owns the words.</span>
              </div>
              {showPrompt && <RrPromptBox p={p} e={e} onToast={onToast} />}
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="rr-evfoot">
                <button className="rr-ai" onClick={() => setShowPrompt((s) => !s)}>✦ Image prompt</button>
                <span className="rr-lock">Derived from the record — {e.cat === 'birth' || e.cat === 'death' ? 'edit under Identity above.' : 'edit the marriage / relationship below.'}</span>
              </div>
              {showPrompt && <RrPromptBox p={p} e={e} onToast={onToast} />}
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}

function RrPerson({ pid, onToast, onJump }) {
  const R = window.REL, S = window.FTStore;
  const p = R.get(pid) || window.FAMILY.people[0];
  if (!p) return null;
  pid = p.id; // normalize — an unknown pid falls back to the first person
  const name = R.fullName(p, 'en');
  const [openEv, setOpenEv] = React.useState(null);
  const ef = (path, label) => (v) => { if (S.editField('p:' + p.id + ':' + path, v, name + ' · ' + label)) onToast && onToast('Saved · ' + name + ' · ' + label); };
  const uf = (uid, field, spName) => (v) => { if (S.editField('u:' + uid + ':' + field, v, name + ' & ' + spName + ' · ' + field + ' edited')) onToast && onToast('Saved · marriage ' + field); };
  const evs = R.lifeEvents(pid, 'en');
  const photoCount = evs.filter((e) => rrSlotSrc('ph-' + pid + '-e' + e.ei)).length;
  return (
    <div className="rr-detail">
      <div className="rr-inner">
        <div className="rr-dhead">
          <RrAvatar pid={pid} size={64} />
          <div className="rr-dname">
            <h1>{name}</h1>
            <div className="rr-dsub"><span dir="rtl">{p.name.he}</span> · <span dir="ltr">{rrYears(p)}</span></div>
          </div>
          <button className="rr-btn" onClick={() => onJump(pid)}>Open on tree ↗</button>
        </div>
        <div className="rr-h3row"><h3>Identity</h3></div>
        <div className="rr-card">
          <div className="rr-grid">
            <RrFld label="Name (English)" value={p.name.en} onCommit={ef('name.en', 'name (EN) edited')} />
            <RrFld he label="Name (Hebrew)" value={p.name.he} onCommit={ef('name.he', 'name (HE) edited')} />
            <RrFld label="Born · year" num value={p.birth.year} onCommit={ef('birth.year', 'birth year edited')} />
            <RrFld label="Born · place" value={p.birth.place} onCommit={ef('birth.place', 'birth place edited')} />
            <RrFld label="Died · year" num value={p.death ? p.death.year : null} onCommit={ef('death.year', 'death year edited')} ph="— living" hint="Clear to mark as living" />
            <RrFld label="Died · place" value={p.death ? p.death.place : ''} onCommit={ef('death.place', 'death place edited')} ph={p.death ? '' : 'set a death year first'} />
            <RrFld area label="Bio" value={p.bio ? p.bio.en : ''} onCommit={ef('bio.en', 'bio edited')} />
            <RrFld area he label="Bio · עברית" value={p.bio ? (p.bio.he || '') : ''} onCommit={ef('bio.he', 'bio (HE) edited')} ph="ביוגרפיה בעברית — מוצגת כשהממשק בעברית" />
          </div>
          {p.nameChange && <div className="rr-note">Name history: {p.nameChange.from} → {p.nameChange.to} ({p.nameChange.year}, {p.nameChange.kind}). Editing name changes isn’t wired yet — ask Claude in the chat.</div>}
        </div>
        <div className="rr-h3row"><h3>Character sheet</h3><span className="rr-cnt">feeds every ✦ image prompt for {name.split(' ')[0]}</span></div>
        <div className="rr-card">
          <div className="rr-grid">
            <RrFld full area label="Appearance" value={p.sheet ? p.sheet.look : ''} onCommit={ef('sheet.look', 'character sheet · appearance')}
              ph="e.g. slight build, deep-set grey eyes; full dark beard as a young man, white and trimmed from the 1960s; wire-rimmed glasses after 1950"
              hint="Describe what stays true across their whole life — age-specific details can note the years." />
            <RrFld full label="Recurring items" value={p.sheet ? p.sheet.items : ''} onCommit={ef('sheet.items', 'character sheet · items')}
              ph="e.g. the brass pocket-watch · dark waistcoat, sleeves rolled" />
          </div>
        </div>
        <div className="rr-h3row"><h3>Relationships</h3></div>
        <div className="rr-card">
          {p.parents.length > 0 && (
            <div className="rr-row">
              <span className="rr-chip blood">Parents</span>
              <span className="rr-who"><span className="rr-wname">{p.parents.map((x) => R.fullName(R.get(x), 'en')).join(' & ')}</span>
                <span className="rr-wkind">From the tree structure</span></span>
              {p.parents.map((x) => <button key={x} className="rr-link" onClick={() => onJump(x, true)}>Open {R.fullName(R.get(x), 'en').split(' ')[0]} →</button>)}
            </div>
          )}
          {R.unionsOf(pid).map((u) => {
            const sp = R.get(R.partnerInUnion(u, pid));
            const spName = R.fullName(sp, 'en');
            return (
              <div className="rr-row" key={u.id}>
                <span className="rr-chip union">{u.type === 'marriage' ? 'Marriage' : 'Partnership'}</span>
                <span className="rr-who"><span className="rr-wname">{spName}</span>
                  <span className="rr-wkind">{u.endYear ? `ended ${u.endYear}${u.endReason === 'death' ? ' (death)' : ''}` : 'ongoing'} · shared — also on {spName.split(' ')[0]}’s record</span></span>
                <RrYr label="from" value={u.year} onCommit={uf(u.id, 'year', spName)} />
                <RrYr label="to" value={u.endYear || null} onCommit={uf(u.id, 'endYear', spName)} />
                <button className="rr-link" onClick={() => onJump(sp.id, true)}>Open →</button>
              </div>
            );
          })}
          {R.sideLinksOf(pid).map((s, i) => {
            const other = R.get(s.from === pid ? s.to : s.from);
            return (
              <div className="rr-row" key={i}>
                <span className="rr-chip side">Side link</span>
                <span className="rr-who"><span className="rr-wname">{R.fullName(other, 'en')}</span>
                  <span className="rr-wkind">“{s.kind}”{s.detail ? ' — ' + s.detail : ''}</span></span>
                <button className="rr-link" onClick={() => onJump(other.id, true)}>Open →</button>
              </div>
            );
          })}
          <div className="rr-note">Links live once and appear on both people. Adding or removing links isn’t wired yet — paste a request in the chat and Claude bakes it.</div>
        </div>
        <div className="rr-h3row"><h3>Life events</h3><span className="rr-cnt">{evs.length} events · {photoCount} photos</span><span className="sp"></span>
          <button className="rr-addev" onClick={() => {
            const dated = evs.filter((x) => x.year != null);
            const last = dated[dated.length - 1];
            const mid = S.addMoment(pid, { title: '', bucket: last ? last.key : 'start' });
            setOpenEv('m' + mid);
            onToast && onToast('Moment added — give it a title and a year');
          }}>＋ Add moment</button>
        </div>
        <div className="rr-card">
          {evs.map((e) => <RrEvent key={e.key} p={p} e={e} open={openEv === e.key} onOpen={setOpenEv} onToast={onToast} />)}
        </div>
      </div>
    </div>
  );
}
function RrYr({ label, value, onCommit }) {
  const [v, setV] = React.useState(value == null ? '' : String(value));
  React.useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
  const commit = () => { const nv = String(v).trim() === '' ? null : +v; if (nv !== (value == null ? null : value)) onCommit(nv); };
  return <input className="rr-yr-in" placeholder={label} value={v} title={label + ' year'} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />;
}

/* ---------- World events ---------- */
function RrWorld({ onToast }) {
  const S = window.FTStore;
  const [f, setF] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);
  const all = window.WORLD_EVENTS_ALL || [];
  const TYPES = { serious: 'Headlines', joyful: 'Milestones', pop: 'Culture' };
  const rows = all.filter((e) => f === 'all' || (f === 'off' ? !S.worldOn(e) : e.type === f));
  const onCount = all.filter((e) => S.worldOn(e)).length;
  const wf = (e, field, label) => (v) => { if (S.editField('w:' + e.id + ':' + field, v, (e.short || e.title) + ' · ' + label)) onToast && onToast('Saved · ' + (e.short || e.title) + ' · ' + label); };
  return (
    <div className="rr-detail">
      <div className="rr-wide">
        <div className="rr-h3row" style={{ marginTop: 4 }}><h3 style={{ fontSize: 13 }}>World events</h3><span className="rr-cnt">{onCount} on the band · {all.length - onCount} off</span></div>
        <div className="rr-filter">
          <button className={'rr-fchip' + (f === 'all' ? ' on' : '')} onClick={() => setF('all')}>All · {all.length}</button>
          {Object.keys(TYPES).map((t) => <button key={t} className={'rr-fchip' + (f === t ? ' on' : '')} onClick={() => setF(t)}>{TYPES[t]} · {all.filter((e) => e.type === t).length}</button>)}
          <button className={'rr-fchip' + (f === 'off' ? ' on' : '')} onClick={() => setF('off')}>Turned off · {all.length - onCount}</button>
        </div>
        <div className="rr-card">
          <table className="rr-tbl">
            <thead><tr><th style={{ width: 56 }}>Year</th><th style={{ width: 62 }}>Photo</th><th>Event</th><th style={{ width: 110 }}>Category</th><th style={{ width: 90 }}>Weight</th><th style={{ width: 76 }}>On band</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const on = S.worldOn(e);
                const open = openId === e.id;
                return (
                  <React.Fragment key={e.id}>
                  <tr className={(on ? '' : 'dim') + (open ? ' rr-wopen' : '')} style={{ cursor: 'pointer' }} onClick={() => setOpenId(open ? null : e.id)}>
                    <td style={{ whiteSpace: 'nowrap' }}><b>{e.year}</b>{e.span ? <span style={{ color: 'var(--ink-3)' }}>–{e.span[1]}</span> : null}</td>
                    <td>{e.img ? <img className="rr-wth" src={e.img} alt="" /> : <span className="rr-wth" style={{ display: 'inline-block' }}></span>}</td>
                    <td><div style={{ font: '600 13px/1.3 var(--font-ui)' }}>{e.title}</div><div style={{ font: '400 11.5px/1.35 var(--font-body)', color: 'var(--ink-3)' }}>{e.desc || e.long || ''}</div></td>
                    <td><span className={'rr-chip cat-' + e.type}>{TYPES[e.type] || e.type}</span></td>
                    <td style={{ color: 'var(--ink-3)', fontSize: 12 }}>{e.minor ? 'Minor' : 'Landmark'}</td>
                    <td onClick={(ev) => ev.stopPropagation()}><button className={'rr-tg' + (on ? ' on' : '')} title={on ? 'Shown on the band' : 'Hidden'} onClick={() => { S.setWorldOn(e, !on); onToast && onToast((e.short || e.title) + (on ? ' · off' : ' · on')); }}></button></td>
                  </tr>
                  {open && (
                    <tr className="rr-wedit"><td colSpan={6}>
                      <div className="rr-grid" style={{ padding: '4px 2px 10px' }}>
                        <RrFld label="Title" value={e.title} onCommit={wf(e, 'title', 'title edited')} />
                        <RrFld he label="Title · עברית" value={e.titleHe || ''} onCommit={wf(e, 'titleHe', 'title (HE) edited')} ph="כותרת בעברית" />
                        <RrFld label="Short label" value={e.short} onCommit={wf(e, 'short', 'short label edited')} hint="Shown on the band when the playhead is near" />
                        <RrFld he label="Short · עברית" value={e.shortHe || ''} onCommit={wf(e, 'shortHe', 'short (HE) edited')} />
                        <RrFld area label="One-liner (whisper tip)" value={e.desc || ''} onCommit={wf(e, 'desc', 'one-liner edited')} />
                        <RrFld area he label="One-liner · עברית" value={e.descHe || ''} onCommit={wf(e, 'descHe', 'one-liner (HE) edited')} />
                        <RrFld area label="Long story (side panel)" value={e.long || ''} onCommit={wf(e, 'long', 'long story edited')} />
                        <RrFld area he label="Long story · עברית" value={e.longHe || ''} onCommit={wf(e, 'longHe', 'long story (HE) edited')} />
                      </div>
                    </td></tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="rr-note">Click a row to edit its texts (EN + עברית). On/off and every text edit ride the Save pipeline. Adding new world events or family events on the band: ask Claude in the chat.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Places ---------- */
function RrPlaces() {
  const R = window.REL, S = window.FTStore;
  const map = {};
  const addP = (place, pid, what) => { if (!place) return; const m = (map[place] = map[place] || { n: 0, who: new Set(), what: {} }); m.n++; m.who.add(pid); m.what[what] = (m.what[what] || 0) + 1; };
  window.FAMILY.people.forEach((p) => { addP(p.birth && p.birth.place, p.id, 'births'); addP(p.death && p.death.place, p.id, 'deaths'); });
  Object.keys(S.doc.moments || {}).forEach((pid) => (S.doc.moments[pid] || []).forEach((m) => addP(m.place, pid, 'moments')));
  const rows = Object.keys(map).sort((a, b) => map[b].n - map[a].n);
  return (
    <div className="rr-detail">
      <div className="rr-wide">
        <div className="rr-h3row" style={{ marginTop: 4 }}><h3 style={{ fontSize: 13 }}>Places</h3><span className="rr-cnt">{rows.length} places across {rows.reduce((s, k) => s + map[k].n, 0)} mentions</span></div>
        <div className="rr-card">
          <table className="rr-tbl">
            <thead><tr><th>Place</th><th style={{ width: 90 }}>Mentions</th><th>Used by</th></tr></thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k}>
                  <td><div style={{ font: '600 13px/1.3 var(--font-ui)' }}>{k}</div><div style={{ font: '400 11.5px/1.35 var(--font-body)', color: 'var(--ink-3)' }}>{Object.keys(map[k].what).map((w) => `${w} ×${map[k].what[w]}`).join(' · ')}</div></td>
                  <td>{map[k].n}</td>
                  <td style={{ color: 'var(--ink-2)', fontSize: 12 }}>{[...map[k].who].slice(0, 4).map((id) => R.fullName(R.get(id), 'en').split(' ')[0]).join(', ')}{map[k].who.size > 4 ? ` +${map[k].who.size - 4}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rr-note">Places are free-text on each record today — fix typos on the person; merging duplicates in bulk: ask Claude in the chat.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Photos ---------- */
function RrPhotos({ onJumpPerson }) {
  const R = window.REL, S = window.FTStore, IS = window.ImageSlotStore;
  const [f, setF] = React.useState('all');
  const ids = new Set(Object.keys((window.FT_SEED && window.FT_SEED.slots) || {}));
  (IS && IS.ids ? IS.ids() : []).forEach((id) => ids.add(id));
  const items = [];
  ids.forEach((id) => {
    const m = /^ph-(.+)-e(\d+)$/.exec(id);
    if (!m) return;
    const src = rrSlotSrc(id);
    if (!src) return;
    const p = R.byId[m[1]]; if (!p) return;
    const ev = R.lifeEvents(m[1], 'en').find((x) => x.ei === +m[2]);
    const pending = IS && IS.raw && IS.raw(id) !== undefined;
    const hidden = S.isExcluded(m[1] + '-e' + m[2]);
    items.push({ id, pid: m[1], src, pending, hidden, orphan: !ev, who: R.fullName(p, 'en'), what: ev ? `${ev.year != null ? ev.year : ev.yearLabel || 'undated'} · ${ev.label}` : 'event no longer exists' });
  });
  items.sort((a, b) => a.who.localeCompare(b.who));
  const flt = { all: () => true, pending: (i) => i.pending, hidden: (i) => i.hidden, orphan: (i) => i.orphan };
  const shown = items.filter(flt[f]);
  return (
    <div className="rr-detail">
      <div className="rr-wide">
        <div className="rr-h3row" style={{ marginTop: 4 }}><h3 style={{ fontSize: 13 }}>Photos</h3><span className="rr-cnt">{items.length} filled slots</span></div>
        <div className="rr-filter">
          {[['all', 'All'], ['pending', 'Pending save'], ['hidden', 'Hidden from tree'], ['orphan', 'Orphaned']].map(([k, lab]) => (
            <button key={k} className={'rr-fchip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{lab} · {items.filter(flt[k]).length}</button>
          ))}
        </div>
        <div className="rr-pgrid">
          {shown.map((i) => (
            <div className="rr-ptile" key={i.id} style={i.orphan ? { outline: '2px solid rgba(181,70,47,.45)' } : null}>
              <img src={i.src} alt="" loading="lazy" />
              <div className="rr-pcap">
                <div className="rr-pwho">{i.who}</div>
                <div className="rr-pwhat">{i.what}</div>
                <div className="rr-pchips">
                  <span className={'rr-chip ' + (i.pending ? 'pending' : 'ok')}>{i.pending ? 'Pending save' : 'Baked · v' + (window.FT_SEED ? window.FT_SEED.baseV : '?')}</span>
                  {i.hidden && <span className="rr-chip hidden">Hidden</span>}
                  {i.orphan && <span className="rr-chip hidden">Orphaned</span>}
                </div>
                <div style={{ marginTop: 7 }}><button className="rr-link" onClick={() => onJumpPerson(i.pid)}>Open record →</button></div>
              </div>
            </div>
          ))}
          {!shown.length && <div className="rr-lock" style={{ padding: 8 }}>Nothing here.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
Object.assign(window, { rrSlotSrc, rrAdultAvatar, RrAvatar });
window.RecordsRoom = function RecordsRoom({ onClose, onToast, onJump, onOpenPublish, screen: initScreen }) {
  const S = window.FTStore;
  const norm = (s) => (s === 'health' ? 'desk' : s);
  const [, bump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => S.subscribe(bump), []);
  const [screen, setScreen] = React.useState(norm(initScreen) || 'desk');
  React.useEffect(() => { if (initScreen) setScreen(norm(initScreen)); }, [initScreen]);
  const [pid, setPid] = React.useState(window.FAMILY.people[0].id);
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const jumpPerson = (id) => { setPid(id); setScreen('people'); };
  const jumpOut = (id, stay) => { if (stay) { jumpPerson(id); } else { onClose(); onJump(id); } };
  const n = S.pendingOps().length;
  const NAV = [['people', 'People', window.FAMILY.people.length], ['world', 'World events', (window.WORLD_EVENTS_ALL || []).length], ['places', 'Places', null], ['photos', 'Photos', null]];
  return (
    <div className="rrm" data-screen-label="Records Room">
      <nav className="rr-rail">
        <div className="rr-brand">Records Room</div>
        <div className="rr-railsub">Behind the scenes of the family record</div>
        <button type="button" className={'rr-item' + (screen === 'desk' ? ' on' : '')} onClick={() => setScreen('desk')}>The desk</button>
        <div className="rr-sec">Entities</div>
        {NAV.slice(0, 4).map(([k, lab, cnt]) => (
          <button key={k} type="button" className={'rr-item' + (screen === k ? ' on' : '')} onClick={() => setScreen(k)}>{lab}{cnt != null && <span className="n">{cnt}</span>}</button>
        ))}
        <div className="rr-foot">
          <div className={'rr-sync' + (n ? ' dirty' : '')}><span className="dot"></span>{n ? n + ' unsaved change' + (n > 1 ? 's' : '') : 'v' + (S.doc.baseV || '–') + ' · in sync'}</div>
          <button type="button" className="rr-back" onClick={onClose}>← Back to the tree</button>
        </div>
      </nav>
      <div className="rr-body">
        {screen === 'desk' && window.RrDesk && <window.RrDesk jumpPerson={jumpPerson} setScreen={setScreen} onOpenPublish={onOpenPublish} onClose={onClose} />}
        {screen === 'people' && <RrPeopleList pid={pid} setPid={setPid} />}
        {screen === 'people' && <RrPerson pid={pid} onToast={onToast} onJump={(id, stay) => jumpOut(id, stay)} />}
        {screen === 'world' && <RrWorld onToast={onToast} />}
        {screen === 'places' && <RrPlaces />}
        {screen === 'photos' && <RrPhotos onJumpPerson={jumpPerson} />}
      </div>
    </div>
  );
};
