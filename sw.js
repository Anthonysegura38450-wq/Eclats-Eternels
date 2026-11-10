// Service worker : réseau d'abord SANS cache HTTP (évite d'afficher une ancienne version après une mise à jour),
// repli sur la copie locale hors-ligne. Activation immédiate des nouvelles versions.
const C='ee-v24',F=['./','index.html','catcher.html','manifest.json','icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(
    fetch(req.url,{cache:'no-store'})
      .then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(req,cp)).catch(()=>{})}return r})
      .catch(()=>caches.match(req).then(m=>m||caches.match('index.html'))));
});
