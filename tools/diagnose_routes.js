(async ()=>{
  const { pathToFileURL } = await import('url');
  const path = await import('path');
  const schemaMod = await import(pathToFileURL(path.resolve('./src/interfaces/docs/schemas.js')).href);
  const registerRoutes = (await import(pathToFileURL(path.resolve('./src/interfaces/routes/index.js')).href)).default;
  // Create a minimal Fastify-like stub with route method to inspect schemas
  const recorded = [];
  const app = {
    _routes: [],
    route(opts) { this._routes.push(opts); return this; },
    get(...args) { return this.route({ method: 'GET', url: args[0], ...args[1] }); },
    post(...args) { return this.route({ method: 'POST', url: args[0], ...args[1] }); },
    put(...args) { return this.route({ method: 'PUT', url: args[0], ...args[1] }); },
    delete(...args){ return this.route({ method: 'DELETE', url: args[0], ...args[1] }); },
    addHook(){},
    register(){ return Promise.resolve(); },
    decorate(){},
    hasDecorator(){ return false; },
    log: console
  };
  const deps = { controllers: {}, rateLimiters: null, authRequired: null };
  try{
    await registerRoutes(app, deps);
  } catch (e) {
    console.error('registerRoutes threw:', e && e.stack || e);
  }
  console.log('Collected', app._routes.length, 'routes');
  const findUndefined = (obj, path='') =>{
    if (obj === undefined) return path || '<root>';
    if (obj === null) return null;
    if (typeof obj !== 'object') return null;
    if (Array.isArray(obj)){
      for(let i=0;i<obj.length;i++){ const p=findUndefined(obj[i], `${path}[${i}]`); if(p) return p; }
      return null;
    }
    for(const k of Object.keys(obj)){
      const v = obj[k];
      if (v === undefined) return path?`${path}.${k}`:k;
      const p = findUndefined(v, path?`${path}.${k}`:k);
      if (p) return p;
    }
    return null;
  };
  for(const r of app._routes){
    const bad = r && r.schema ? findUndefined(r.schema) : null;
    if (bad){
      console.error('Route', r.method || r.method||r.methods||'?', r.url, 'has undefined in schema at', bad);
      // print snippet
      try{ console.error('Schema snippet:', JSON.stringify(r.schema, Object.keys(r.schema||{}).slice(0,20),2).slice(0,2000)); }catch(e){}
      try { console.error('response keys:', Object.keys(r.schema.response||{})); } catch(e){}
    }
    // extra diagnostics: check if schema.body is identical to exported symbols
    try {
      if (r && r.schema && r.schema.body) {
        for (const key of Object.keys(schemaMod)) {
          if (key === 'default') continue;
          try { if (r.schema.body === schemaMod[key]) console.log(`Route ${r.method} ${r.url} body references schema symbol: ${key}`); } catch (e) {}
        }
        // extra targeted check for known problematic routes
        if (r.url === '/media/register' || r.url === '/posts') {
          try {
            const resp = r.schema && r.schema.response ? r.schema.response['422'] : undefined;
            console.log(`DEBUG ${r.url} response.422 typeof:`, typeof resp);
            try { console.log(`DEBUG equals exported?`, resp === schemaMod.MediaValidationErrorResponse); } catch(e){}
            try { console.log(`DEBUG value preview:`, JSON.stringify(resp).slice(0,200)); } catch(e) { console.log('DEBUG value not JSON'); }
          } catch (e) {}
        }
      }
      if (r && r.schema && r.schema.response) {
        for (const code of Object.keys(r.schema.response)) {
          const val = r.schema.response[code];
          for (const key of Object.keys(schemaMod)) {
            if (key === 'default') continue;
            try { if (val === schemaMod[key]) console.log(`Route ${r.method} ${r.url} response.${code} references schema symbol: ${key}`); } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }
  console.log('Diagnostic complete');
})();
