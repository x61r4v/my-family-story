/* app.jsx — shell: top bar, timeline scrubber, selection drawer, tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "nodeStyle": "photo",
  "canvasTexture": "dots",
  "heritage": "#B07D2B",
  "branchHighlight": true
}/*EDITMODE-END*/;

const HERITAGE_OPTS = ["#B07D2B", "#2F6E54", "#9A5B3F", "#566A8C"];

function SettingsMenu({ lang, setLang, nameMode, setNameMode, showSide, setShowSide, familyFocus, setFamilyFocus, lifeEffects, setLifeEffects }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h, true);
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', h, true); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div className="settings-wrap" ref={ref}>
      <button className={'gear-btn bare'+(open?' on':'')} onClick={()=>setOpen(o=>!o)} title="הגדרות תצוגה" aria-label="הגדרות תצוגה">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 21v-7"></path><path d="M4 10V3"></path><path d="M12 21v-9"></path><path d="M12 8V3"></path><path d="M20 21v-5"></path><path d="M20 12V3"></path><path d="M1.5 14h5"></path><path d="M9.5 8h5"></path><path d="M17.5 16h5"></path></svg>
      </button>
      {open && (
        <div className="settings-pop">
          <div className="sp-sec">שפה</div>
          <div className="sp-stack">
            <div className="seg wide">
              <button className={lang==='en'?'on':''} onClick={()=>setLang('en')}>EN</button>
              <button className={'he'+(lang==='he'?' on':'')} onClick={()=>setLang('he')}>עברית</button>
            </div>
          </div>
          <div className="sp-div" />
          <div className="sp-sec">עץ</div>
          <button className="sp-row" onClick={()=>setShowSide(s=>!s)}>
            <span className="sp-dot plum" /><span className="sp-lbl">קשרים נוספים</span><span className={'sp-tg plum'+(showSide?' on':'')} />
          </button>
          <button className="sp-row" onClick={()=>setFamilyFocus(f=>!f)} title="Also keep each spouse's family in focus when a person is selected">
            <span className="sp-dot amber" /><span className="sp-lbl">מיקוד משפחתי</span><span className={'sp-tg amber'+(familyFocus?' on':'')} />
          </button>
          <div className="sp-div" />
          <div className="sp-sec">שמות</div>
          <div className="sp-stack">
            <div className="sp-stack-lbl">תצוגת שמות</div>
            <div className="seg wide">
              <button className={nameMode==='time'?'on':''} onClick={()=>setNameMode('time')} title="The surname as it was in the year you're scrubbing — changes with the story">לפי השנה</button>
              <button className={nameMode==='current'?'on':''} onClick={()=>setNameMode('current')} title="The surname each person goes by now, after any change">נוכחי</button>
              <button className={nameMode==='birth'?'on':''} onClick={()=>setNameMode('birth')} title="The surname each person was born with (maiden / pre-change)">בלידה</button>
            </div>
          </div>
          <div className="sp-div" />
          <div className="sp-sec">אירועי חיים</div>
          <div className="sp-stack">
            <div className="sp-stack-lbl">אפקטים</div>
            <div className="seg wide fx">
              <button className={lifeEffects==='off'?'on':''} onClick={()=>setLifeEffects('off')}>כבוי</button>
              <button className={lifeEffects==='mild'?'on':''} onClick={()=>setLifeEffects('mild')}>מתון</button>
              <button className={lifeEffects==='hurray'?'on':''} onClick={()=>setLifeEffects('hurray')}>חגיגי</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordsMenu({ onPick }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!window.FTEditorMode) return null;
  const P = window.FAMILY ? window.FAMILY.people.length : 0;
  const W = window.WORLD_EVENTS ? window.WORLD_EVENTS.length : 0;
  const ic = {
    desk: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect></svg>,
    people: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16.5 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    world: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a13.5 13.5 0 0 1 0 18a13.5 13.5 0 0 1 0-18z"></path></svg>,
    places: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
    photos: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"></rect><circle cx="9" cy="9" r="2"></circle><path d="M21 15l-4.35-4.35a1.5 1.5 0 0 0-2.12 0L5 20"></path></svg>,
    health: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 8-6-16-3 8H2"></path></svg>,
  };
  const items = [
    ['desk', 'The desk', 'health, coverage & what to do next', null],
    ['people', 'People', 'names, events, relationships', P],
    ['world', 'World events', 'the history band', W],
    ['places', 'Places', 'registry & duplicates', null],
    ['photos', 'Photos', 'slots, crops, pending', null],
  ];
  return (
    <div className="settings-wrap" ref={ref}>
      <button className={'gear-btn bare' + (open ? ' on' : '')} onClick={() => setOpen((o) => !o)} title="Records Room — edit the family record" aria-label="Records Room">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>
      {open && (
        <div className="settings-pop" style={{ width: 248, padding: '6px' }}>
          <div className="sp-sec" style={{ padding: '10px 10px 6px' }}>Records Room</div>
          {items.map(([k, lab, sub, n]) => (
            <button key={k} className="rm-row" onClick={() => { setOpen(false); onPick(k); }}>
              <span className="rm-ic">{ic[k]}</span>
              <span><span className="rm-lbl">{lab}</span><div className="rm-sub">{sub}</div></span>
              {n != null && <span className="rm-count">{n}</span>}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--line, rgba(0,0,0,.07))', margin: '6px 4px' }}></div>
          <button className="rm-row" onClick={() => { setOpen(false); window.open('README Preview.html', '_blank'); }}>
            <span className="rm-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></span>
            <span><span className="rm-lbl">Read the guide</span><div className="rm-sub">README · English / עברית</div></span>
          </button>
          <a className="rm-row" href="https://github.com/aviranrevach" target="_blank" rel="noopener" style={{ textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <span className="rm-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.91c.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.66.41.36.78 1.06.78 2.14v3.17c0 .3.2.67.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"></path></svg></span>
            <span><span className="rm-lbl">Baked with ♥ by Aviran Revach</span><div className="rm-sub">github.com/aviranrevach</div></span>
          </a>
        </div>
      )}
    </div>
  );
}

function TopBar({ lang, setLang, nameMode, setNameMode, showSide, setShowSide, familyFocus, setFamilyFocus, lifeEffects, setLifeEffects, year, onOpenPublish, onOpenRecords, editing, onToggleEdit }) {
  return (
    <div className="topbar">
      <div className="brand" onClick={() => window.open('README Preview.html', '_blank')} style={{ cursor: 'pointer' }} title="Open the guide (README)">
        <img className="brand-logo" src="assets/logo-myfamily.svg" alt="My Family Story" draggable="false" />
        <span className="app-title">שלשלת חב"ד</span>
        <span className="app-sub">My Family Story · תק״ה–תשנ״ד</span>
      </div>
      <div className="top-spacer" />
      <div className="top-controls">
        <SaveChip onOpen={onOpenPublish} />
        <a className="pub-chip" href="CHABAD-SOURCES.md" target="_blank">מקורות</a>
        <SettingsMenu lang={lang} setLang={setLang} nameMode={nameMode} setNameMode={setNameMode} showSide={showSide} setShowSide={setShowSide}
          familyFocus={familyFocus} setFamilyFocus={setFamilyFocus} lifeEffects={lifeEffects} setLifeEffects={setLifeEffects} />
        
      </div>
    </div>
  );
}

// generation chapters for the default (no-person) scrubber state
function genChapters(R, min, max) {
  const firstBirth = {};
  R.F.people.forEach(p => {
    const g = p.gen ?? 0, y = p.birth.year; if(y==null)return;
    if (firstBirth[g] == null || y < firstBirth[g]) firstBirth[g] = y;
  });
  const gens = Object.keys(firstBirth).map(Number).sort((a, b) => a - b);
  const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'];
  const out = [];
  gens.forEach((g, i) => {
    const s = i === 0 ? min : Math.max(min, firstBirth[g]);
    const e = i === gens.length - 1 ? max : Math.min(max, firstBirth[gens[i + 1]]);
    if (e > s) out.push({ s, e,
      lab: 'דור ' + (g+1),
      short: 'דור '+(g+1) });
  });
  return out;
}

function Scrubber({ year, setYear, playing, setPlaying, min, max, events, personId, openEvId }) {
  const R = window.REL;
  // rAF-smoothed display year: the playhead glides toward `year` (sub-year precision),
  // so play reads as continuous motion and scrubbing trails the cursor slightly.
  const [disp, setDisp] = React.useState(year);
  const dispRef = React.useRef(year);
  const yearRef = React.useRef(year);
  yearRef.current = year;
  const playingRef = React.useRef(playing);
  playingRef.current = playing;
  React.useEffect(() => {
    let raf;
    const step = () => {
      const d = dispRef.current, t = yearRef.current;
      if (d !== t) {
        const diff = t - d;
        let nd;
        if (playingRef.current) {
          // while playing the target ticks +1yr at a fixed rate — pure proportional
          // easing converges to constant velocity, so motion reads as continuous
          nd = d + diff * 0.12;
        } else {
          // scrubbing: proportional ease with a minimum speed — pure proportional
          // easing stalls near the target after a direction change (feels "stuck")
          const mag = Math.min(Math.abs(diff), Math.max(Math.abs(diff) * 0.18, 0.45));
          nd = Math.abs(diff) < 0.02 ? t : d + Math.sign(diff) * mag;
        }
        dispRef.current = nd; setDisp(nd);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pct = ((disp - min) / (max - min)) * 100;
  const X = (y) => ((y - min) / (max - min)) * 100;
  const segs = null;
  const person = personId ? R.get(personId) : null;
  const chapters = React.useMemo(() => genChapters(R, min, max), [min, max]);
  // track pixel width — used to shorten/hide chapter labels that would collide
  const trackRef = React.useRef(null);
  const [trackW, setTrackW] = React.useState(0);
  React.useEffect(() => {
    const m = () => { if (trackRef.current) setTrackW(trackRef.current.offsetWidth); };
    m(); window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);
  // intro invite (I + J blend): the app opens a third of the way in, the playhead
  // drags itself back to the beginning, then a blue tooltip invites scrubbing.
  // Any pointer interaction cancels/dismisses it.
  const [introTip, setIntroTip] = React.useState(false); // false | true | 'out'
  React.useEffect(() => {
    // once per page load — the Scrubber remounts when returning from the focus
    // view, and the intro rewind must NOT replay then
    if (window.CHABAD || window.__ftIntroDone) return;
    window.__ftIntroDone = true;
    const st = { done:false, raf:0, timer:0, fade:0 };
    const HOT = 'button, input, a, .scrubber, .node, .toggle-chip, .seg, .gear-btn, .drawer, .settings-pop';
    const fadeOut = () => {
      if (st.done) return; st.done = true;
      clearTimeout(st.timer); cancelAnimationFrame(st.raf);
      window.removeEventListener('pointerdown', fadeOut, true);
      window.removeEventListener('pointerover', onOver, true);
      setIntroTip(v => v ? 'out' : false);
      st.fade = setTimeout(() => setIntroTip(false), 300);
    };
    const onOver = (e) => { if (e.target.closest && e.target.closest(HOT)) fadeOut(); };
    window.addEventListener('pointerdown', fadeOut, true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    st.timer = setTimeout(() => {
      if (st.done) return;
      if (reduce) { setYear(min); setIntroTip(true); window.addEventListener('pointerover', onOver, true); return; }
      const from = yearRef.current, dur = 1800, t0 = performance.now();
      const step = (ts) => {
        if (st.done) return;
        const u = Math.min(1, (ts - t0) / dur);
        const e = .5 - .5 * Math.cos(u * Math.PI);
        setYear(Math.round(from + (min - from) * e));
        if (u < 1) st.raf = requestAnimationFrame(step);
        else { setIntroTip(true); window.addEventListener('pointerover', onOver, true); }
      };
      st.raf = requestAnimationFrame(step);
    }, 900);
    return () => {
      clearTimeout(st.timer); clearTimeout(st.fade); cancelAnimationFrame(st.raf);
      window.removeEventListener('pointerdown', fadeOut, true);
      window.removeEventListener('pointerover', onOver, true);
    };
  }, []);
  // drag the playhead tab / year chip (they poke outside the bar, beyond the range input)
  const dragFrom = (e) => {
    const trk = trackRef.current; if (!trk) return;
    e.preventDefault(); e.stopPropagation();
    const tgt = e.currentTarget;
    const move = (ev) => {
      const r = trk.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      setYear(Math.round(min + p * (max - min)));
    };
    setPlaying(false);
    tgt.setPointerCapture(e.pointerId);
    move(e);
    const up = () => {
      tgt.removeEventListener('pointermove', move);
      tgt.removeEventListener('pointerup', up);
      tgt.removeEventListener('pointercancel', up);
    };
    tgt.addEventListener('pointermove', move);
    tgt.addEventListener('pointerup', up);
    tgt.addEventListener('pointercancel', up);
  };
  const mixOf = (c) => `color-mix(in srgb, ${c} 60%, var(--line-2))`;
  const stageOfYear = (y) => segs && segs.find(s => y >= s.startYear && y < s.endYear);
  const dotColor = (y) => {
    if (y <= disp) return 'var(--amber)';
    const st = stageOfYear(y);
    return st ? mixOf(st.color) : 'var(--line-2)';
  };
  const birthY = person ? person.birth.year : 0;
  const endY = person ? (person.death ? person.death.year : max) : 0;
  const ticks = [];
  for (let y = Math.ceil(min / 10) * 10; y <= max; y += 10) ticks.push(y);
  return (
    <div className="scrubber">
      <button className="play-btn" onClick={()=>setPlaying(p=>!p)} title={playing?'השהיה':'ניגון השנים'}>
        {playing
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"></path></svg>}
      </button>
      <div className="scrub-year">
        <span className="sy-num">{window.heYear(year)}</span>
        <span className="sy-lab">שנה עברית</span>
      </div>
      <div className="scrub-track" ref={trackRef}>
        {window.WorldHorizon && <WorldHorizon disp={disp} min={min} max={max} trackW={trackW} personId={personId} openId={openEvId}></WorldHorizon>}
        {/* default state: generation chapters */}
        {!segs && chapters.map((c,i)=>{
          const px = trackW ? ((X(c.e)-X(c.s))/100)*trackW : 9999;
          const lab = px >= 150 ? c.lab : (px >= 58 ? c.short : null);
          return (
            <React.Fragment key={i}>
              <span className={'ch-block '+(i%2?'t2':'t1')} style={{ left:`${X(c.s)}%`, width:`${X(c.e)-X(c.s)}%` }}></span>
              {lab && <span className="ch-lab" style={{ left:`${(X(c.s)+X(c.e))/2}%` }}>{lab}</span>}
            </React.Fragment>
          );
        })}
        <div className="track-base"></div>
        {/* selected person: stage-tinted life band on the ruler */}
        {segs && (
          <React.Fragment>
            <div className="life-band" style={{ left:`${X(birthY)}%`, width:`${X(endY)-X(birthY)}%` }}
              title={person ? R.fullName(person, 'en') + '’s life' : ''}>
              {segs.map((s,i)=>(
                <span key={i} className="lb-seg" style={{
                  left:`${((s.startYear-birthY)/(endY-birthY))*100}%`,
                  width:`${((s.endYear-s.startYear)/(endY-birthY))*100}%`,
                  background:s.color }}></span>
              ))}
            </div>
            {segs.map((s,i)=>(
              <span key={i} className="life-line" style={{
                left:`${X(s.startYear)}%`, width:`${X(s.endYear)-X(s.startYear)}%`, background:mixOf(s.color) }}></span>
            ))}
            <span className="life-cap birth" style={{ left:`${X(birthY)}%` }}></span>
            {person.death && <span className="life-cap death" style={{ left:`${X(endY)}%` }}></span>}
            <span className="life-lab" style={{ left:`${X(birthY)}%` }}>
              {R.fullName(person,'en')} · {birthY}–{person.death ? endY : 'now'}
            </span>
          </React.Fragment>
        )}
        {/* decade ticks + year labels */}
        {ticks.map(y=>(<span key={y} className={'rl-tick'+(y%20===0?' maj':'')} style={{ left:`${X(y)}%` }}></span>))}
        {ticks.filter(y=>y%20===0 && y-min>7 && max-y>7).map(y=>(
          <span key={y} className="rl-lab" style={{ left:`${X(y)}%` }}>{window.heYear(y)}</span>
        ))}
        <span className="rl-lab" style={{ left:'0%' }}>{window.heYear(min)}</span>
        <span className="rl-lab" style={{ left:'100%' }}>{window.heYear(max)}</span>
        {/* event dots, recoloured as the fill passes them */}
        {events.map((e,i)=>(<span key={i} className="ev-dot" style={{ left:`${X(e)}%`, background:dotColor(e) }}></span>))}
        <div className="track-fill" style={{ width: `${pct}%` }}></div>
        {/* playhead */}
        <div className="ph-line" style={{ left:`${pct}%` }}></div>
        <div className="ph-tab" style={{ left:`${pct}%` }} onPointerDown={dragFrom}><span className="ph-tab-face"><i></i><i></i></span></div>
        <div className="ph-pill" style={{ left:`${pct}%` }} onPointerDown={dragFrom}>{window.heYear(year)}</div>
        {introTip && (
          <div className={'intro-tip'+(introTip==='out'?' out':'')} style={{ left:`${pct}%` }}>
            Drag to travel through the years<br></br>and watch the family grow
          </div>
        )}
        <input aria-label="מעבר בין השנים העבריות" type="range" min={min} max={max} step="1" value={year}
          onChange={(e)=>{ setYear(+e.target.value); setPlaying(false); }} />
      </div>
    </div>
  );
}

function RelChip({ id, lang, label, onSelect }) {
  const R = window.REL; const p = R.get(id);
  const dead = !!p.death;
  return (
    <button className="rel-chip" onClick={()=>onSelect(id)}>
      <span className="rc-dot" style={{ background: p.sex==='f'?'var(--sex-f)':'var(--sex-m)', opacity: dead?.5:1 }} />
      <span className="rc-name"><NameText person={p} lang={lang} /></span>
      {label && <span className="rc-rel">{label}</span>}
    </button>
  );
}

function Drawer({ personId, lang, nameMode, year, setYear, onClose, onSelect, onOpenFocus }) {
  const R = window.REL; const p = R.get(personId);
  const [tab, setTab] = React.useState('story');
  // FLIP morph between the two tab layouts: the drawer animates its size, the
  // avatar flies from the story circle to the bio rounded-square (a ghost
  // <image-slot> clone rides on top), and the incoming pane fades in.
  const drawerRef = React.useRef(null), morphRef = React.useRef(null);
  const switchTab = (next) => {
    if (next === tab) return;
    const box = drawerRef.current;
    if (box) {
      const srcEl = box.querySelector(tab === 'story' ? '.mys-cwrap' : '.av-frame');
      const slot = srcEl && srcEl.querySelector('image-slot');
      morphRef.current = {
        w: box.offsetWidth, h: box.offsetHeight,
        av: (srcEl && slot) ? { r: srcEl.getBoundingClientRect(), br: getComputedStyle(srcEl).borderRadius,
          id: slot.getAttribute('id'), src: slot.getAttribute('src') } : null,
      };
    }
    setTab(next);
  };
  React.useLayoutEffect(() => {
    const m = morphRef.current; morphRef.current = null;
    const box = drawerRef.current;
    if (!m || !box) return;
    const toW = box.offsetWidth, toH = box.offsetHeight;
    const tgtSel = tab === 'story' ? '.mys-cwrap' : '.av-frame';
    let tEl = box.querySelector(tgtSel);
    const pr = (v, w) => (String(v).indexOf('%') !== -1 ? parseFloat(v) * w / 100 : parseFloat(v) || 0);
    let ghost = null, s = null, r0 = 0;
    if (m.av && tEl) {
      tEl.style.opacity = '0';
      s = m.av.r; r0 = pr(m.av.br, s.width);
      ghost = document.createElement('div');
      ghost.className = 'tab-ghost';
      ghost.style.cssText = `left:${s.left}px;top:${s.top}px;width:${s.width}px;height:${s.height}px;border-radius:${m.av.br};`;
      const gs = document.createElement('image-slot');
      gs.setAttribute('id', m.av.id); gs.setAttribute('shape', 'rect'); gs.setAttribute('fit', 'cover'); gs.setAttribute('no-reframe', '');
      if (m.av.src) gs.setAttribute('src', m.av.src);
      // square-normalized like .av-frame: the slot is a centred SQUARE of the
      // frame's longer side (avatar crops are square-authored), the ghost clips.
      // Without this the photo's framing zooms differently than the real cards.
      const S0 = Math.max(s.width, s.height);
      gs.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${S0}px;height:${S0}px;pointer-events:none;`;
      ghost.appendChild(gs);
      ghost._gs = gs;
      document.body.appendChild(ghost);
    }
    // ONE rAF loop drives BOTH the drawer size and the ghost flight. Time-based
    // style animations (CSS transitions / WAAPI) can sit play-pending for up to
    // a second in this embedded context — the drawer then snaps to its new size
    // AFTER the ghost has landed, which reads as a 20-40px avatar jump. rAF
    // demonstrably ticks reliably, so everything rides on it. The ghost chases
    // the target's LIVE rect (the constellation re-centres just after mount)
    // and keeps tracking through its own fade-out, so the handoff cannot jump.
    box.style.maxHeight = 'none';
    const dur = 420, t0 = performance.now();
    let done = false;
    const setGhostSize = (w, h) => {
      ghost.style.width = w + 'px'; ghost.style.height = h + 'px';
      const S = Math.max(w, h);
      ghost._gs.style.width = S + 'px'; ghost._gs.style.height = S + 'px';
    };
    const pinGhost = () => {
      if (!ghost || !tEl || !tEl.isConnected) return;
      const t = tEl.getBoundingClientRect();
      ghost.style.left = t.left + 'px'; ghost.style.top = t.top + 'px';
      setGhostSize(t.width, t.height);
      ghost.style.borderRadius = getComputedStyle(tEl).borderRadius;
    };
    const step = (ts) => {
      if (done) { // ghost fading out: stay glued to the live avatar underneath
        if (ghost && ghost.isConnected) { pinGhost(); requestAnimationFrame(step); }
        return;
      }
      if (ghost && (!tEl || !tEl.isConnected)) { // target remounted mid-flight
        tEl = box.querySelector(tgtSel);
        if (tEl) tEl.style.opacity = '0';
      }
      const u = Math.min(1, (ts - t0) / dur), e = .5 - .5 * Math.cos(u * Math.PI);
      box.style.width = (m.w + (toW - m.w) * e) + 'px';
      box.style.height = (m.h + (toH - m.h) * e) + 'px';
      if (ghost && tEl && tEl.isConnected) {
        const t = tEl.getBoundingClientRect();
        const r1 = pr(getComputedStyle(tEl).borderRadius, t.width);
        ghost.style.left = (s.left + (t.left - s.left) * e) + 'px';
        ghost.style.top = (s.top + (t.top - s.top) * e) + 'px';
        setGhostSize(s.width + (t.width - s.width) * e, s.height + (t.height - s.height) * e);
        ghost.style.borderRadius = (r0 + (r1 - r0) * e) + 'px';
      }
      if (u >= 1) {
        done = true;
        // release the drawer to natural layout FIRST, then pin the ghost to the
        // avatar's settled rect and reveal it under the fading ghost
        box.style.width = box.style.height = box.style.maxHeight = '';
        pinGhost();
        if (tEl && tEl.isConnected) tEl.style.opacity = '';
        if (ghost) { ghost.style.transition = 'opacity .18s ease'; ghost.style.opacity = '0'; setTimeout(() => ghost.remove(), 220); }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [tab]);
  const status = R.statusAt(p, year);
  const age = R.ageAt(p, year);
  const end = p.death ? p.death.year : R.NOW;
  const lifeAge = Math.min(age == null ? 0 : age, end - p.birth.year);
  const era = lifeAge < 22 ? 'young' : lifeAge < 59 ? 'adult' : 'elder';
  const slot = `ph-${personId}-${era}`;
  const events = React.useMemo(() => R.lifeEvents(personId, lang), [personId, lang]);
  const recent = events.filter(e => e.year <= year).pop();
  const union = R.unionsOf(personId).find(u => year >= u.year && !(u.endYear && year >= u.endYear));
  const spouse = union ? R.partnerInUnion(union, personId) : null;
  const kids = R.childrenOf(personId).map(R.get).filter(c => c.birth.year <= year);
  const first = id => R.fullName(R.get(id), lang).split(' ')[0];

  const sib = R.siblings(personId);
  const steps = R.stepParents(personId);
  const stepKids = R.stepChildren(personId);
  const partners = R.unionsOf(personId).map(u => ({ id: R.partnerInUnion(u, personId), u }));
  const kidsAll = R.childrenOf(personId);
  const links = R.sideLinksOf(personId);
  // name-change context line (né/née · born surname, or later surname in birth mode)
  const ncLine = (() => {
    if (!p.nameChange || !p.names || !p.names.birth) return null;
    const bs = p.names.birth.en.split(' ').slice(-1)[0];
    const cs = p.name.en.split(' ').slice(-1)[0];
    const showingBirth = R.usesBirthName ? R.usesBirthName(p, nameMode) : (nameMode === 'birth');
    if (showingBirth) return `later ${cs} \u00b7 from ${p.nameChange.year}`;
    const pre = p.nameChange.kind === 'marriage' ? (p.sex==='f'?'n\u00e9e':'n\u00e9') : 'born';
    return `${pre} ${bs}`;
  })();

  const Section = ({ title, children }) => (
    <div className="rel-section"><div className="rs-title">{title}</div><div className="rs-chips">{children}</div></div>
  );

  const storyTabs = (
    <div className="story-tabs">
      <button className={tab==='story'?'on':''} onClick={()=>switchTab('story')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path></svg>
        My story
      </button>
      <button className={tab==='bio'?'on':''} onClick={()=>switchTab('bio')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"></path><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2.5"></path></svg>
        Bio story
      </button>
    </div>
  );

  return (
    <div className={'drawer' + (tab === 'story' ? ' story-mode' : '')} ref={drawerRef}>
      <button className="x-btn float" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      {storyTabs}
      {tab === 'story' ? (
      <div className="tab-pane" key="story">
        {React.createElement(window.StoryPanel, { personId, year, setYear, lang, onSelect })}
      </div>
      ) : (
      <div className="tab-pane" key="bio">

      <div className="drawer-body">
      {/* mini screen — updates as you scrub the main timeline */}
      <div className="mini-screen">
        {status === 'unborn'
          ? <div className="ms-portrait empty"><Medallion person={p} size={72} /></div>
          : (() => {
              const av = window.autoAvatar ? window.autoAvatar(personId, year) : { idx: -1, u: null };
              const idx = av.idx >= 0 ? av.idx : 0;
              return React.createElement(window.PhotoMenuSlot, {
                personId, idx, mode: 'avatar', shape: 'rounded', radius: '13',
                placeholder: initials(p),
                style: { width: '100%', height: 'clamp(120px,22vh,190px)' },
              });
            })()}
        <div className="ms-name"><NameText person={p} lang={lang} /></div>
        {ncLine && <div className="ms-nee">{ncLine}</div>}
        <div className="ms-life">{p.birth.year}{p.death?`\u2013${p.death.year}`:'\u2013present'} · {p.sex==='f'?'Female':'Male'}</div>

        <div className="ms-now">
          {status === 'living' && <><span className="ms-age">Age {age}</span><span className="ms-yr">in {year}</span><span className="badge-live sm">Living</span></>}
          {status === 'dead' && <><span className="ms-age">Died {p.death.year}</span><span className="ms-yr">aged {p.death.year-p.birth.year}</span></>}
          {status === 'unborn' && <><span className="ms-age">Not yet born</span><span className="ms-yr">arrives {p.birth.year}</span></>}
        </div>

        {status !== 'unborn' && (
          <div className="ms-rows">
            <div className="ms-row"><span className="ms-k">Place</span><span className="ms-v" dir="auto">{status==='dead'?p.death.place:p.birth.place}</span></div>
            {spouse && <div className="ms-row"><span className="ms-k">{union.type==='marriage'?'Married':'Partner'}</span><span className="ms-v link" onClick={()=>onSelect(spouse)}>{R.fullName(R.get(spouse),lang)} <em>· {union.year}</em></span></div>}
            {kids.length>0 && <div className="ms-row"><span className="ms-k">Children</span><span className="ms-v">{kids.map((c,i)=><React.Fragment key={c.id}><span className="link" onClick={()=>onSelect(c.id)}>{first(c.id)}</span>{i<kids.length-1?', ':''}</React.Fragment>)}</span></div>}
            {recent && <div className="ms-row"><span className="ms-k">Latest</span><span className="ms-v" dir="auto">{recent.label} <em>· {recent.year}</em></span></div>}
          </div>
        )}
      </div>

        {p.bio && <p className="dh-bio" dir="auto">{(lang === 'he' && p.bio.he) ? p.bio.he : p.bio.en}</p>}
        {(p.parents.length+steps.length)>0 && <Section title="Parents">{p.parents.map(id=><RelChip key={id} id={id} lang={lang} onSelect={onSelect} />)}{steps.map(id=><RelChip key={id} id={id} lang={lang} label="step" onSelect={onSelect} />)}</Section>}
        {(sib.full.length+sib.half.length)>0 && <Section title="Siblings">{sib.full.map(id=><RelChip key={id} id={id} lang={lang} onSelect={onSelect} />)}{sib.half.map(id=><RelChip key={id} id={id} lang={lang} label="half" onSelect={onSelect} />)}</Section>}
        {partners.length>0 && <Section title="Partners">{partners.map(({id,u})=><RelChip key={id} id={id} lang={lang} label={u.type==='partnership'?'partner':(u.endReason==='death'?'late spouse':'spouse')} onSelect={onSelect} />)}</Section>}
        {kidsAll.length>0 && <Section title="Children">{kidsAll.map(id=><RelChip key={id} id={id} lang={lang} onSelect={onSelect} />)}</Section>}
        {stepKids.length>0 && <Section title="Step-children · auto">{stepKids.map(id=><RelChip key={id} id={id} lang={lang} onSelect={onSelect} />)}</Section>}
        {links.length>0 && <Section title="קשרים נוספים · non-blood">{links.map((l,i)=><RelChip key={i} id={l.other} lang={lang} label={l.kind} onSelect={onSelect} />)}</Section>}
      </div>
      </div>
      )}
      {/* shared footer — the SAME button in both tabs, so it never blinks on flip */}
      <div className="drawer-foot">
        <button className="cta" onClick={()=>onOpenFocus(personId)}>
          View life timeline
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  );
}

class RrBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 380, font: '400 13.5px/1.6 var(--font-body)', color: 'var(--ink-2)' }}>
          <div style={{ font: '600 17px/1.3 var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>The Records Room hit a snag</div>
          The tree itself is fine. Close this and try again — if it repeats, tell Claude what you clicked.
          <div style={{ marginTop: 14 }}><button className="rr-btn" onClick={() => { this.setState({ err: null }); this.props.onClose(); }}>Back to the tree</button></div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

function App() {
  const R = window.REL;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [year, setYear] = useState(() => 5534);
  // structural edits (edit mode) change the people set — re-run layout when they land
  const [treeRev, setTreeRev] = useState(0);
  useEffect(() => { const h = () => setTreeRev((n) => n + 1); window.addEventListener('ft-tree-changed', h); return () => window.removeEventListener('ft-tree-changed', h); }, []);
  // layout recomputes only when the set of visible people changes (cards glide between)
  const visKey = React.useMemo(() => [...R.visibleSet(year)].sort().join(','), [year, treeRev]);
  const layout = React.useMemo(() => R.computeLayout(R.visibleSet(year)), [visKey]);
  const eventYears = React.useMemo(() => {
    const ys = new Set(); R.F.people.forEach(p=>{ if(p.birth.year!=null)ys.add(p.birth.year); if(p.death?.year!=null) ys.add(p.death.year); });
    R.F.unions.forEach(u=>{if(u.year!=null)ys.add(u.year)}); return [...ys];
  }, []);

  const [playing, setPlaying] = useState(false);
  // global scrub-speed gauge (years/sec → 0..1 "slow" factor) — image-slot reads
  // window.__ftScrubSlow to stretch its photo crossfade when scrubbing slowly
  const scrubRef = React.useRef({ y: year, t: performance.now(), slow: 0 });
  useEffect(() => {
    const r = scrubRef.current;
    if (year === r.y) return;
    const now = performance.now();
    const v = Math.abs(year - r.y) / (Math.max(16, now - r.t) / 1000);
    const slow = Math.max(0, Math.min(1, (8 - v) / 7));
    r.slow = r.slow * 0.5 + slow * 0.5; r.y = year; r.t = now;
    window.__ftScrubSlow = r.slow;
  }, [year]);
  const [lang, setLang] = useState('he');
  const [nameMode, setNameModeRaw] = useState(() => { try { const m = localStorage.getItem('ft.nameMode'); return (m==='birth'||m==='current'||m==='time')?m:'time'; } catch(e){ return 'time'; } });
  const setNameMode = (v) => { const m = (v==='birth'||v==='time')?v:'current'; if (R.setNameMode) R.setNameMode(m); setNameModeRaw(m); };
  useEffect(() => { if (R.setNameMode) R.setNameMode(nameMode); }, []);
  const [showSide, setShowSide] = useState(true);
  const [familyFocus, setFamilyFocus] = useState(false);
  const [lifeEffects, setLifeEffectsRaw] = useState(() => { try { return localStorage.getItem('ft.lifeEffects') || 'hurray'; } catch (e) { return 'hurray'; } });
  const setLifeEffects = (v) => { setLifeEffectsRaw(v); try { localStorage.setItem('ft.lifeEffects', v); } catch (e) {} };
  const [selectedId, setSelectedId] = useState(null);
  const [worldEv, setWorldEv] = useState(null);
  const [worldRoom, setWorldRoom] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [pubOpen, setPubOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(null); // null | screen name ('people', 'world', …)
  // edit-the-tree mode: timeline slides away, nodes compact, toolbar rises
  const [editing, setEditing] = useState(false);
  const prevYearRef = React.useRef(null);
  // rAF-driven scrubber slide (CSS transitions stall in this embedded context)
  const scrubDockRef = React.useRef(null);
  const firstScrubFx = React.useRef(true);
  useEffect(() => {
    if (firstScrubFx.current) { firstScrubFx.current = false; return; }
    const el = scrubDockRef.current && scrubDockRef.current.querySelector('.scrubber');
    if (!el) return;
    const from = editing ? 0 : 160, to = editing ? 160 : 0;
    const t0 = performance.now(), dur = 450; let raf, done = false;
    const land = () => { if (done) return; done = true;
      if (editing) { el.style.transform = 'translateY(160%)'; el.style.opacity = '0'; }
      else { el.style.transform = ''; el.style.opacity = ''; } };
    const step = (ts) => {
      if (done) return;
      const u = Math.min(1, (ts - t0) / dur), e = .5 - .5 * Math.cos(u * Math.PI);
      const y = from + (to - from) * e;
      el.style.transform = `translateY(${y}%)`;
      el.style.opacity = String(1 - (y / 160));
      if (u < 1) raf = requestAnimationFrame(step); else land();
    };
    raf = requestAnimationFrame(step);
    const wd = setTimeout(land, dur + 200); // watchdog: rAF can stall in throttled contexts
    return () => { cancelAnimationFrame(raf); clearTimeout(wd); land(); };
  }, [editing]);
  const toggleEdit = () => {
    setEditing((v) => {
      if (!v) {
        prevYearRef.current = year;
        setPlaying(false); setSelectedId(null); setWorldEv(null); setWorldRoom(null); setFocusId(null);
        setYear(R.MAX_YEAR);
        return true;
      }
      if (prevYearRef.current != null) setYear(prevYearRef.current);
      return false;
    });
  };

  // tiny toast for undo/redo/discard feedback
  const [toast, setToast] = useState(null);
  const toastTimer = React.useRef(null);
  const showToast = React.useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  // Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z redo — through the change store
  useEffect(() => {
    const h = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && window.FTStore) {
        e.preventDefault();
        const l = e.shiftKey ? window.FTStore.redo() : window.FTStore.undo();
        if (l) showToast(`${e.shiftKey ? 'Redone' : 'Undone'} · ${l}`);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showToast]);

  // apply heritage accent
  useEffect(() => { document.documentElement.style.setProperty('--amber', t.heritage); }, [t.heritage]);

  // play loop
  useEffect(() => {
    if (!playing) return;
    if (year >= R.MAX_YEAR) setYear(R.MIN_YEAR);
    const iv = setInterval(() => {
      setYear(y => { if (y >= R.MAX_YEAR) { setPlaying(false); return R.MAX_YEAR; } return y + 1; });
    }, 170);
    return () => clearInterval(iv);
  }, [playing]);

  const select = (id) => { setSelectedId(id); setWorldEv(null); };
  const openFocus = (id) => { setFocusId(id); setSelectedId(null); setWorldEv(null); };
  // world-event stars/blooms dispatch a global event (they live deep inside the scrubber)
  useEffect(() => {
    const h = (e) => { setWorldEv(e.detail); setSelectedId(null); };
    window.addEventListener('ft-world-open', h);
    return () => window.removeEventListener('ft-world-open', h);
  }, []);

  const textureBg = {
    dots: 'radial-gradient(var(--canvas-dot) 1.2px, transparent 1.2px)',
    grid: 'linear-gradient(var(--canvas-dot) 1px, transparent 1px), linear-gradient(90deg, var(--canvas-dot) 1px, transparent 1px)',
    plain: 'none',
  }[t.canvasTexture];
  const textureSize = t.canvasTexture === 'plain' ? 'auto' : '26px 26px';
  // keep the year-aware name resolver in sync (for the 'לפי השנה' surname mode)
  if (R.setNameYear) R.setNameYear(year);

  return (
    <div className={'app-shell' + (editing ? ' editing' : '')}>
      <TopBar editing={editing} onToggleEdit={toggleEdit} onOpenRecords={(s)=>setRecordsOpen(s || 'desk')} lang={lang} setLang={setLang} nameMode={nameMode} setNameMode={setNameMode} showSide={showSide} setShowSide={setShowSide} familyFocus={familyFocus} setFamilyFocus={setFamilyFocus} lifeEffects={lifeEffects} setLifeEffects={setLifeEffects} year={year} onOpenPublish={()=>setPubOpen(true)} />

      <div className="main" style={{ '--tex-bg': textureBg, '--tex-size': textureSize }}>
        {focusId ? (
          <FocusView personId={focusId} lang={lang} nameMode={nameMode} year={year} setYear={setYear}
            onClose={()=>setFocusId(null)} onOpenFull={(id)=>setFocusId(id)} />
        ) : (
          <TreeCanvas layout={layout} lang={lang} nameMode={nameMode} style={t.nodeStyle} year={year}
            showSideLinks={showSide}
            lifeEffects={lifeEffects}
            editMode={editing}
            focusBranch={t.branchHighlight ? selectedId : null}
            familyFocus={familyFocus}
            selectedId={selectedId} onSelect={select} onOpenFocus={select} />
        )}

        {worldEv && !focusId && (
          React.createElement(window.WorldEventDrawer, { evId: worldEv, year, setYear, personId: selectedId,
            onClose: () => setWorldEv(null),
            onOpenRoom: (id) => { setWorldRoom(id); setWorldEv(null); } })
        )}
        {worldRoom && React.createElement(window.WorldRoom, { evId: worldRoom, year, setYear, onClose: () => setWorldRoom(null) })}
        {selectedId && !focusId && !worldRoom && (
          <ChabadDrawer personId={selectedId} lang={lang} nameMode={nameMode} year={year} setYear={setYear}
            onClose={()=>setSelectedId(null)} onSelect={select} onOpenFocus={openFocus} />
        )}
      </div>

      {!focusId && !worldRoom && <div ref={scrubDockRef} className={'scrub-dock' + (editing ? ' away' : '')}><Scrubber year={year} setYear={setYear} playing={playing} setPlaying={setPlaying}
        min={R.MIN_YEAR} max={R.MAX_YEAR} events={eventYears} personId={null} openEvId={worldEv} /></div>}

      {editing && !focusId && !worldRoom && window.EditToolbar && <EditToolbar onDone={toggleEdit} onOpenPublish={()=>setPubOpen(true)} />}

      {pubOpen && <PublishDialog onClose={()=>setPubOpen(false)} onToast={showToast} />}
      {recordsOpen && window.FTEditorMode && window.RecordsRoom && <RrBoundary onClose={()=>setRecordsOpen(null)}><window.RecordsRoom screen={recordsOpen} onClose={()=>setRecordsOpen(null)} onToast={showToast} onJump={(id)=>{ select(id); }} onOpenPublish={()=>setPubOpen(true)} /></RrBoundary>}
      <div className={'ft-toast' + (toast ? ' on' : '')} aria-live="polite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
        <span>{toast || ''}</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
