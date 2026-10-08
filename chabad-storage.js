/* Hosting adaptation: browser-only storage. Original app: Aviran Revach, CC BY-NC 4.0. */
(() => {
  const files = ['.ft-doc.state.json', '.image-slots.state.json'];
  const nativeFetch = window.fetch.bind(window);
  let failed = false; const live = {};
  const status = (text) => { window.FTStorageStatus = text; window.dispatchEvent(new Event('ft-storage-status')); };
  const db = new Promise((resolve, reject) => {
    const r = indexedDB.open('chabad-pedia-tree-v2', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const read = async (file) => new Promise(async (resolve, reject) => {
    try { const d = await db; const r = d.transaction('files').objectStore('files').get(file); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); } catch(e) { reject(e); }
  });
  const write = async (file, value) => {
    if (!files.includes(file)) throw new Error('Unsupported file');
    JSON.parse(value); live[file] = value;
    try {
      const d = await db;
      await new Promise((resolve, reject) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(value, file); t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
      failed = false; status('נשמר בדפדפן');
    } catch(e) { failed = true; status('השמירה נכשלה - יש להוריד גיבוי כעת'); throw e; }
  };
  window.omelette = { writeFile: write };
  window.fetch = async (input, options) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    const file = decodeURIComponent(u.pathname.split('/').pop());
    if (u.origin === location.origin && files.includes(file)) {
      try { const saved = await read(file); if (saved !== undefined) return new Response(saved, {headers:{'Content-Type':'application/json'}}); }
      catch(e) { failed = true; status('אין גישה לשמירה בדפדפן - הורידו גיבוי'); }
    }
    return nativeFetch(input, options);
  };
  const snapshot = async () => {
    const result = {};
    for (const file of files) result[file] = JSON.parse(live[file] ?? await read(file) ?? await (await nativeFetch(file)).text());
    // Include the current live document if browser storage failed or a write is still in flight.
    if (window.FTStore) result[files[0]] = JSON.parse(JSON.stringify(window.FTStore.doc));
    return {format:'my-family-story-backup', version:1, created:new Date().toISOString(), files:result};
  };
  window.FTBrowserStorage = {
    failed: () => failed,
    async download() {
      try {
        const backup = await snapshot();
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type:'application/json'}));
        const a = document.createElement('a'); a.href = url; a.download = 'my-family-story-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
      } catch(e) { alert('לא ניתן ליצור גיבוי. אל תסגרו את העמוד.'); }
    },
    async import(file) {
      try {
        const x = JSON.parse(await file.text());
        if(x.format !== 'my-family-story-backup' || x.version !== 1 || !x.files || Object.keys(x.files).sort().join() !== [...files].sort().join()) throw new Error('Invalid backup');
        const doc = x.files[files[0]], slots = x.files[files[1]];
        if(!doc || doc.v !== 1 || !Array.isArray(doc.ops) || !doc.struct || !slots || typeof slots !== 'object' || Array.isArray(slots)) throw new Error('Invalid data');
        if(!confirm('ייבוא הגיבוי יחליף את העץ המקומי בדפדפן הזה. להמשיך?')) return;
        const d = await db;
        await new Promise((resolve,reject)=>{ const t=d.transaction('files','readwrite'); for(const f of files)t.objectStore('files').put(JSON.stringify(x.files[f]),f); t.oncomplete=resolve; t.onerror=()=>reject(t.error); t.onabort=()=>reject(t.error); });
        location.reload();
      } catch(e) { alert('הייבוא נכשל. בדקו שזה קובץ גיבוי תקין של האתר.'); }
    }
  };
  status('שמירה מקומית בדפדפן');
})();
