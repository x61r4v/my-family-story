function ChabadDrawer(props) {
 const [ready,setReady]=React.useState(!!window.CHABAD_RESEARCH);React.useEffect(()=>{window.CHABAD_READY.then(()=>setReady(true))},[]);return ready?<ChabadDetails {...props}/>:<aside className="drawer chabad-drawer" dir="rtl"><p>טוען את מחקר חב"דפדיה...</p></aside>;
}
function ChabadDetails({personId,onClose,onSelect}) {
 const p=window.REL.get(personId),r=p.record||{},a=window.CHABAD_RESEARCH.articles[r.articleIndex];
 const [name,setName]=React.useState(p.name.he),[bio,setBio]=React.useState(p.bio.he),[edit,setEdit]=React.useState(false);
 const body=React.useRef(null);
 React.useEffect(()=>{setName(p.name.he);setBio(p.bio.he);setEdit(false);if(body.current)body.current.scrollTop=0;},[personId]);
 const people=window.FAMILY.people,related=people.filter(x=>p.parents.includes(x.id)||x.parents.includes(p.id)||window.FAMILY.unions.some(u=>(u.a===p.id&&u.b===x.id)||(u.b===p.id&&u.a===x.id)));
 return <aside className="drawer chabad-drawer" dir="rtl">
 <div className="drawer-head"><h2>{p.name.he}</h2><button className="bare" onClick={onClose} aria-label="סגירה">×</button></div>
 <div className="drawer-body" ref={body}>
 <p>{a.title}</p><p className="research-label">מחקר מחדש מתוך חב"דפדיה · נבדק 8.10.2026</p>
 <a className="pub-chip" href={a.url} target="_blank" rel="noopener">הערך המקורי בחב"דפדיה ↗</a>
 {r.note&&<p className="unknown-note">{r.note}</p>}
 {p.birth.year==null&&<p className="unknown-note">אין שנת לידה ודאית לציר. המיקום בעץ הוא משפחתי בלבד ואינו תאריך לידה או גיל.</p>}
 {r.limited&&<p className="unknown-note">אין כאן ערך אישי נפרד. האדם מוזכר ברשימת הילדים בערך המקושר; הפירוט למטה הוא ערך המשפחה ולא ביוגרפיה אישית שלו.</p>}
 <section><h3>המשפחה בעץ</h3><div className="research-relations">{related.map(x=><button key={x.id} className="pub-chip" onClick={()=>onSelect(x.id)}>{x.name.he}</button>)}</div></section>
 {a.facts.length>0&&<section><h3>פרטים מתוך תיבת המידע</h3>{a.facts.map((f,i)=><p key={i}>{f.label&&<strong>{f.label}: </strong>}{f.value}</p>)}</section>}
 <section><h3>תמונות ומסמכים במקור</h3>{r.image&&<figure><img src={r.image} alt={r.imageInfo.kind} style={{maxWidth:"100%",width:220,height:"auto"}}/><figcaption>{r.imageInfo.credit} <a href={r.imageInfo.source} target="_blank" rel="noopener">דף הקובץ</a></figcaption></figure>}<p>לא משתמשים בתמונות הישנות. קובץ ללא הרשאת שימוש מפורשת מקושר לחב"דפדיה ולא מוטמע כאן. שערי ספרים ומצבות אינם דיוקנאות.</p>
 {a.images.length===0?<p>לא נמצאה תמונה בערך.</p>:a.images.map((im,i)=><div className="research-image" key={i}><a href={im.file} target="_blank" rel="noopener">{im.caption||'תמונה / מסמך '+(i+1)} ↗</a><small>{im.credit}</small><small>{im.reuse}</small></div>)}</section>
 <section><h3>פירוט הערך</h3><p className="research-label">תוכן הערך מסודר לפי כותרות, כולל משפחה, תולדות חיים והערות. ניסוחים וגרסאות הם של המקור, לא הכרעה בין דעות.</p>
 {a.blocks.map((b,i)=>b.type==='heading'?<h3 key={i}>{b.text}</h3>:<p key={i}>{b.text}</p>)}</section>
 <details><summary>קישורים והפניות מן הערך</summary>{a.references.map((x,i)=><p key={i}><a href={x.url} target="_blank" rel="noopener">{x.text}</a></p>)}</details><section><h3>עריכה מקומית</h3><button className="pub-chip" onClick={()=>setEdit(!edit)}>עריכת השם והערה אישית</button>
 {edit&&<div className="local-editor"><label>שם<input value={name} onChange={e=>setName(e.target.value)}/></label><label>הערה מקומית<textarea value={bio} onChange={e=>setBio(e.target.value)}/></label><button onClick={()=>{window.FTStore.editField('p:'+p.id+':name.he',name,'שינוי שם');window.FTStore.editField('p:'+p.id+':name.en',name,'שינוי שם');window.FTStore.editField('p:'+p.id+':bio.he',bio,'הערה מקומית');setEdit(false)}}>שמירה בדפדפן</button></div>}{p.bio.he&&<p>{p.bio.he}</p>}</section>
 <p className="credit">טקסט: מחברי חב"דפדיה, כפי שמפורטים בגרסאות הקודמות של הערך. סידור מחדש, ללא הכרעה בגרסאות. <a href="GFDL-1.2.txt" target="_blank">GNU Free Documentation License 1.2</a>. <button className="pub-chip" onClick={()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(window.CHABAD_RESEARCH,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=u;a.download="CHABAD-DATA.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}>הורדת קובץ המחקר</button>.</p>
 <p className="credit">My Family Story מאת Aviran Revach · <a href="LICENSE">CC BY-NC 4.0</a>.</p>
 </div></aside>;
}
