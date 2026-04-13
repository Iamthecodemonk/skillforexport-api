(async ()=>{
  const fs = await import('fs');
  const path = await import('path');
  const { pathToFileURL } = await import('url');
  const schemaUrl = pathToFileURL(path.resolve('./src/interfaces/docs/schemas.js')).href;
  const s = await import(schemaUrl);
  const bad = [];
  const findIssues = (obj, prefix='') => {
    if (obj === undefined) { bad.push({ path: prefix || '<root>', reason: 'undefined' }); return; }
    if (obj === null) return;
    if (typeof obj === 'function') { bad.push({ path: prefix || '<root>', reason: 'function' }); return; }
    if (typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (let i=0;i<obj.length;i++) findIssues(obj[i], `${prefix}[${i}]`); return; }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === undefined) bad.push({ path: prefix ? `${prefix}.${k}` : k, reason: 'undefined' });
      else if (typeof v === 'function') bad.push({ path: prefix ? `${prefix}.${k}` : k, reason: 'function' });
      else if (v && typeof v === 'object') {
        if (v.constructor !== Object && !Array.isArray(v)) bad.push({ path: prefix ? `${prefix}.${k}` : k, reason: 'non-plain-object', valueType: v.constructor && v.constructor.name });
        else findIssues(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  };
  const keys = Object.keys(s);
  console.log('Schema keys:', keys.length);
  for (const k of keys) {
    if (k === 'default') continue;
    const v = s[k];
    if (v === undefined) console.log('EXPORT UNDEFINED:', k);
    else findIssues(v, k);
  }
  if (bad.length) {
    console.log('FOUND ISSUES:');
    console.log(bad.slice(0,200));
  } else console.log('No obvious issues in exported schemas');
  // scan routes
  const routes = fs.readFileSync('./src/interfaces/routes/index.js','utf8');
  const re = /schemas\.([A-Za-z0-9_]+)/g; let m; const set = new Set();
  while ((m = re.exec(routes))) set.add(m[1]);
  const refs = [...set].sort();
  console.log('Referenced in routes:', refs.length, refs.join(', '));
  const missing = refs.filter(x => !keys.includes(x));
  if (missing.length) { console.log('Missing schemas referenced in routes:'); console.log(missing); } else console.log('All referenced schemas are exported');
})();
