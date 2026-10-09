/* أنشطتي — Service Worker: الإشعارات (نشاط جديد · رسالة من المعلم) + حفظ ملفات البوابة على الجهاز.
   ⚡ يحفظ ملفات الواجهة فقط (الصفحة والتنسيق والبرمجة والصور) فتُفتح البوابة فورًا ويُجلب الأحدث في الخلفية.
   الأنشطة والدرجات وبيانات الطالب لا تُحفظ إطلاقًا: تُجلب دائمًا من الخادم (نطاق آخر لا يمرّ هنا). لا يحتوي أي سر. */
const SW_VERSION = 'student-push-v1+static-v1';
const API = new URL(self.location.href).searchParams.get('api') || '';
const STATIC = 'portal-static-v1';
const SCOPE = new URL(self.registration ? self.registration.scope : './', self.location.href);
const PAGE_KEY = new URL('index.html', SCOPE).href;
const isStaticFile = u => /\.(css|js|webmanifest|png|svg|webp|ico|woff2?)$/i.test(u.pathname) && !/\/sw\.js$/i.test(u.pathname);
const isPage = u => u.pathname === SCOPE.pathname || u.pathname === new URL(PAGE_KEY).pathname;

async function notifyUpdate(){
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of all) c.postMessage({ type: 'dash-update' });
}
/* ملفات الإصدار المذكورة في الصفحة (?v=…) تُحفظ مسبقًا، والقديمة منها تُحذف */
async function syncAssets(html){
  const cache = await caches.open(STATIC);
  const want = new Set([...html.matchAll(/(?:href|src)="([^"]+\?v=[^"]+)"/g)].map(m => new URL(m[1], PAGE_KEY).href));
  await Promise.all([...want].map(async u => { if (!(await cache.match(u))) { try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await cache.put(u, r); } catch {} } }));
  for (const req of await cache.keys()) { const u = new URL(req.url); if (u.search.includes('v=') && !want.has(req.url)) await cache.delete(req); }
}
async function pageFromNetwork(request, oldP){
  const res = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });   // طلب «تنقّل» لا يُعاد بخيارات جديدة — نطلبه بعنوانه
  if (res.ok && res.type === 'basic') {
    const txt = await res.clone().text();
    const old = await oldP;
    const cache = await caches.open(STATIC);
    await cache.put(PAGE_KEY, res.clone());
    if (old !== txt) { await syncAssets(txt); if (old !== null) await notifyUpdate(); }
  }
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(SCOPE.pathname)) return;   // الخادم ونطاقات أخرى: لا نتدخل
  if (req.mode === 'navigate' && isPage(u)) {
    event.respondWith((async () => {
      const cached = await caches.match(PAGE_KEY);
      // نأخذ نسخة من المحفوظ قبل تسليمه للصفحة — جسم الاستجابة لا يُقرأ مرتين
      const net = pageFromNetwork(req, cached ? cached.clone().text() : Promise.resolve(null));
      if (cached) { event.waitUntil(net.catch(() => {})); return cached; }   // فوري من الجهاز، والتحديث في الخلفية
      return net;
    })());
    return;
  }
  if (!isStaticFile(u)) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC);
    const hit = await cache.match(req);
    if (hit && u.search.includes('v=')) return hit;            // ملف بإصدار ثابت: لا يتغير أبدًا
    const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok && r.type === 'basic') cache.put(req, r.clone()); return r; });
    if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});


self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('portal-static-') && k !== STATIC) await caches.delete(k);
  await self.clients.claim();
})()); });

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: 'أنشطتي', body: event.data ? event.data.text() : '' }; }
  const options = {
    body: String(msg.body || ''),
    tag: String(msg.tag || ''),
    data: msg.data || {},
    icon: new URL('pwa/icon-192.png', self.registration.scope).href,
    badge: new URL('pwa/badge-72.png', self.registration.scope).href,
    lang: 'ar', dir: 'rtl',
    timestamp: Date.now()
  };
  if (!options.tag) delete options.tag;
  event.waitUntil(self.registration.showNotification(String(msg.title || 'أنشطتي'), options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.startsWith(self.registration.scope));
    if (open) {                        // البوابة مفتوحة: انتقل للنشاط أو الرسائل مباشرة
      try { await open.focus(); } catch {}
      try { if ('navigate' in open) { await open.navigate(target); return; } } catch {}
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    if (!API) return;
    const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
    let sub = event.newSubscription;
    if (!sub) {
      const j = await (await fetch(API.replace(/\/+$/, '') + '/push/public-key', { cache: 'no-store' })).json();
      if (!j.publicKey) return;
      const s = j.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
      sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    if (!oldEndpoint || !sub) return;
    await fetch(API.replace(/\/+$/, '') + '/push/student/resubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() })
    });
  })());
});
