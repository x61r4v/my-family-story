window.SaveChip = function SaveChip({onOpen}) {
  const [,bump] = React.useReducer(x=>x+1,0);
  React.useEffect(()=>{const fn=()=>bump();window.addEventListener('ft-storage-status',fn);return()=>window.removeEventListener('ft-storage-status',fn);},[]);
  return <button className="pub-chip" onClick={onOpen} title="גיבוי ושחזור"><span className="dot"></span><span dir="rtl">{window.FTStorageStatus || 'שמירה מקומית'}</span></button>;
};
window.PublishDialog = function PublishDialog({onClose}) {
  return <div className="ftp-scrim" onClick={onClose}><div style={{background:'#fffdf7',padding:24,borderRadius:16,width:'min(480px,94vw)',fontFamily:'Noto Sans Hebrew, sans-serif',lineHeight:1.65}} dir="rtl" onClick={e=>e.stopPropagation()}>
    <h2 style={{marginTop:0}}>שמירה וגיבוי</h2>
    <p>השינויים נשמרים אוטומטית רק בדפדפן ובמכשיר הזה, כולל אנשים, קשרים, סיפורים ותמונות.</p>
    <p>אין סנכרון בין מכשירים או בין בני משפחה. ניקוי נתוני האתר או שימוש בגלישה פרטית עלולים למחוק את העץ. הורידו גיבוי אחרי שינויים חשובים.</p>
    <p role="status">{window.FTStorageStatus}</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="ftp-copy" onClick={()=>window.FTBrowserStorage.download()}>הורדת גיבוי</button>
    <label style={{cursor:'pointer',border:'1px solid #ddd',padding:'8px 12px',borderRadius:8}}>ייבוא גיבוי<input aria-label="ייבוא גיבוי" type="file" accept=".json,application/json" style={{display:'block',maxWidth:240}} onChange={e=>{if(e.target.files[0])window.FTBrowserStorage.import(e.target.files[0]);}} /></label></div>
    <p style={{fontSize:12,color:'#6B6256'}}>שושלת חב"ד. מחקר חב"דפדיה מחדש; תאריכים לא ידועים אינם מומצאים. My Family Story מאת Aviran Revach. התאמת אירוח ושמירה מקומית. רישיון <a href="LICENSE" target="_blank" rel="noopener">CC BY-NC 4.0</a>, לשימוש לא מסחרי.</p>
    <button className="ftp-copy" onClick={onClose}>סגירה</button>
  </div></div>;
};
