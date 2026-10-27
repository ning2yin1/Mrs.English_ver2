import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const files = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else files.push(p);
  }
}
await walk("dist");
const entries = await Promise.all(
  files
    .filter((p) => !p.endsWith("sw.js"))
    .map(async (p) => ({
      url: p.slice(5),
      hash: createHash("sha256")
        .update(await readFile(p))
        .digest("hex"),
    })),
);
const version = createHash("sha256")
  .update(JSON.stringify(entries))
  .digest("hex")
  .slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE='mrs-english-${version}';const ENTRIES=${JSON.stringify(entries)};const base=self.registration.scope;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);let i=0;const queue=[...ENTRIES];async function worker(){while(queue.length){const x=queue.shift(),u=new URL(x.url,base).href;const r=await fetch(u,{cache:'reload',credentials:'same-origin'});if(!r.ok)throw Error('Cache fetch failed: '+x.url);const a=await r.clone().arrayBuffer();const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),b=>b.toString(16).padStart(2,'0')).join('');if(h!==x.hash)throw Error('Integrity failure: '+x.url);await c.put(u,r);i++;for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage({type:'cache-progress',done:i,total:ENTRIES.length})}}await Promise.all(Array.from({length:4},worker));await c.put(new URL('__ready__',base),new Response('ready'));await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('mrs-english-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage({type:'cache-ready'})})()));
self.addEventListener('message',e=>{if(e.data==='status')e.waitUntil((async()=>{const c=await caches.open(CACHE);e.source?.postMessage({type:await c.match(new URL('__ready__',base))?'cache-ready':'cache-pending'})})())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(base))return;e.respondWith((async()=>{const c=await caches.open(CACHE);const cached=await c.match(e.request,{ignoreSearch:true});if(cached)return cached;try{return await fetch(e.request)}catch(err){if(e.request.mode==='navigate'){const shell=await c.match(new URL('index.html',base));if(shell)return shell}throw err}})())});`,
);
console.log(
  "Integrity-checked PWA cache:",
  entries.length,
  "files, version",
  version,
);
